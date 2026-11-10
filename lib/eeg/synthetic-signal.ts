export type EegBand = 'delta' | 'theta' | 'alpha' | 'beta' | 'gamma';

export const EEG_BAND_SYMBOL: Record<EegBand, string> = {
  delta: 'δ',
  theta: 'θ',
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
};

const BAND_FREQUENCY_HZ: Record<EegBand, number> = {
  delta: 2.2,
  theta: 5.4,
  alpha: 10.2,
  beta: 19.5,
  gamma: 30,
};

const BAND_AMPLITUDE: Record<EegBand, number> = {
  delta: 1,
  theta: 0.7,
  alpha: 0.6,
  beta: 0.38,
  gamma: 0.22,
};

function seededNoise(index: number, seed: number): number {
  const value = Math.sin(index * 12.9898 + seed * 78.233) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
}

type SignalOptions = {
  points: number;
  shift?: number;
  seed?: number;
};

export function generateBandSignal(
  band: EegBand,
  { points, shift = 0, seed = 1 }: SignalOptions,
): number[] {
  const frequency = BAND_FREQUENCY_HZ[band];
  const amplitude = BAND_AMPLITUDE[band];

  return Array.from({ length: points }, (_, index) => {
    const t = (index / points) * 2 + shift;
    const carrier =
      Math.sin(2 * Math.PI * frequency * t) +
      0.4 * Math.sin(2 * Math.PI * frequency * 1.6 * t + 1.3);
    return amplitude * (0.8 * carrier + 0.25 * seededNoise(index, seed));
  });
}

export function rootMeanSquare(values: number[]): number {
  const sumOfSquares = values.reduce((sum, value) => sum + value * value, 0);
  return Math.sqrt(sumOfSquares / values.length);
}
