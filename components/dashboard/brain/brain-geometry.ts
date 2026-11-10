import * as THREE from 'three';

export const CORTEX_SCALE = new THREE.Vector3(1, 0.86, 1.22);

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function surfaceDisplacement(n: THREE.Vector3): number {
  const folds =
    0.035 * Math.sin(9 * n.x + 1.2) * Math.sin(7 * n.y + 0.4) * Math.sin(8 * n.z) +
    0.022 * Math.sin(13 * n.x * n.y + 5 * n.z) +
    0.018 * Math.cos(11 * n.y - 4 * n.z + 2 * n.x);
  const longitudinalFissure = -0.16 * Math.exp(-(n.x * n.x) / 0.006) * clamp01((n.y + 0.3) * 2);
  const temporalLobe = 0.06 * Math.exp(-((n.x - 0.8) ** 2 + (n.y + 0.35) ** 2) / 0.08);
  return folds + longitudinalFissure + temporalLobe;
}

export function surfacePoint(direction: THREE.Vector3, lift = 1): THREE.Vector3 {
  const n = direction.clone().normalize();
  const radius = (1 + surfaceDisplacement(n)) * lift;
  return n.multiplyScalar(radius).multiply(CORTEX_SCALE);
}

export function buildCortexGeometry(widthSegments: number, heightSegments: number): THREE.BufferGeometry {
  const geometry = new THREE.SphereGeometry(1, widthSegments, heightSegments);
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const vertex = new THREE.Vector3();

  for (let index = 0; index < position.count; index += 1) {
    vertex.fromBufferAttribute(position, index);
    const displaced = surfacePoint(vertex);
    position.setXYZ(index, displaced.x, displaced.y, displaced.z);
  }

  geometry.computeVertexNormals();
  return geometry;
}

export function buildCerebellumGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.SphereGeometry(0.36, 48, 32);
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const vertex = new THREE.Vector3();

  for (let index = 0; index < position.count; index += 1) {
    vertex.fromBufferAttribute(position, index);
    const n = vertex.clone().normalize();
    const radius = 1 + 0.07 * Math.sin(28 * n.y + 6 * n.x) * Math.cos(20 * n.z);
    position.setXYZ(index, n.x * radius, n.y * radius * 0.7, n.z * radius * 0.9);
  }

  geometry.computeVertexNormals();
  return geometry;
}
