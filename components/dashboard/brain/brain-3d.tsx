'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import {
  buildCerebellumGeometry,
  buildCortexGeometry,
  surfacePoint,
} from './brain-geometry';
import { BRAIN_REGIONS, NEURAL_PATHWAYS, type BrainRegionId } from './brain-regions';

const BASE_DISTANCE = 4.4;
const CORTEX_RADIUS_LIFT = 1.04;

type Brain3DProps = {
  activeRegion: BrainRegionId | null;
  allRegionsActive: boolean;
  zoom: number;
  animate: boolean;
  onRegionHover: (region: BrainRegionId | null) => void;
};

export function Brain3D({ activeRegion, allRegionsActive, zoom, animate, onRegionHover }: Brain3DProps) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0.5, BASE_DISTANCE], fov: 38 }}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.35} />
      <pointLight position={[3, 2, 3]} intensity={1.4} color="#42D9F5" />
      <pointLight position={[-3, 1, -2]} intensity={1} color="#9D85FF" />
      <pointLight position={[0, -2, 2]} intensity={0.6} color="#36E0A1" />

      <CameraRig zoom={zoom} />
      <OrbitControls
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={2.4}
        maxDistance={6}
        autoRotate={animate}
        autoRotateSpeed={0.5}
      />

      <BrainModel
        activeRegion={activeRegion}
        allRegionsActive={allRegionsActive}
        animate={animate}
        onRegionHover={onRegionHover}
      />
    </Canvas>
  );
}

function CameraRig({ zoom }: { zoom: number }) {
  const camera = useThree((state) => state.camera);

  useEffect(() => {
    camera.position.setLength(BASE_DISTANCE / zoom);
  }, [camera, zoom]);

  return null;
}

type BrainModelProps = Omit<Brain3DProps, 'zoom'>;

function BrainModel({ activeRegion, allRegionsActive, animate, onRegionHover }: BrainModelProps) {
  const cortexGeometry = useMemo(() => buildCortexGeometry(160, 120), []);
  const wireGeometry = useMemo(() => buildCortexGeometry(56, 40), []);
  const cerebellumGeometry = useMemo(() => buildCerebellumGeometry(), []);
  const haloGeometry = useMemo(() => buildCortexGeometry(64, 48), []);
  const cortexMaterialRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    const material = cortexMaterialRef.current;
    if (!material) return;
    material.emissiveIntensity = animate
      ? 0.22 + 0.12 * (Math.sin(clock.elapsedTime * 1.4) + 1) / 2
      : 0.3;
  });

  return (
    <group rotation={[0.12, -0.35, 0]} position={[0, -0.1, 0]}>
      <mesh geometry={haloGeometry} scale={1.12}>
        <meshBasicMaterial
          color="#42D9F5"
          transparent
          opacity={0.05}
          side={THREE.BackSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <mesh geometry={cortexGeometry}>
        <meshStandardMaterial
          ref={cortexMaterialRef}
          color="#7FD8E8"
          emissive="#42D9F5"
          emissiveIntensity={0.25}
          transparent
          opacity={0.3}
          roughness={0.35}
          depthWrite={false}
        />
      </mesh>

      <mesh geometry={wireGeometry} scale={1.005}>
        <meshBasicMaterial color="#36E0A1" wireframe transparent opacity={0.16} depthWrite={false} />
      </mesh>

      <mesh geometry={cerebellumGeometry} position={[0, -0.62, -0.92]} rotation={[0.2, 0, 0]}>
        <meshStandardMaterial color="#7FD8E8" emissive="#42D9F5" emissiveIntensity={0.18} transparent opacity={0.26} depthWrite={false} />
      </mesh>

      <mesh position={[0, -0.95, -0.35]} rotation={[0.25, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.07, 0.8, 24]} />
        <meshStandardMaterial color="#7FD8E8" emissive="#42D9F5" emissiveIntensity={0.15} transparent opacity={0.24} depthWrite={false} />
      </mesh>

      {NEURAL_PATHWAYS.map((waypoints, index) => (
        <NeuralPathway
          key={index}
          waypoints={waypoints}
          color={index % 2 === 0 ? '#42D9F5' : '#36E0A1'}
          speed={0.05 + (index % 3) * 0.02}
          offset={index * 0.17}
          animate={animate}
        />
      ))}

      {BRAIN_REGIONS.map((region) => (
        <RegionGlow
          key={region.id}
          id={region.id}
          color={region.color}
          direction={region.direction}
          active={allRegionsActive || activeRegion === region.id}
          animate={animate}
          onHover={onRegionHover}
        />
      ))}
    </group>
  );
}

type NeuralPathwayProps = {
  waypoints: [number, number, number][];
  color: string;
  speed: number;
  offset: number;
  animate: boolean;
};

function NeuralPathway({ waypoints, color, speed, offset, animate }: NeuralPathwayProps) {
  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3(
        waypoints.map(([x, y, z]) => surfacePoint(new THREE.Vector3(x, y, z), CORTEX_RADIUS_LIFT)),
      ),
    [waypoints],
  );
  const tubeGeometry = useMemo(() => new THREE.TubeGeometry(curve, 80, 0.006, 6, false), [curve]);
  const pulseRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const pulse = pulseRef.current;
    if (!pulse || !animate) return;
    const progress = (clock.elapsedTime * speed + offset) % 1;
    curve.getPointAt(progress, pulse.position);
  });

  return (
    <group>
      <mesh geometry={tubeGeometry}>
        <meshBasicMaterial color={color} transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={pulseRef}>
        <sphereGeometry args={[0.026, 12, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.95} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

type RegionGlowProps = {
  id: BrainRegionId;
  color: string;
  direction: [number, number, number];
  active: boolean;
  animate: boolean;
  onHover: (region: BrainRegionId | null) => void;
};

function RegionGlow({ id, color, direction, active, animate, onHover }: RegionGlowProps) {
  const position = useMemo(
    () => surfacePoint(new THREE.Vector3(...direction), CORTEX_RADIUS_LIFT),
    [direction],
  );
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const glow = glowRef.current;
    if (!glow) return;
    const pulse = active && animate ? 1 + 0.12 * Math.sin(clock.elapsedTime * 2.2) : 1;
    glow.scale.setScalar(pulse);
  });

  return (
    <group position={position}>
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.2, 24, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={active ? 0.4 : 0.12}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh
        onPointerOver={(event) => {
          event.stopPropagation();
          onHover(id);
        }}
        onPointerOut={() => onHover(null)}
      >
        <sphereGeometry args={[0.2, 16, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}
