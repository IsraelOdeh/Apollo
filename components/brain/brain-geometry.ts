import * as THREE from 'three';
import {
  mergeGeometries,
  mergeVertices,
} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Procedural template brain.
 *
 * Coordinates: +y up, +z anterior (towards the frontal pole), +x is the
 * subject's LEFT. One unit is roughly 5.5 cm, so the whole brain is about
 * 3.1 units long. Everything is generated in code, no model files needed.
 *
 * This is a stylised template, not a subject-specific or atlas-registered
 * surface. Do not use it to make clinical claims.
 */

export type Vec3 = [number, number, number];

export const CEREBRUM_CENTER = new THREE.Vector3(0, 0.05, 0);
export const CEREBELLUM_CENTER = new THREE.Vector3(0, -0.63, -0.94);
export const ORBIT_TARGET = new THREE.Vector3(0, -0.12, 0);

/* ------------------------------------------------------------------ */
/* Small maths helpers                                                 */
/* ------------------------------------------------------------------ */

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** smoothstep that also behaves for reversed edges (e0 > e1) */
export const sstep = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seeded 3D simplex noise, returns roughly -1..1 */
export function createNoise3D(seed: number) {
  const rnd = mulberry32(seed);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = p[i];
    p[i] = p[j];
    p[j] = t;
  }
  const perm = new Uint8Array(512);
  const permMod12 = new Uint8Array(512);
  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255];
    permMod12[i] = perm[i] % 12;
  }
  const grad3 = new Float32Array([
    1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0,
    -1, 0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1,
  ]);
  const F3 = 1 / 3;
  const G3 = 1 / 6;

  return (xin: number, yin: number, zin: number): number => {
    let n0 = 0,
      n1 = 0,
      n2 = 0,
      n3 = 0;
    const s = (xin + yin + zin) * F3;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const k = Math.floor(zin + s);
    const t = (i + j + k) * G3;
    const x0 = xin - (i - t);
    const y0 = yin - (j - t);
    const z0 = zin - (k - t);
    let i1: number, j1: number, k1: number, i2: number, j2: number, k2: number;
    if (x0 >= y0) {
      if (y0 >= z0) {
        i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0;
      } else if (x0 >= z0) {
        i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1;
      } else {
        i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1;
      }
    } else if (y0 < z0) {
      i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1;
    } else if (x0 < z0) {
      i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1;
    } else {
      i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0;
    }
    const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3;
    const x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3;
    const ii = i & 255, jj = j & 255, kk = k & 255;
    const g0 = permMod12[ii + perm[jj + perm[kk]]] * 3;
    const g1 = permMod12[ii + i1 + perm[jj + j1 + perm[kk + k1]]] * 3;
    const g2 = permMod12[ii + i2 + perm[jj + j2 + perm[kk + k2]]] * 3;
    const g3 = permMod12[ii + 1 + perm[jj + 1 + perm[kk + 1]]] * 3;
    let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
    if (t0 >= 0) {
      t0 *= t0;
      n0 = t0 * t0 * (grad3[g0] * x0 + grad3[g0 + 1] * y0 + grad3[g0 + 2] * z0);
    }
    let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
    if (t1 >= 0) {
      t1 *= t1;
      n1 = t1 * t1 * (grad3[g1] * x1 + grad3[g1 + 1] * y1 + grad3[g1 + 2] * z1);
    }
    let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
    if (t2 >= 0) {
      t2 *= t2;
      n2 = t2 * t2 * (grad3[g2] * x2 + grad3[g2 + 1] * y2 + grad3[g2 + 2] * z2);
    }
    let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
    if (t3 >= 0) {
      t3 *= t3;
      n3 = t3 * t3 * (grad3[g3] * x3 + grad3[g3 + 1] * y3 + grad3[g3 + 2] * z3);
    }
    return 32 * (n0 + n1 + n2 + n3);
  };
}

/* ------------------------------------------------------------------ */
/* Cerebral hemisphere                                                 */
/* ------------------------------------------------------------------ */

const MED_OFFSET = 0.095; // half of the interhemispheric gap + squeezed medial wall
const AX_LAT = 1.2;
const AX_MED = 0.07;
const AX_UP = 0.98;
const AX_DN = 0.55;
const AX_Z = 1.55;

function radii(zn: number, up: boolean) {
  const front = sstep(0.1, 1.0, zn);
  const rear = sstep(-0.3, -1.0, zn);
  const lat = AX_LAT * (1 - 0.26 * front - 0.12 * rear);
  const ay = up
    ? AX_UP * (1 - 0.1 * sstep(0.45, 1, zn) - 0.14 * rear)
    : AX_DN * (1 - 0.1 * rear);
  return { lat, ay };
}

/**
 * Base (un-folded) surface of one hemisphere. `d` is a unit direction,
 * x > 0 is lateral. Output is in "left hemisphere" space (x >= 0).
 */
function cerebrumBase(d: THREE.Vector3, out: THREE.Vector3, nrm: THREE.Vector3) {
  const { lat, ay } = radii(d.z, d.y > 0);
  const ax = d.x > 0 ? lat : AX_MED;
  let x = (d.x > 0 ? Math.pow(d.x, 0.9) : d.x) * ax;
  let y = (d.y > 0 ? Math.pow(d.y, 0.92) : d.y) * ay;
  const z = d.z * AX_Z;

  // temporal lobe: lateral-inferior bulge between the poles
  const tb = sstep(0.05, -0.38, d.y) * sstep(0.1, 0.55, d.x);
  const tz = sstep(-0.78, -0.4, d.z) * sstep(0.66, 0.34, d.z);
  const tw = tb * tz;
  y -= 0.24 * tw;
  x += 0.07 * tw;
  // orbitofrontal surface sits higher than the temporal pole
  y += 0.1 * sstep(0.3, 0.7, d.z) * sstep(-0.1, -0.5, d.y);

  out.set(x + MED_OFFSET, y, z);
  nrm.set(d.x / ax, d.y / ay, d.z / AX_Z).normalize();
}

interface LandmarkDef {
  dirs: Vec3[];
  w: number;
  depth: number;
  bw: number;
  bdepth: number;
}

const LANDMARK_DEFS: LandmarkDef[] = [
  // central sulcus
  { dirs: [[0.1, 1, -0.1], [0.35, 0.9, -0.02], [0.65, 0.68, 0.08], [0.82, 0.42, 0.14]], w: 0.03, depth: 0.065, bw: 0.09, bdepth: 0.012 },
  // lateral (sylvian) fissure
  { dirs: [[0.7, -0.3, 0.7], [0.88, -0.12, 0.4], [0.95, 0, 0.05], [0.9, 0.12, -0.3], [0.8, 0.3, -0.5], [0.7, 0.42, -0.62]], w: 0.05, depth: 0.11, bw: 0.15, bdepth: 0.035 },
  // superior temporal sulcus
  { dirs: [[0.8, -0.55, 0.3], [0.85, -0.45, -0.2], [0.75, -0.25, -0.6]], w: 0.032, depth: 0.05, bw: 0.08, bdepth: 0 },
  // parieto-occipital sulcus
  { dirs: [[0.12, 0.85, -0.55], [0.3, 0.6, -0.78]], w: 0.03, depth: 0.06, bw: 0.08, bdepth: 0 },
];

interface Landmark extends LandmarkDef {
  pts: THREE.Vector3[];
}

let landmarkCache: Landmark[] | null = null;
function landmarks(): Landmark[] {
  if (!landmarkCache) {
    const d = new THREE.Vector3();
    const o = new THREE.Vector3();
    const n = new THREE.Vector3();
    landmarkCache = LANDMARK_DEFS.map((def) => ({
      ...def,
      pts: def.dirs.map((v) => {
        d.set(v[0], v[1], v[2]).normalize();
        cerebrumBase(d, o, n);
        return o.clone();
      }),
    }));
  }
  return landmarkCache;
}

const _ab = new THREE.Vector3();
const _ap = new THREE.Vector3();
function distToPolyline(p: THREE.Vector3, pts: THREE.Vector3[]) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    _ab.subVectors(pts[i + 1], a);
    _ap.subVectors(p, a);
    const t = clamp01(_ap.dot(_ab) / _ab.lengthSq());
    const dx = _ap.x - _ab.x * t;
    const dy = _ap.y - _ab.y * t;
    const dz = _ap.z - _ab.z * t;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 < best) best = d2;
  }
  return Math.sqrt(best);
}

/** Gyri and sulci: thin grooves along the zero-crossings of warped noise. */
function foldAt(
  p: THREE.Vector3,
  dx: number,
  noise: (x: number, y: number, z: number) => number,
  lms: Landmark[],
) {
  const wf = 1.3;
  const wa = 0.3;
  const qx = p.x + noise(p.x * wf + 4.1, p.y * wf, p.z * wf) * wa;
  const qy = p.y + noise(p.x * wf, p.y * wf + 8.3, p.z * wf) * wa;
  const qz = p.z + noise(p.x * wf, p.y * wf, p.z * wf + 2.9) * wa;

  const n1 = noise(qx * 2.7, qy * 2.7, qz * 2.7);
  const n2 = noise(qx * 5.6 + 17, qy * 5.6, qz * 5.6);
  const g1 = 1 - sstep(0, 0.16, Math.abs(n1));
  const g2 = 1 - sstep(0, 0.12, Math.abs(n2));

  // medial wall carries fewer, shallower folds
  const amp = 1 - 0.7 * sstep(0.0, -0.12, dx);

  let groove = (0.075 * g1 + 0.04 * g2 * (1 - g1)) * amp;
  let lm = 0;
  for (const l of lms) {
    const dist = distToPolyline(p, l.pts);
    lm +=
      l.depth * Math.exp(-((dist / l.w) ** 2)) +
      l.bdepth * Math.exp(-((dist / l.bw) ** 2));
  }
  groove += lm;

  const undulation = 0.025 * noise(p.x * 0.9 + 31, p.y * 0.9, p.z * 0.9);
  return {
    disp: -groove + undulation,
    crest: clamp01(1 - (g1 * amp + 0.55 * g2 * amp + lm * 9)),
  };
}

function unitSphere(detail: number) {
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g, 1e-5);
  return g;
}

function buildHemisphere(side: 1 | -1, detail: number, seed: number) {
  const noise = createNoise3D(seed);
  const lms = landmarks();
  const g = unitSphere(detail);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const fold = new Float32Array(pos.count);
  const d = new THREE.Vector3();
  const base = new THREE.Vector3();
  const nrm = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    d.fromBufferAttribute(pos, i);
    cerebrumBase(d, base, nrm);
    const f = foldAt(base, d.x, noise, lms);
    base.addScaledVector(nrm, f.disp);
    pos.setXYZ(i, side * base.x, base.y, base.z);
    fold[i] = f.crest;
  }
  g.setAttribute('aFold', new THREE.BufferAttribute(fold, 1));

  if (side < 0) {
    // mirroring flips winding; flip it back so normals point outwards
    const idx = g.getIndex()!;
    for (let i = 0; i < idx.count; i += 3) {
      const b = idx.getX(i + 1);
      const c = idx.getX(i + 2);
      idx.setX(i + 1, c);
      idx.setX(i + 2, b);
    }
  }
  g.computeVertexNormals();
  return g;
}

/* ------------------------------------------------------------------ */
/* Cerebellum and brainstem                                            */
/* ------------------------------------------------------------------ */

function buildCerebellum(detail: number) {
  const noise = createNoise3D(777);
  const g = unitSphere(detail);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const fold = new Float32Array(pos.count);
  const d = new THREE.Vector3();
  const n = new THREE.Vector3();
  const RX = 0.92;
  const RZ = 0.52;

  for (let i = 0; i < pos.count; i++) {
    d.fromBufferAttribute(pos, i);
    const ry = d.y > 0 ? 0.3 : 0.38;
    n.set(d.x / RX, d.y / ry, d.z / RZ).normalize();

    // folia: stripes running left to right across the surface
    const ang = Math.atan2(d.y * 1.4, -d.z);
    const r = Math.sin(ang * 26 + noise(d.x * 2, d.y * 2, d.z * 2) * 2.2 + Math.abs(d.x) * 3);
    const ridge = 0.5 + 0.5 * r;
    const vermis = Math.exp(-(((d.x * RX) / 0.045) ** 2));
    const disp = 0.016 * (ridge - 0.5) - 0.03 * vermis;

    pos.setXYZ(
      i,
      d.x * RX + n.x * disp + CEREBELLUM_CENTER.x,
      d.y * ry + n.y * disp + CEREBELLUM_CENTER.y,
      d.z * RZ + n.z * disp + CEREBELLUM_CENTER.z,
    );
    fold[i] = 0.15 + 0.85 * ridge * (1 - 0.5 * vermis);
  }
  g.setAttribute('aFold', new THREE.BufferAttribute(fold, 1));
  g.computeVertexNormals();
  return g;
}

function buildStem() {
  let g: THREE.BufferGeometry = new THREE.CylinderGeometry(0.2, 0.12, 1, 40, 36, true);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g, 1e-5);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const fold = new Float32Array(pos.count);
  const m = new THREE.Matrix4()
    .makeTranslation(0, -0.93, -0.3)
    .multiply(new THREE.Matrix4().makeRotationX(0.3));
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const t = v.y + 0.5; // 0 bottom .. 1 top
    const r0 = Math.hypot(v.x, v.z) || 1;
    const ang = Math.atan2(v.z, v.x);
    const ridge = 0.5 + 0.5 * Math.sin(ang * 6);
    const r = 0.115 + 0.065 * t + 0.07 * Math.exp(-(((t - 0.62) / 0.13) ** 2)) + 0.008 * ridge;
    v.x *= r / r0;
    v.z *= r / r0;
    v.applyMatrix4(m);
    pos.setXYZ(i, v.x, v.y, v.z);
    fold[i] = 0.35 + 0.5 * ridge;
  }
  g.setAttribute('aFold', new THREE.BufferAttribute(fold, 1));
  g.computeVertexNormals();
  return g;
}

/* ------------------------------------------------------------------ */
/* Public builders                                                     */
/* ------------------------------------------------------------------ */

export interface BrainModel {
  /** all surfaces merged into one geometry (cerebrum, cerebellum, stem) */
  surface: THREE.BufferGeometry;
  /** vertex positions used to snap electrodes and regions onto the cortex */
  cerebrumVerts: Float32Array;
  cerebellumVerts: Float32Array;
}

export function buildBrain(detail = 56): BrainModel {
  const left = buildHemisphere(1, detail, 1337);
  const right = buildHemisphere(-1, detail, 4242);
  const cerebellum = buildCerebellum(Math.max(24, Math.round(detail * 0.8)));
  const stem = buildStem();

  const lv = (left.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
  const rv = (right.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
  const cerebrumVerts = new Float32Array(lv.length + rv.length);
  cerebrumVerts.set(lv, 0);
  cerebrumVerts.set(rv, lv.length);
  const cerebellumVerts = Float32Array.from(
    (cerebellum.getAttribute('position') as THREE.BufferAttribute).array as Float32Array,
  );

  const surface = mergeGeometries([left, right, cerebellum, stem], false)!;
  [left, right, cerebellum, stem].forEach((g) => g.dispose());
  return { surface, cerebrumVerts, cerebellumVerts };
}

/**
 * Nearest vertex to `origin` that lies close to the ray origin -> target.
 * Used to drop an electrode (or region anchor) onto the cortical surface.
 */
export function projectToSurface(
  verts: Float32Array,
  origin: THREE.Vector3,
  target: THREE.Vector3,
  tolerance = 0.09,
): THREE.Vector3 {
  const dir = target.clone().sub(origin).normalize();
  for (let attempt = 0; attempt < 4; attempt++) {
    const tol2 = tolerance * tolerance * (1 + attempt * 2);
    let best = -1;
    let bestT = Infinity;
    for (let i = 0; i < verts.length; i += 3) {
      const rx = verts[i] - origin.x;
      const ry = verts[i + 1] - origin.y;
      const rz = verts[i + 2] - origin.z;
      const t = rx * dir.x + ry * dir.y + rz * dir.z;
      if (t <= 0 || t >= bestT) continue;
      if (rx * rx + ry * ry + rz * rz - t * t < tol2) {
        best = i;
        bestT = t;
      }
    }
    if (best >= 0) return new THREE.Vector3(verts[best], verts[best + 1], verts[best + 2]);
  }
  return target.clone();
}

/* ------------------------------------------------------------------ */
/* Schematic white-matter pathways                                     */
/* ------------------------------------------------------------------ */

/** Pull a point back inside the cerebral volume if it sits outside. */
function clampInside(p: Vec3): Vec3 {
  const [x, y, z] = p;
  if (y < -0.45) return p; // brainstem / cerebellar territory
  const ax = Math.abs(x);
  const { lat, ay } = radii(z / AX_Z, y > 0);
  const lx = Math.max(0, ax - MED_OFFSET);
  const e = (lx / lat) ** 2 + (y / ay) ** 2 + (z / AX_Z) ** 2;
  const limit = 0.72;
  if (e <= limit) return p;
  const s = Math.sqrt(limit / e);
  return [Math.sign(x || 1) * (MED_OFFSET + lx * s), y * s, z * s];
}

/**
 * Hand-placed, stylised fibre bundles: corpus callosum, long association
 * tracts, corona radiata, cerebellar peduncles. Purely illustrative, this is
 * NOT tractography and is not derived from diffusion imaging.
 */
export function buildPathways(seed = 11): THREE.BufferGeometry {
  const rnd = mulberry32(seed);
  const R = (a: number, b: number) => a + (b - a) * rnd();
  const geos: THREE.BufferGeometry[] = [];

  const add = (pts: Vec3[], tone: number, speed: number, clamp = true) => {
    const fixed = clamp ? pts.map(clampInside) : pts;
    const curve = new THREE.CatmullRomCurve3(
      fixed.map((p) => new THREE.Vector3(p[0], p[1], p[2])),
      false,
      'catmullrom',
      0.5,
    );
    const g = new THREE.TubeGeometry(curve, 56, 0.0055, 3, false);
    const n = g.getAttribute('position').count;
    const phase = new Float32Array(n).fill(rnd());
    const toneA = new Float32Array(n).fill(tone);
    const spd = new Float32Array(n).fill(speed * R(0.8, 1.25));
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    g.setAttribute('aTone', new THREE.BufferAttribute(toneA, 1));
    g.setAttribute('aSpeed', new THREE.BufferAttribute(spd, 1));
    geos.push(g);
  };

  const jit = (p: Vec3, a: number): Vec3 => [p[0] + R(-a, a), p[1] + R(-a, a), p[2] + R(-a, a)];
  const mirror = (pts: Vec3[]): Vec3[] => pts.map((p) => [-p[0], p[1], p[2]]);

  // corpus callosum: arcs crossing the midline
  for (let i = 0; i < 30; i++) {
    const z = -1.05 + (i / 29) * 2.15 + R(-0.03, 0.03);
    const zn = z / AX_Z;
    const w = Math.sqrt(Math.max(0.12, 1 - zn * zn)) * (z > 0 ? 0.9 : 1);
    const xe = R(0.72, 1.0) * w * 1.05;
    const ye = R(0.3, 0.62) * (1 - 0.35 * Math.abs(zn));
    const apex = 0.16 + 0.08 * (1 - Math.abs(zn)) + R(-0.02, 0.02);
    add(
      [
        [-xe, ye, z],
        [-xe * 0.62, ye * 0.55 + apex * 0.5, z + R(-0.02, 0.02)],
        [-xe * 0.22, apex, z],
        [0, apex * 0.98, z],
        [xe * 0.22, apex, z],
        [xe * 0.62, ye * 0.55 + apex * 0.5, z + R(-0.02, 0.02)],
        [xe, ye, z],
      ],
      0,
      0.18,
    );
  }

  // association tracts (left hemisphere, mirrored for the right)
  const assoc: Vec3[][] = [
    [[0.85, 0.55, 1.05], [1.0, 0.62, 0.45], [1.05, 0.6, -0.2], [0.95, 0.5, -0.8]], // superior longitudinal
    [[0.8, 0.45, 0.95], [1.0, 0.62, 0.3], [1.08, 0.42, -0.3], [1.05, -0.2, -0.25]], // arcuate
    [[0.65, 0.2, 1.2], [0.82, 0.12, 0.3], [0.78, 0.12, -0.5], [0.55, 0.2, -1.2]], // fronto-occipital
    [[0.55, -0.1, 1.1], [0.8, -0.22, 0.7], [1.0, -0.35, 0.45], [1.05, -0.4, 0.1]], // uncinate
    [[1.0, -0.4, 0.3], [1.0, -0.25, -0.4], [0.8, -0.05, -1.0], [0.55, 0.1, -1.3]], // inferior longitudinal
    [[0.18, 0.45, 1.1], [0.2, 0.48, 0.4], [0.2, 0.42, -0.4], [0.25, 0.1, -0.9], [0.45, -0.2, -0.5]], // cingulum
    [[0.95, -0.1, 0.1], [0.85, -0.02, -0.5], [0.6, 0.08, -1.0], [0.4, 0.1, -1.35]], // optic radiation
  ];
  assoc.forEach((tract, fam) => {
    for (let k = 0; k < 5; k++) {
      const pts = tract.map((p) => jit(p, 0.07));
      const tone = fam === 6 ? 2 : 1;
      add(pts, tone, 0.22);
      add(mirror(pts.map((p) => jit(p, 0.03))), tone, 0.22);
    }
  });

  // projection fibres: cortex -> internal capsule -> brainstem
  for (let i = 0; i < 34; i++) {
    const z0 = -0.95 + 1.9 * rnd() + R(-0.05, 0.05);
    const zn = z0 / AX_Z;
    const x0 = R(0.2, 0.95) * Math.sqrt(Math.max(0.15, 1 - zn * zn));
    const y0 = 0.85 * Math.sqrt(Math.max(0.05, 1 - (x0 / 1.2) ** 2 - zn * zn));
    const pts: Vec3[] = [
      [x0, y0, z0],
      [x0 * 0.55 + 0.1, y0 * 0.45 + 0.02, z0 * 0.7],
      [0.26 + R(-0.04, 0.04), 0.02, z0 * 0.2 - 0.05],
      [0.16 + R(-0.03, 0.03), -0.45, -0.22 + R(-0.03, 0.03)],
      [0.05 + R(-0.02, 0.02), -0.85, -0.38],
    ];
    add(pts, 2, 0.27);
    add(mirror(pts), 2, 0.27);
  }

  // cerebellar peduncles
  for (let i = 0; i < 4; i++) {
    const pts: Vec3[] = [
      [0.04, -0.8, -0.4],
      [0.3 + R(-0.05, 0.05), -0.75, -0.7],
      [0.6 + R(-0.08, 0.08), -0.72 + R(-0.05, 0.05), -1.0 + R(-0.05, 0.05)],
    ];
    add(pts, 1, 0.2, false);
    add(mirror(pts), 1, 0.2, false);
  }

  const merged = mergeGeometries(geos, false)!;
  geos.forEach((g) => g.dispose());
  return merged;
}
