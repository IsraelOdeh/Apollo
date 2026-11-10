export type BrainRegionId = 'frontal' | 'parietal' | 'temporal' | 'occipital';

export type BrainRegion = {
  id: BrainRegionId;
  label: string;
  color: string;
  direction: [number, number, number];
};

export const BRAIN_REGIONS: BrainRegion[] = [
  { id: 'frontal', label: 'Frontal', color: '#42D9F5', direction: [0.25, 0.55, 0.8] },
  { id: 'parietal', label: 'Parietal', color: '#9D85FF', direction: [0.3, 0.8, 0.1] },
  { id: 'temporal', label: 'Temporal', color: '#36E0A1', direction: [0.85, -0.35, 0.25] },
  { id: 'occipital', label: 'Occipital', color: '#F6BD60', direction: [0.2, 0.1, -0.95] },
];

export const NEURAL_PATHWAYS: [number, number, number][][] = [
  [[-0.7, 0.4, 0.2], [-0.2, 0.8, 0.1], [0.4, 0.6, 0.5], [0.7, 0.3, 0.6]],
  [[-0.8, -0.2, 0.3], [-0.3, 0.1, 0.7], [0.2, 0.3, 0.8]],
  [[0.2, 0.9, -0.2], [0.5, 0.5, -0.6], [0.6, 0.1, -0.7]],
  [[-0.3, 0.7, -0.5], [-0.5, 0.2, -0.2], [-0.4, -0.3, 0.4]],
  [[0.5, 0.6, 0.6], [0.3, 0.2, 0.9], [-0.2, 0.0, 0.95]],
  [[0.8, -0.2, -0.3], [0.5, -0.4, -0.2], [0.1, -0.1, -0.9]],
];
