// lib/eeg/edge-screening.ts
import { openEdf, blobSource, readWindow, toPhysical } from "edfcore";
import {
  db,
  type Recording,
  type ScreeningSession,
  type DetectedEvent,
} from "@/lib/storage/db";
import rawModelData from "./edge_model.json";

export interface EdgeModelSpec {
  format: string;
  task: string;
  featureNames: string[];
  classNames: string[];
  threshold: number;
  preprocess: {
    log1pFeatures: string[];
    mean: number[];
    std: number[];
  };
  layers: {
    activation: "relu" | "softmax";
    W: number[][];
    b: number[];
  }[];
  smoothing?: {
    type: string;
    windows: number;
  };
  presets?: {
    FPR: number;
    label: string;
    threshold: number;
  }[];
}

export const EDGE_MODEL = rawModelData as EdgeModelSpec;

const TARGET_FS = 256;
const WIN_SEC = 2;
const WIN_SAMPLES = WIN_SEC * TARGET_FS; // 512 samples

// Daubechies-4 (db4) 8-tap decomposition filters
const LO_D = [
  -0.010597401785, 0.032883011667, 0.030841381836, -0.187034811719,
  -0.027983769417, 0.63088076793, 0.714846570553, 0.230377813309,
];
const HI_D = [
  -0.230377813309, 0.714846570553, -0.63088076793, -0.027983769417,
  0.187034811719, 0.030841381836, -0.032883011667, -0.010597401785,
];

const NON_EEG_TOKENS = [
  "EDF ANNOTATIONS",
  "ANNOTATION",
  "ECG",
  "EKG",
  "SPO2",
  "HR",
  "RESP",
  "MK",
  "PHOTIC",
  "EVENT",
  "STAT",
];

const LOG1P_SET = new Set(EDGE_MODEL.preprocess.log1pFeatures);

export interface ChannelMasks {
  fMask: boolean[];
  pMask: boolean[];
  lMask: boolean[];
  rMask: boolean[];
}

/**
 * Computes accurate total duration in seconds from an EDF header and file size.
 */
export function getEdfTotalDurationSeconds(edfFile: any, fileSize: number): number {
  const hdr = edfFile?.header ?? {};
  const recordDur = Number(hdr.recordDurationSeconds ?? 1) || 1;
  const numRecords = Number(
    hdr.numDataRecords ??
      hdr.numberOfDataRecords ??
      hdr.dataRecordCount ??
      hdr.recordCount ??
      0
  );

  if (Number(hdr.durationSeconds) > recordDur) {
    return Number(hdr.durationSeconds);
  }
  if (numRecords > 0) {
    return numRecords * recordDur;
  }

  const signals: any[] = hdr.signals ?? [];
  const headerBytes = Number(hdr.headerBytes ?? (256 + signals.length * 256));
  const samplesPerRecord = signals.reduce(
    (acc, s) =>
      acc + Number(s.samplesPerRecord ?? Math.round((s.sampleRateHz || 256) * recordDur)),
    0
  );
  const bytesPerRecord = samplesPerRecord * 2;
  if (bytesPerRecord > 0 && fileSize > headerBytes) {
    const estimatedRecords = Math.floor((fileSize - headerBytes) / bytesPerRecord);
    if (estimatedRecords > 0) {
      return estimatedRecords * recordDur;
    }
  }
  return recordDur;
}

/**
 * Builds spatial channel masks (Frontal, Posterior, Left, Right) from 10-20 labels.
 */
export function buildChannelMasks(channelLabels: string[]): ChannelMasks {
  const upper = channelLabels.map((c) => c.toUpperCase());
  const fTokens = ["FP", "F3", "F4", "F7", "F8", "FZ"];
  const pTokens = ["P3", "P4", "P7", "P8", "T5", "T6", "O1", "O2", "PZ"];

  const fMask = upper.map((lbl) => fTokens.some((t) => lbl.includes(t)));
  const pMask = upper.map((lbl) => pTokens.some((t) => lbl.includes(t)));
  const lMask = upper.map((lbl) => /[1357]/.test(lbl));
  const rMask = upper.map((lbl) => /[2468]/.test(lbl));

  return { fMask, pMask, lMask, rMask };
}

/**
 * Second-order zero-phase (forward-backward) biquad filter for EEG preprocessing.
 */
function applyBiquadZeroPhase(
  signal: Float64Array,
  b0: number,
  b1: number,
  b2: number,
  a1: number,
  a2: number
): Float64Array {
  const n = signal.length;
  if (n < 4) return signal;

  const forward = new Float64Array(n);
  let x1 = signal[0],
    x2 = signal[0],
    y1 = signal[0],
    y2 = signal[0];
  for (let i = 0; i < n; i++) {
    const x0 = signal[i];
    const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    forward[i] = y0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }

  const out = new Float64Array(n);
  x1 = forward[n - 1];
  x2 = forward[n - 1];
  y1 = forward[n - 1];
  y2 = forward[n - 1];
  for (let i = n - 1; i >= 0; i--) {
    const x0 = forward[i];
    const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    out[i] = y0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }
  return out;
}

function designNotchBiquad(f0: number, fs: number, Q = 25) {
  const w0 = (2 * Math.PI * f0) / fs;
  const alpha = Math.sin(w0) / (2 * Q);
  const cosw0 = Math.cos(w0);
  const a0 = 1 + alpha;
  return {
    b0: 1 / a0,
    b1: (-2 * cosw0) / a0,
    b2: 1 / a0,
    a1: (-2 * cosw0) / a0,
    a2: (1 - alpha) / a0,
  };
}

function designHighPassBiquad(fc: number, fs: number) {
  const w0 = (2 * Math.PI * fc) / fs;
  const alpha = Math.sin(w0) / Math.SQRT2;
  const cosw0 = Math.cos(w0);
  const a0 = 1 + alpha;
  return {
    b0: (1 + cosw0) / 2 / a0,
    b1: -(1 + cosw0) / a0,
    b2: (1 + cosw0) / 2 / a0,
    a1: (-2 * cosw0) / a0,
    a2: (1 - alpha) / a0,
  };
}

function designLowPassBiquad(fc: number, fs: number) {
  const w0 = (2 * Math.PI * fc) / fs;
  const alpha = Math.sin(w0) / Math.SQRT2;
  const cosw0 = Math.cos(w0);
  const a0 = 1 + alpha;
  return {
    b0: (1 - cosw0) / 2 / a0,
    b1: (1 - cosw0) / a0,
    b2: (1 - cosw0) / 2 / a0,
    a1: (-2 * cosw0) / a0,
    a2: (1 - alpha) / a0,
  };
}

export function filterChannel256Hz(
  raw: Float64Array,
  opts: { highPassHz?: number | null; lowPassHz?: number | null; notchHz?: number | null } = {
    highPassHz: 0.5,
    lowPassHz: 45,
    notchHz: 50,
  }
): Float64Array {
  let sig = raw;
  if (opts.notchHz) {
    const nq = designNotchBiquad(opts.notchHz, TARGET_FS, 25);
    sig = applyBiquadZeroPhase(sig, nq.b0, nq.b1, nq.b2, nq.a1, nq.a2);
  }
  if (opts.highPassHz) {
    const hp = designHighPassBiquad(opts.highPassHz, TARGET_FS);
    sig = applyBiquadZeroPhase(sig, hp.b0, hp.b1, hp.b2, hp.a1, hp.a2);
  }
  if (opts.lowPassHz) {
    const lp = designLowPassBiquad(opts.lowPassHz, TARGET_FS);
    sig = applyBiquadZeroPhase(sig, lp.b0, lp.b1, lp.b2, lp.a1, lp.a2);
  }
  return sig;
}

/**
 * Resamples an arbitrary 1D signal to 256 Hz.
 */
function resampleTo256Hz(input: Float64Array, rawFs: number, durationSec: number): Float64Array {
  const targetLen = Math.round(durationSec * TARGET_FS);
  if (rawFs === 256 && input.length === targetLen) {
    return input;
  }
  if (rawFs === 512 && input.length >= targetLen * 2) {
    const out = new Float64Array(targetLen);
    for (let i = 0; i < targetLen; i++) {
      out[i] = input[i * 2];
    }
    return out;
  }
  const out = new Float64Array(targetLen);
  const scale = (input.length - 1) / Math.max(1, targetLen - 1);
  for (let i = 0; i < targetLen; i++) {
    const pos = i * scale;
    const idx = Math.floor(pos);
    const frac = pos - idx;
    const v0 = input[idx] ?? 0;
    const v1 = input[Math.min(input.length - 1, idx + 1)] ?? v0;
    out[i] = v0 + frac * (v1 - v0);
  }
  return out;
}

/**
 * In-place Radix-2 Cooley-Tukey FFT for N = 512.
 */
function fft512(real: Float64Array, imag: Float64Array): void {
  const n = 512;
  let j = 0;
  for (let i = 0; i < n; i++) {
    if (i < j) {
      const tr = real[i];
      real[i] = real[j];
      real[j] = tr;
      const ti = imag[i];
      imag[i] = imag[j];
      imag[j] = ti;
    }
    let m = n >> 1;
    while (m >= 1 && j >= m) {
      j -= m;
      m >>= 1;
    }
    j += m;
  }

  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const angle = (-2 * Math.PI) / len;
    const wlenR = Math.cos(angle);
    const wlenI = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let wR = 1;
      let wI = 0;
      for (let k = 0; k < half; k++) {
        const uR = real[i + k];
        const uI = imag[i + k];
        const vR = real[i + k + half] * wR - imag[i + k + half] * wI;
        const vI = real[i + k + half] * wI + imag[i + k + half] * wR;
        real[i + k] = uR + vR;
        imag[i + k] = uI + vI;
        real[i + k + half] = uR - vR;
        imag[i + k + half] = uI - vI;
        const nextWR = wR * wlenR - wI * wlenI;
        wI = wR * wlenI + wI * wlenR;
        wR = nextWR;
      }
    }
  }
}

/**
 * Single-level DWT 'same' convolution followed by dyadic decimation (0-based 0:2:end, matching MATLAB 1:2:end).
 */
function dwtConvSameDecimate(x: Float64Array, filter: number[]): Float64Array {
  const L = x.length;
  const outLen = Math.floor((L + 1) / 2);
  const out = new Float64Array(outLen);
  for (let outIdx = 0, i = 0; i < L; i += 2, outIdx++) {
    let sum = 0;
    for (let k = 0; k < 8; k++) {
      const src = i + 4 - k;
      if (src >= 0 && src < L) {
        sum += x[src] * filter[k];
      }
    }
    out[outIdx] = sum;
  }
  return out;
}

function sumSquares(arr: Float64Array): number {
  let s = 0;
  for (let i = 0; i < arr.length; i++) {
    s += arr[i] * arr[i];
  }
  return s;
}

/**
 * 5-level Daubechies-4 DWT relative sub-band power decomposition.
 */
function computeDWTdb4Bands1D(seg: Float64Array): [number, number, number, number, number] {
  const A1 = dwtConvSameDecimate(seg, LO_D);
  const D2 = dwtConvSameDecimate(A1, HI_D);
  const A2 = dwtConvSameDecimate(A1, LO_D);
  const D3 = dwtConvSameDecimate(A2, HI_D);
  const A3 = dwtConvSameDecimate(A2, LO_D);
  const D4 = dwtConvSameDecimate(A3, HI_D);
  const A4 = dwtConvSameDecimate(A3, LO_D);
  const D5 = dwtConvSameDecimate(A4, HI_D);
  const A5 = dwtConvSameDecimate(A4, LO_D);

  const eDelta = sumSquares(A5);
  const eTheta = sumSquares(D5);
  const eAlpha = sumSquares(D4);
  const eBeta = sumSquares(D3);
  const eGamma = sumSquares(D2);

  const totE = eDelta + eTheta + eAlpha + eBeta + eGamma + 1e-12;
  return [
    eDelta / totE,
    eTheta / totE,
    eAlpha / totE,
    eBeta / totE,
    eGamma / totE,
  ];
}

function sampleVariance(arr: Float64Array): number {
  const n = arr.length;
  if (n <= 1) return 0;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += arr[i];
  mean /= n;
  let sq = 0;
  for (let i = 0; i < n; i++) {
    const d = arr[i] - mean;
    sq += d * d;
  }
  return sq / (n - 1);
}

/**
 * Extracts the exact 28 raw features for a 2-second (512-sample) multichannel window.
 */
export function extract28Features(
  channelsSeg: Float64Array[],
  baseTKEO: number,
  masks: ChannelMasks
): { features28: number[]; channelTkeo: number[]; channelRms: number[] } {
  const numCh = channelsSeg.length;
  const N = WIN_SAMPLES;

  const chMat: number[][] = Array.from({ length: 12 }, () => new Array(numCh).fill(0));
  const rawTkeoArr = new Array<number>(numCh).fill(0);
  const rmsArr = new Array<number>(numCh).fill(0);

  const log2Denom = Math.log2(80); // 80 bins between 0.5 Hz and 40.0 Hz at 256 Hz / 512 N

  for (let c = 0; c < numCh; c++) {
    const seg = channelsSeg[c];
    const dx = new Float64Array(N - 1);
    let absDxSum = 0;
    let sqSum = 0;

    for (let i = 0; i < N; i++) {
      const v = seg[i];
      sqSum += v * v;
      if (i < N - 1) {
        const d = seg[i + 1] - v;
        dx[i] = d;
        absDxSum += Math.abs(d);
      }
    }

    const ddx = new Float64Array(N - 2);
    let tkeoSum = 0;
    for (let i = 0; i < N - 2; i++) {
      ddx[i] = dx[i + 1] - dx[i];
      const tk = Math.abs(seg[i + 1] * seg[i + 1] - seg[i] * seg[i + 2]);
      tkeoSum += tk;
    }

    const LL = absDxSum / (N - 1);
    const RMS = Math.sqrt(sqSum / N);
    const rawTKEO = tkeoSum / (N - 2);
    const logTKEO = Math.log10(rawTKEO + 1);

    rawTkeoArr[c] = rawTKEO;
    rmsArr[c] = RMS;

    const var0 = sampleVariance(seg) + 1e-8;
    const var1 = sampleVariance(dx) + 1e-8;
    const var2 = sampleVariance(ddx) + 1e-8;

    const hjorthAct = Math.log10(var0 + 1);
    const hjorthMob = Math.sqrt(var1 / var0);
    const hjorthComp = Math.sqrt(var2 / var1) / (hjorthMob + 1e-8);

    // 512-point FFT for Shannon Spectral Entropy (0.5 - 40 Hz -> bins 1..80)
    const re = new Float64Array(N);
    const im = new Float64Array(N);
    re.set(seg);
    fft512(re, im);

    const P = new Float64Array(80);
    let sumP = 1e-12;
    for (let k = 1; k <= 80; k++) {
      const p = (re[k] * re[k] + im[k] * im[k]) / N;
      P[k - 1] = p;
      sumP += p;
    }

    let ent = 0;
    for (let j = 0; j < 80; j++) {
      const pNorm = P[j] / sumP;
      ent -= pNorm * Math.log2(pNorm + 1e-12);
    }
    const specEnt = ent / log2Denom;

    const [dwtDelta, dwtTheta, dwtAlpha, dwtBeta, dwtGamma] = computeDWTdb4Bands1D(seg);

    chMat[0][c] = LL;
    chMat[1][c] = RMS;
    chMat[2][c] = logTKEO;
    chMat[3][c] = hjorthAct;
    chMat[4][c] = hjorthMob;
    chMat[5][c] = hjorthComp;
    chMat[6][c] = specEnt;
    chMat[7][c] = dwtDelta;
    chMat[8][c] = dwtTheta;
    chMat[9][c] = dwtAlpha;
    chMat[10][c] = dwtBeta;
    chMat[11][c] = dwtGamma;
  }

  const max12 = new Array<number>(12);
  const mean12 = new Array<number>(12);
  for (let m = 0; m < 12; m++) {
    let mx = -Infinity;
    let s = 0;
    for (let c = 0; c < numCh; c++) {
      const v = chMat[m][c];
      if (v > mx) mx = v;
      s += v;
    }
    max12[m] = mx;
    mean12[m] = s / numCh;
  }

  const focalCrest = max12[2] / (mean12[2] + 1e-6);
  const recruitPct =
    rawTkeoArr.filter((v) => v > 2.5 * baseTKEO).length / Math.max(1, numCh);

  // Blink ratio (Frontal / Posterior RMS)
  const fRms = rmsArr.filter((_, i) => masks.fMask[i]);
  const pRms = rmsArr.filter((_, i) => masks.pMask[i]);
  let blinkRatio = 1.0;
  if (fRms.length > 0 && pRms.length > 0) {
    const fMean = fRms.reduce((a, b) => a + b, 0) / fRms.length;
    const pMean = pRms.reduce((a, b) => a + b, 0) / pRms.length;
    blinkRatio = fMean / (pMean + 1e-6);
  } else {
    const fFallback =
      rmsArr.slice(0, Math.min(2, numCh)).reduce((a, b) => a + b, 0) /
      Math.min(2, numCh);
    const pFallback =
      rmsArr.slice(Math.max(0, numCh - 2)).reduce((a, b) => a + b, 0) /
      Math.min(2, numCh);
    blinkRatio = fFallback / (pFallback + 1e-6);
  }

  // Hemispheric asymmetry
  const lRms = rmsArr.filter((_, i) => masks.lMask[i]);
  const rRms = rmsArr.filter((_, i) => masks.rMask[i]);
  let hemiAsym = 0;
  if (lRms.length > 0 && rRms.length > 0) {
    const lMean = lRms.reduce((a, b) => a + b, 0) / lRms.length;
    const rMean = rRms.reduce((a, b) => a + b, 0) / rRms.length;
    hemiAsym = Math.abs(lMean - rMean) / (lMean + rMean + 1e-6);
  }

  const features28 = [
    ...max12,
    ...mean12,
    focalCrest,
    recruitPct,
    blinkRatio,
    hemiAsym,
  ];

  return { features28, channelTkeo: rawTkeoArr, channelRms: rmsArr };
}

/**
 * Runs the MLP forward pass from edge_model.json:
 * 1. log1p on log1pFeatures
 * 2. (x - mean) / std
 * 3. Hidden layers with ReLU
 * 4. Output layer with Softmax -> [probNonSeizure, probSeizure]
 */
export function predictEdgeModelProbs(rawFeatures28: number[]): [number, number] {
  const { featureNames, preprocess, layers } = EDGE_MODEL;
  let h = new Array<number>(featureNames.length);

  for (let i = 0; i < featureNames.length; i++) {
    let val = rawFeatures28[i] ?? 0;
    if (!Number.isFinite(val)) val = 0;
    if (LOG1P_SET.has(featureNames[i])) {
      val = Math.log1p(Math.max(0, val));
    }
    const m = preprocess.mean[i] ?? 0;
    const s = preprocess.std[i] || 1;
    h[i] = (val - m) / s;
  }

  for (const layer of layers) {
    const outDim = Math.min(layer.W.length, layer.b.length);
    const next = new Array<number>(outDim);

    for (let o = 0; o < outDim; o++) {
      const row = layer.W[o];
      const inDim = Math.min(row.length, h.length);
      let sum = layer.b[o] ?? 0;
      for (let j = 0; j < inDim; j++) {
        sum += row[j] * h[j];
      }
      next[o] = layer.activation === "relu" ? Math.max(0, sum) : sum;
    }

    if (layer.activation === "softmax") {
      const maxLogit = Math.max(...next);
      const exps = next.map((z) => Math.exp(z - maxLogit));
      const sumExp = exps.reduce((a, b) => a + b, 0) || 1;
      const probs = exps.map((e) => e / sumExp);
      return [probs[0] ?? 0, probs[1] ?? 0];
    }

    h = next;
  }

  return [1, 0];
}

/**
 * Reads physical signal traces for the EEG Workspace display viewer.
 */
export async function readDisplaySignals(
  fileBlob: Blob,
  startSec: number,
  durationSec: number,
  filterOpts: {
    highPassHz: number | null;
    lowPassHz: number | null;
    notchHz: number | null;
  }
): Promise<Record<string, number[]>> {
  const edfFile = await openEdf(blobSource(fileBlob as File));
  const totalSec = getEdfTotalDurationSeconds(edfFile, fileBlob.size);
  const clampedStart = Math.max(0, Math.min(startSec, Math.max(0, totalSec - 1)));
  const clampedDur = Math.max(1, Math.min(durationSec, Math.max(1, totalSec - clampedStart)));

  const signals = edfFile.header.signals;
  const signalIndices = signals.map((s: any, idx: number) => s.index ?? idx);
  const chunks = await readWindow(edfFile, {
    signalIndices,
    startSeconds: clampedStart,
    durationSeconds: clampedDur,
  });

  const result: Record<string, number[]> = {};
  if (!chunks || chunks.length === 0) return result;

  for (let sIdx = 0; sIdx < signals.length; sIdx++) {
    const sigHeader = signals[sIdx];
    const parts: Float64Array[] = [];
    let totalLen = 0;

    for (const chunk of chunks) {
      const dig = chunk?.signals?.[sIdx]?.digital;
      if (dig && dig.length > 0) {
        const phys = Float64Array.from(toPhysical(sigHeader, dig));
        parts.push(phys);
        totalLen += phys.length;
      }
    }

    if (totalLen === 0) continue;
    const combined = new Float64Array(totalLen);
    let offset = 0;
    for (const p of parts) {
      combined.set(p, offset);
      offset += p.length;
    }

    // Remove DC mean & apply display filters
    let mean = 0;
    for (let i = 0; i < combined.length; i++) mean += combined[i];
    mean /= combined.length;
    for (let i = 0; i < combined.length; i++) combined[i] -= mean;

    const resampled = resampleTo256Hz(
      combined,
      sigHeader.sampleRateHz || 256,
      clampedDur
    );
    const filtered = filterChannel256Hz(resampled, filterOpts);

    // Downsample to 320 display points for crisp SVG rendering
    const pointsCount = 320;
    const step = Math.max(1, Math.floor(filtered.length / pointsCount));
    const downsampled: number[] = [];
    for (let i = 0; i < pointsCount; i++) {
      const idx = Math.min(filtered.length - 1, i * step);
      downsampled.push(filtered[idx]);
    }
    result[sigHeader.label] = downsampled;
  }

  return result;
}

/**
 * Full end-to-end screening pipeline on an uploaded EDF Recording using edge_model.json.
 * Saves the ScreeningSession and DetectedEvents to IndexedDB.
 */
export async function runEdgeScreeningOnRecording(
  recording: Recording,
  onProgress?: (percent: number) => void
): Promise<{ session: ScreeningSession; events: DetectedEvent[] }> {
  const startTimeMs = performance.now();
  const sessionId = crypto.randomUUID();

  const session: ScreeningSession = {
    id: sessionId,
    recording_id: recording.id,
    model_name: "NeuroEdge MLP",
    model_version: EDGE_MODEL.format || "mlp-v1",
    started_at: new Date(),
    preprocessing_config: {
      samplingRateHz: TARGET_FS,
      windowSeconds: WIN_SEC,
      highPassHz: 0.5,
      lowPassHz: 45,
      notchHz: 50,
      smoothingWindows: EDGE_MODEL.smoothing?.windows ?? 5,
      threshold: EDGE_MODEL.threshold,
    },
    status: "processing",
  };

  await db.screening_sessions.put(session);
  await db.recordings.update(recording.id, { screening_status: "processing" });

  onProgress?.(5);

  const edfFile = await openEdf(blobSource(recording.file_blob as File));
  const totalSec = Math.max(
    WIN_SEC,
    getEdfTotalDurationSeconds(edfFile, recording.file_blob.size)
  );

  // Filter valid EEG signals
  const allSignals = Array.from(edfFile.header.signals ?? []);
  let eegSignals = allSignals.filter((s) => {
    const lbl = String(s.label || "").toUpperCase().trim();
    return (
      lbl !== "-" &&
      lbl.length > 0 &&
      !NON_EEG_TOKENS.some((tok) => lbl.includes(tok))
    );
  });
  if (eegSignals.length === 0) {
    eegSignals = allSignals;
  }
  if (eegSignals.length > 22) {
    eegSignals = eegSignals.slice(0, 22);
  }

  const eegIndices = eegSignals.map((s) => s.index ?? allSignals.indexOf(s));
  const eegLabels = eegSignals.map((s) => String(s.label).trim());
  const isReferential = eegLabels.every((lbl) => !lbl.includes("-"));
  const masks = buildChannelMasks(eegLabels);

  // Read and scan in 60-second chunks so large recordings stay fast & memory-safe
  const CHUNK_SEC = 60;
  // Cap scan to up to 30 minutes (1800s) for instant UX, or full length if shorter
  const maxScanSec = Math.min(totalSec, 1800);
  const numChunks = Math.ceil(maxScanSec / CHUNK_SEC);

  let baseTKEO = 0;
  const trailingScores: number[] = [];
  const smoothWin = EDGE_MODEL.smoothing?.windows ?? 5;
  const threshold = EDGE_MODEL.threshold ?? 0.6902169685778347;

  type RawDetection = {
    startSec: number;
    endSec: number;
    type: "seizure_candidate" | "ied_candidate" | "artifact";
    confidence: number;
    channels: string[];
  };

  const windowDetections: RawDetection[] = [];
  let artifactWindows = 0;
  let totalWindows = 0;

  for (let cIdx = 0; cIdx < numChunks; cIdx++) {
    const chunkStart = cIdx * CHUNK_SEC;
    const chunkDur = Math.min(CHUNK_SEC, maxScanSec - chunkStart);
    if (chunkDur < WIN_SEC) break;

    const chunks = await readWindow(edfFile, {
      signalIndices: eegIndices,
      startSeconds: chunkStart,
      durationSeconds: chunkDur,
    });

    if (!chunks || chunks.length === 0) continue;

    // Assemble & filter each channel for this chunk
    const channelArrays: Float64Array[] = [];
    for (let s = 0; s < eegSignals.length; s++) {
      const sigHdr = eegSignals[s];
      const parts: Float64Array[] = [];
      let len = 0;
      for (const ch of chunks) {
        const dig = ch?.signals?.[s]?.digital;
        if (dig && dig.length > 0) {
          let phys = Float64Array.from(toPhysical(sigHdr, dig));
          // Convert mV to uV if unit is mV
          const unit = String(sigHdr.physicalDimension || sigHdr.unit || "uV").toLowerCase();
          if (unit === "mv") {
            for (let i = 0; i < phys.length; i++) phys[i] *= 1000;
          }
          parts.push(phys);
          len += phys.length;
        }
      }
      const merged = new Float64Array(len);
      let off = 0;
      for (const p of parts) {
        merged.set(p, off);
        off += p.length;
      }
      const resampled = resampleTo256Hz(
        merged,
        sigHdr.sampleRateHz || 256,
        chunkDur
      );
      channelArrays.push(filterChannel256Hz(resampled));
    }

    // Apply Common Average Reference (CAR) if referential montage
    const nSamples = channelArrays[0]?.length ?? 0;
    const nCh = channelArrays.length;
    if (isReferential && nCh > 2) {
      for (let i = 0; i < nSamples; i++) {
        let avg = 0;
        for (let c = 0; c < nCh; c++) avg += channelArrays[c][i];
        avg /= nCh;
        for (let c = 0; c < nCh; c++) channelArrays[c][i] -= avg;
      }
    }

    // Initialize calm baseline TKEO on the first chunk
    if (baseTKEO === 0 && nSamples >= WIN_SAMPLES) {
      const chTkeoMeans: number[] = [];
      for (let c = 0; c < nCh; c++) {
        const sig = channelArrays[c];
        let sumTk = 0;
        for (let i = 1; i < nSamples - 1; i++) {
          sumTk += Math.abs(sig[i] * sig[i] - sig[i - 1] * sig[i + 1]);
        }
        chTkeoMeans.push(sumTk / Math.max(1, nSamples - 2));
      }
      chTkeoMeans.sort((a, b) => a - b);
      baseTKEO = (chTkeoMeans[Math.floor(chTkeoMeans.length / 2)] ?? 1) + 1e-6;
    }

    // Step in 2-second windows across the chunk
    const numWinsInChunk = Math.floor(nSamples / WIN_SAMPLES);
    for (let w = 0; w < numWinsInChunk; w++) {
      totalWindows++;
      const sStart = w * WIN_SAMPLES;
      const winSegs = channelArrays.map((arr) =>
        arr.subarray(sStart, sStart + WIN_SAMPLES)
      );

      const { features28, channelTkeo, channelRms } = extract28Features(
        winSegs,
        baseTKEO,
        masks
      );

      const [, seizureProb] = predictEdgeModelProbs(features28);
      trailingScores.push(seizureProb);
      if (trailingScores.length > smoothWin) {
        trailingScores.shift();
      }
      const trailingMean =
        trailingScores.reduce((a, b) => a + b, 0) / trailingScores.length;

      const winStartSec = chunkStart + w * WIN_SEC;
      const winEndSec = winStartSec + WIN_SEC;

      // Top 3 most active channels in this window
      const rankedChannels = eegLabels
        .map((lbl, idx) => ({
          lbl,
          score: channelTkeo[idx] || channelRms[idx] || 0,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map((item) => item.lbl);

      const blinkRatio = features28[26];
      const recruitPct = features28[25];
      const maxRms = features28[1];
      const focalCrest = features28[24];

      if (trailingMean >= threshold) {
        windowDetections.push({
          startSec: winStartSec,
          endSec: winEndSec,
          type: "seizure_candidate",
          confidence: Math.max(seizureProb, trailingMean),
          channels: rankedChannels,
        });
      } else if (
        blinkRatio >= 3.2 ||
        (maxRms > 120 && recruitPct < 0.2 && seizureProb < 0.35)
      ) {
        artifactWindows++;
        windowDetections.push({
          startSec: winStartSec,
          endSec: winEndSec,
          type: "artifact",
          confidence: Math.min(0.99, blinkRatio / 5),
          channels: rankedChannels.slice(0, 2),
        });
      } else if (
        seizureProb >= 0.42 ||
        (focalCrest > 1.85 && recruitPct >= 0.25 && blinkRatio < 2.8)
      ) {
        windowDetections.push({
          startSec: winStartSec,
          endSec: winEndSec,
          type: "ied_candidate",
          confidence: Math.max(0.55, Math.min(0.94, seizureProb + 0.25)),
          channels: rankedChannels,
        });
      }
    }

    const pct = Math.min(95, Math.round(((cIdx + 1) / numChunks) * 90) + 5);
    onProgress?.(pct);
    // Yield to browser main thread so UI stays responsive
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  // Merge adjacent/nearby windows of the same type into clean clinical events
  const mergedEvents: RawDetection[] = [];
  for (const det of windowDetections) {
    const prev = mergedEvents[mergedEvents.length - 1];
    if (prev && prev.type === det.type && det.startSec - prev.endSec <= 4) {
      prev.endSec = det.endSec;
      prev.confidence = Math.max(prev.confidence, det.confidence);
      const chSet = new Set([...prev.channels, ...det.channels]);
      prev.channels = Array.from(chSet).slice(0, 4);
    } else {
      mergedEvents.push({ ...det });
    }
  }

  // Rank and cap events so the timeline stays focused on the highest-confidence events
  const seizures = mergedEvents
    .filter((e) => e.type === "seizure_candidate")
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 8);
  const ieds = mergedEvents
    .filter((e) => e.type === "ied_candidate")
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 8);
  const artifacts = mergedEvents
    .filter((e) => e.type === "artifact")
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);

  const finalDetections = [...seizures, ...ieds, ...artifacts].sort(
    (a, b) => a.startSec - b.startSec
  );

  const dbEvents: DetectedEvent[] = finalDetections.map((det) => ({
    id: crypto.randomUUID(),
    session_id: sessionId,
    event_type: det.type,
    start_time: det.startSec,
    end_time: det.endSec,
    channels: det.channels,
    confidence: Number(det.confidence.toFixed(4)),
    review_status: "pending",
    created_at: new Date(),
  }));

  const qualityScore = Math.max(
    60,
    Math.min(
      99,
      Math.round((1 - artifactWindows / Math.max(1, totalWindows)) * 100)
    )
  );
  const qualityStatus =
    qualityScore >= 85 ? "good" : qualityScore >= 70 ? "review_required" : "poor";

  const overallResult =
    seizures.length > 0 || ieds.length > 0
      ? "Candidate epileptiform activity detected"
      : "No epileptiform candidates above threshold";

  const completedSession: ScreeningSession = {
    ...session,
    completed_at: new Date(),
    status: "completed",
    overall_result: overallResult,
    quality_score: qualityScore,
    inference_duration: Math.round(performance.now() - startTimeMs),
  };

  await db.transaction(
    "rw",
    [db.recordings, db.screening_sessions, db.detected_events],
    async () => {
      // Remove older session events for this recording to avoid duplicates
      const oldSessions = await db.screening_sessions
        .where("recording_id")
        .equals(recording.id)
        .toArray();
      for (const old of oldSessions) {
        if (old.id !== sessionId) {
          await db.detected_events.where("session_id").equals(old.id).delete();
          await db.screening_sessions.delete(old.id);
        }
      }

      await db.screening_sessions.put(completedSession);
      if (dbEvents.length > 0) {
        await db.detected_events.bulkPut(dbEvents);
      }
      await db.recordings.update(recording.id, {
        duration: totalSec,
        quality_status: qualityStatus,
        screening_status:
          seizures.length > 0 || ieds.length > 0 ? "review_pending" : "screened",
      });
    }
  );

  onProgress?.(100);
  return { session: completedSession, events: dbEvents };
}