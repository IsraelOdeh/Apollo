'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Billboard, Html, Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import {
  CEREBELLUM_CENTER,
  CEREBRUM_CENTER,
  ORBIT_TARGET,
  buildBrain,
  buildPathways,
  projectToSurface,
  type Vec3,
} from './brain-geometry';
import {
  HUE_HEX,
  REGIONS,
  regionByKey,
  regionHue,
  type DetectedEvent,
  type Electrode,
  type Hue,
  type RegionKey,
  type Selection,
  type ViewMode,
} from './brain-data';
import styles from './BrainViewer.module.css';

const SPOTS = 32;

/* ------------------------------------------------------------------ */
/* Shaders                                                             */
/* ------------------------------------------------------------------ */

const CORTEX_VERT = /* glsl */ `
#define N ${SPOTS}
uniform vec4 uSpots[N];
uniform vec4 uSpotData[N]; // x intensity, y hue (0,1,2 palette, 3 white), z ring flag
uniform vec3 uPurple;
uniform vec3 uCyan;
uniform vec3 uEmerald;
attribute float aFold;
varying vec3 vN;
varying vec3 vV;
varying vec3 vP;
varying vec3 vGlow;
varying float vFold;

vec3 hueColor(float h) {
  if (h < 0.5) return uPurple;
  if (h < 1.5) return uCyan;
  if (h < 2.5) return uEmerald;
  return vec3(1.0);
}

void main() {
  vP = position;
  vFold = aFold;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = -mv.xyz;

  vec3 glow = vec3(0.0);
  for (int i = 0; i < N; i++) {
    float I = uSpotData[i].x;
    if (I > 0.002) {
      float r = uSpots[i].w;
      float d = distance(position, uSpots[i].xyz);
      float g = exp(-(d * d) / (r * r));
      vec3 c = hueColor(uSpotData[i].y);
      glow += c * g * I;
      if (uSpotData[i].z > 0.5) {
        float rr = (d - r * 1.15) / (r * 0.22);
        glow += vec3(1.0) * exp(-rr * rr) * I * 0.8;
      }
    }
  }
  vGlow = glow;
  gl_Position = projectionMatrix * mv;
}
`;

const CORTEX_FRAG = /* glsl */ `
uniform float uPulse;
uniform float uDim;
uniform float uExposure;
uniform vec3 uPurple;
uniform vec3 uCyan;
uniform vec3 uEmerald;
varying vec3 vN;
varying vec3 vV;
varying vec3 vP;
varying vec3 vGlow;
varying float vFold;

void main() {
  vec3 n = normalize(vN);
  vec3 v = normalize(vV);
  float ndvs = dot(n, v);
  float facing = ndvs > 0.0 ? 1.0 : 0.38;   // far wall shows through, dimmer
  float ndv = abs(ndvs);
  float rim = pow(1.0 - ndv, 2.4);
  float crest = smoothstep(0.08, 0.9, vFold);

  // purple at the front, cyan through the middle, emerald at the back
  vec3 tint = mix(uCyan, uPurple, smoothstep(0.0, 1.0, vP.z));
  tint = mix(tint, uEmerald, 1.0 - smoothstep(-1.3, -0.2, vP.z));
  tint = mix(tint, uPurple, 0.22 * smoothstep(0.2, 0.95, vP.y));

  vec3 nf = ndvs > 0.0 ? n : -n;
  float diff = max(dot(nf, normalize(vec3(-0.4, 0.7, 0.6))), 0.0);
  float breathe = mix(0.88, 1.12, uPulse);

  float a = (0.04 + 0.15 * crest + 0.42 * rim) * facing;
  vec3 c = tint * (0.5 + 0.6 * crest + 0.4 * diff * crest + 1.25 * rim) * breathe;

  c += vGlow * (0.7 + 0.8 * crest);
  a += (vGlow.r + vGlow.g + vGlow.b) * 0.18 * facing;

  gl_FragColor = vec4(c * uExposure, clamp(a, 0.0, 1.0) * uDim);
}
`;

const PATH_VERT = /* glsl */ `
attribute float aPhase;
attribute float aTone;
attribute float aSpeed;
varying float vU;
varying float vPhase;
varying float vTone;
varying float vSpeed;
void main() {
  vU = uv.x;
  vPhase = aPhase;
  vTone = aTone;
  vSpeed = aSpeed;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const PATH_FRAG = /* glsl */ `
uniform float uTime;
uniform float uVis;
uniform float uSpeed;
uniform float uEnergy;
uniform vec3 uPurple;
uniform vec3 uCyan;
uniform vec3 uEmerald;
varying float vU;
varying float vPhase;
varying float vTone;
varying float vSpeed;
void main() {
  float head = fract(vPhase + uTime * vSpeed * uSpeed);
  float d = fract(head - vU);                 // distance behind the pulse head
  float trail = exp(-d * 10.0);
  float edge = pow(sin(3.14159265 * vU), 0.5);
  vec3 base = vTone < 0.5 ? uPurple : (vTone < 1.5 ? uCyan : uEmerald);
  float inten = (0.07 + trail * (0.7 + uEnergy * 0.9)) * edge * uVis;
  gl_FragColor = vec4(base * (0.9 + 0.7 * trail), clamp(inten, 0.0, 1.0));
}
`;

const HALO_FRAG = /* glsl */ `
uniform float uPulse;
uniform vec3 uPurple;
uniform vec3 uCyan;
varying vec2 vUv;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  float a = pow(1.0 - clamp(r, 0.0, 1.0), 2.4);
  vec3 col = mix(uPurple, uCyan, smoothstep(0.1, 0.9, r));
  gl_FragColor = vec4(col, a * mix(0.12, 0.2, uPulse));
}
`;

/** Treat a hex string as display-space RGB (our shaders write straight to the canvas). */
function rawColor(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return new THREE.Color().setRGB(
    ((n >> 16) & 255) / 255,
    ((n >> 8) & 255) / 255,
    (n & 255) / 255,
    THREE.LinearSRGBColorSpace,
  );
}

/* ------------------------------------------------------------------ */
/* Placement of electrodes and regions on the template                 */
/* ------------------------------------------------------------------ */

const scalpPoint = (dir: Vec3) =>
  new THREE.Vector3(dir[0] * 1.45, -0.02 + dir[1] * 1.1, dir[2] * 1.68);

interface Site {
  scalp: THREE.Vector3;
  /** nearest cortex points (two for midline channels, one hit per hemisphere) */
  cortex: THREE.Vector3[];
  hue: Hue;
}

function computeSites(verts: Float32Array, electrodes: Electrode[]) {
  const out: Record<string, Site> = {};
  for (const el of electrodes) {
    const scalp = scalpPoint(el.dir);
    const cortex: THREE.Vector3[] = [];
    if (Math.abs(el.dir[0]) < 0.01) {
      for (const s of [-1, 1]) {
        const o = scalp.clone();
        o.x += s * 0.12;
        const t = CEREBRUM_CENTER.clone();
        t.x += s * 0.12;
        cortex.push(projectToSurface(verts, o, t));
      }
    } else {
      cortex.push(projectToSurface(verts, scalp, CEREBRUM_CENTER));
    }
    out[el.id] = { scalp, cortex, hue: regionHue(el.region) };
  }
  return out;
}

function computeRegionSites(cerebrum: Float32Array, cerebellum: Float32Array) {
  const out = {} as Record<RegionKey, THREE.Vector3[]>;
  for (const r of REGIONS) {
    const verts = r.surface === 'cerebrum' ? cerebrum : cerebellum;
    const c = r.surface === 'cerebrum' ? CEREBRUM_CENTER : CEREBELLUM_CENTER;
    const pts: THREE.Vector3[] = [];
    for (const hemi of [1, -1]) {
      for (const ray of r.rays) {
        const dir = new THREE.Vector3(ray[0] * hemi, ray[1], ray[2]).normalize();
        pts.push(projectToSurface(verts, c.clone().addScaledVector(dir, 4), c.clone()));
      }
    }
    out[r.key] = pts;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Public component                                                    */
/* ------------------------------------------------------------------ */

export interface BrainSceneProps {
  mode: ViewMode;
  electrodes: Electrode[];
  selection: Selection;
  events: DetectedEvent[];
  activityRef: MutableRefObject<Record<string, number>>;
  onSelectElectrode: (id: string) => void;
  reducedMotion: boolean;
  /** icosphere subdivision, higher = denser folds, more GPU work */
  detail: number;
  /** overall brightness multiplier */
  exposure: number;
}

export default function BrainScene(props: BrainSceneProps) {
  return (
    <Canvas
      flat
      dpr={[1, 2]}
      camera={{ position: [4.4, 1.7, 3.2], fov: 36, near: 0.1, far: 60 }}
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <Scene {...props} />
    </Canvas>
  );
}

/* ------------------------------------------------------------------ */
/* Scene                                                               */
/* ------------------------------------------------------------------ */

interface Controls {
  update: () => void;
  addEventListener: (type: string, fn: () => void) => void;
  removeEventListener: (type: string, fn: () => void) => void;
}

interface Spot {
  p: THREE.Vector3;
  r: number;
  i: number;
  hue: number;
  ring?: boolean;
}

function Scene(props: BrainSceneProps) {
  const { mode, electrodes, selection, reducedMotion, detail, exposure } = props;
  const P = useRef(props);
  P.current = props;

  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  /* geometry (built once per detail level) */
  const model = useMemo(() => buildBrain(detail), [detail]);
  const pathways = useMemo(() => buildPathways(), []);
  useEffect(
    () => () => {
      model.surface.dispose();
      pathways.dispose();
    },
    [model, pathways],
  );

  const sites = useMemo(() => computeSites(model.cerebrumVerts, electrodes), [model, electrodes]);
  const regionSites = useMemo(
    () => computeRegionSites(model.cerebrumVerts, model.cerebellumVerts),
    [model],
  );

  /* shared uniforms + materials */
  const u = useMemo(
    () => ({
      uTime: { value: 0 },
      uPulse: { value: 0.5 },
      uDim: { value: 1 },
      uExposure: { value: 1 },
      uVis: { value: 1 },
      uSpeed: { value: 1 },
      uEnergy: { value: 0 },
      uPurple: { value: rawColor(HUE_HEX[0]) },
      uCyan: { value: rawColor(HUE_HEX[1]) },
      uEmerald: { value: rawColor(HUE_HEX[2]) },
      uSpots: { value: Array.from({ length: SPOTS }, () => new THREE.Vector4(0, 0, 0, 0.3)) },
      uSpotData: { value: Array.from({ length: SPOTS }, () => new THREE.Vector4()) },
    }),
    [],
  );

  const materials = useMemo(() => {
    const common = {
      uniforms: u,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    } as const;
    return {
      cortex: new THREE.ShaderMaterial({ ...common, vertexShader: CORTEX_VERT, fragmentShader: CORTEX_FRAG }),
      path: new THREE.ShaderMaterial({ ...common, vertexShader: PATH_VERT, fragmentShader: PATH_FRAG }),
      halo: new THREE.ShaderMaterial({
        uniforms: u,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: HALO_FRAG,
      }),
    };
  }, [u]);
  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials]);

  /* fit the brain to narrow (phone) viewports once */
  useEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    const dist = Math.max(5.6, 5.9 / aspect);
    camera.position.setLength(dist);
  }, [camera, size.width, size.height]);

  /* animation state */
  const anim = useRef({ electrodes: 0, activity: 0 });
  const seen = useRef(new Map<string, number>());
  const [hover, setHover] = useState<string | null>(null);
  const hoverRef = useRef<string | null>(null);
  hoverRef.current = hover;

  useFrame((state, dt) => {
    const { mode: m, selection: sel, events: evs, activityRef, electrodes: els } = P.current;
    const t = state.clock.elapsedTime;
    const a = anim.current;
    const k = 1 - Math.exp(-dt * 5);
    a.electrodes += ((m === 'electrodes' ? 1 : 0) - a.electrodes) * k;
    a.activity += ((m === 'activity' ? 1 : 0) - a.activity) * k;

    u.uTime.value = t;
    u.uExposure.value = P.current.exposure;
    u.uPulse.value = P.current.reducedMotion
      ? 0.5
      : 0.5 + 0.5 * (0.7 * Math.sin(t * 1.45) + 0.3 * Math.sin(t * 3.1 + 1));
    u.uDim.value = 1 - 0.22 * a.electrodes - 0.1 * a.activity;

    const act = activityRef.current;
    let mean = 0;
    for (const el of els) mean += act[el.id] ?? 0;
    mean /= Math.max(1, els.length);
    u.uVis.value = 1 - 0.5 * a.electrodes + 0.2 * a.activity;
    u.uSpeed.value = P.current.reducedMotion ? 0 : 1 + 1.4 * a.activity;
    u.uEnergy.value = mean * a.activity;

    /* assemble highlight spots, most important first */
    let n = 0;
    const push = (s: Spot) => {
      if (n >= SPOTS) return;
      u.uSpots.value[n].set(s.p.x, s.p.y, s.p.z, s.r);
      u.uSpotData.value[n].set(s.i, s.hue, s.ring ? 1 : 0, 0);
      n++;
    };
    const selPulse = 0.85 + 0.15 * Math.sin(t * 3);

    if (sel?.kind === 'electrode' || sel?.kind === 'event') {
      const ch = sel.kind === 'electrode' ? sel.id : evs.find((e) => e.id === sel.id)?.channel;
      const site = ch ? sites[ch] : undefined;
      site?.cortex.forEach((p) => push({ p, r: 0.3, i: selPulse, hue: 3, ring: true }));
    } else if (sel?.kind === 'region') {
      const def = regionByKey(sel.key);
      regionSites[sel.key]?.forEach((p) => push({ p, r: def.radius, i: 0.85 * selPulse, hue: def.hue }));
    }

    for (const ev of evs.slice(0, 6)) {
      if (!seen.current.has(ev.id)) seen.current.set(ev.id, t);
      if (a.activity < 0.05) continue;
      const age = t - (seen.current.get(ev.id) ?? t);
      if (age > 7) continue;
      const site = sites[ev.channel];
      if (!site) continue;
      const i = Math.exp(-age / 1.8) * 0.95 * a.activity;
      site.cortex.forEach((p) => push({ p, r: 0.34, i, hue: site.hue }));
    }

    if (hoverRef.current && a.electrodes > 0.5) {
      sites[hoverRef.current]?.cortex.forEach((p) =>
        push({ p, r: 0.24, i: 0.55 * a.electrodes, hue: sites[hoverRef.current!].hue }),
      );
    }

    if (a.activity > 0.03) {
      for (const el of els) {
        const site = sites[el.id];
        const v = (act[el.id] ?? 0) * 0.8 * a.activity;
        if (!site || v < 0.04) continue;
        site.cortex.forEach((p) => push({ p, r: 0.3, i: v, hue: site.hue }));
      }
    }
    for (let i = n; i < SPOTS; i++) u.uSpotData.value[i].x = 0;
  });

  /* camera focus when something is selected */
  const eventsRef = useRef(props.events);
  eventsRef.current = props.events;
  const focus = useMemo(() => {
    if (!selection) return null;
    let pts: THREE.Vector3[] | undefined;
    if (selection.kind === 'electrode') pts = sites[selection.id]?.cortex;
    else if (selection.kind === 'event') {
      const ev = eventsRef.current.find((e) => e.id === selection.id);
      pts = ev ? sites[ev.channel]?.cortex : undefined;
    } else {
      const side = camera.position.x >= 0 ? 1 : -1;
      pts = regionSites[selection.key]?.filter((p) => (p.x >= 0 ? 1 : -1) === side);
    }
    if (!pts || !pts.length) return null;
    return pts.reduce((acc, p) => acc.add(p), new THREE.Vector3()).divideScalar(pts.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, sites, regionSites]);

  /* idle auto-rotate, paused while interacting or while something is selected */
  const [idle, setIdle] = useState(true);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(idleTimer.current), []);

  return (
    <>
      <Billboard position={[0, -0.1, 0]}>
        <mesh renderOrder={-2} material={materials.halo}>
          <planeGeometry args={[8.5, 8.5]} />
        </mesh>
      </Billboard>

      <mesh geometry={pathways} material={materials.path} renderOrder={1} frustumCulled={false} />
      <mesh geometry={model.surface} material={materials.cortex} renderOrder={0} />

      {electrodes.map((el) => {
        const site = sites[el.id];
        if (!site) return null;
        const selected =
          (selection?.kind === 'electrode' && selection.id === el.id) ||
          (selection?.kind === 'event' &&
            props.events.find((e) => e.id === selection.id)?.channel === el.id);
        return (
          <Marker
            key={el.id}
            electrode={el}
            site={site}
            anim={anim}
            activityRef={props.activityRef}
            selected={!!selected}
            hovered={hover === el.id}
            mode={mode}
            onSelect={props.onSelectElectrode}
            onHover={setHover}
          />
        );
      })}

      <CameraRig focus={focus} />
      <OrbitControls
        makeDefault
        target={[ORBIT_TARGET.x, ORBIT_TARGET.y, ORBIT_TARGET.z]}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.7}
        zoomSpeed={0.7}
        minDistance={3.2}
        maxDistance={12}
        autoRotate={idle && !reducedMotion && !selection}
        autoRotateSpeed={0.55}
        onStart={() => {
          clearTimeout(idleTimer.current);
          setIdle(false);
        }}
        onEnd={() => {
          idleTimer.current = setTimeout(() => setIdle(true), 7000);
        }}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Camera rig: eases the view toward whatever was selected             */
/* ------------------------------------------------------------------ */

function CameraRig({ focus }: { focus: THREE.Vector3 | null }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as Controls | null;
  const st = useRef({ t: 1, from: new THREE.Vector3(), dist: 5, q: new THREE.Quaternion() });

  useEffect(() => {
    if (!focus) return;
    const from = camera.position.clone().sub(ORBIT_TARGET);
    const dist = from.length();
    from.normalize();
    const to = focus.clone().sub(ORBIT_TARGET).normalize();
    to.y += 0.18;
    to.normalize();
    st.current = { t: 0, from, dist, q: new THREE.Quaternion().setFromUnitVectors(from, to) };
  }, [focus, camera]);

  useEffect(() => {
    if (!controls) return;
    const stop = () => {
      st.current.t = 1;
    };
    controls.addEventListener('start', stop);
    return () => controls.removeEventListener('start', stop);
  }, [controls]);

  useFrame((_, dt) => {
    const s = st.current;
    if (s.t >= 1) return;
    s.t = Math.min(1, s.t + dt / 1.0);
    const k = s.t < 0.5 ? 2 * s.t * s.t : 1 - Math.pow(-2 * s.t + 2, 2) / 2;
    const q = new THREE.Quaternion().slerp(s.q, k);
    camera.position.copy(s.from).applyQuaternion(q).multiplyScalar(s.dist).add(ORBIT_TARGET);
    controls?.update();
  });

  return null;
}

/* ------------------------------------------------------------------ */
/* Electrode marker                                                    */
/* ------------------------------------------------------------------ */

interface MarkerProps {
  electrode: Electrode;
  site: Site;
  anim: MutableRefObject<{ electrodes: number; activity: number }>;
  activityRef: MutableRefObject<Record<string, number>>;
  selected: boolean;
  hovered: boolean;
  mode: ViewMode;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

const _dir = new THREE.Vector3();
const _cam = new THREE.Vector3();

function Marker({ electrode, site, anim, activityRef, selected, hovered, mode, onSelect, onHover }: MarkerProps) {
  const group = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Mesh>(null);
  const label = useRef<HTMLDivElement>(null);
  const flags = useRef({ selected, hovered });
  flags.current = { selected, hovered };

  const color = selected ? '#ffffff' : HUE_HEX[site.hue];

  useEffect(() => () => void (document.body.style.cursor = ''), []);

  useFrame((state) => {
    const vis = Math.max(anim.current.electrodes, anim.current.activity);
    const act = activityRef.current[electrode.id] ?? 0;
    const f = flags.current;
    if (group.current) group.current.visible = vis > 0.01;

    const base = f.selected ? 1.45 : f.hovered ? 1.25 : 1;
    const s = vis * base * (1 + anim.current.activity * act * 0.7);
    core.current?.scale.setScalar(Math.max(0.0001, s));
    if (halo.current) {
      const t = state.clock.elapsedTime;
      const pulse = f.selected ? 1.4 + 0.35 * Math.sin(t * 3.2) : 1 + anim.current.activity * act * 0.9;
      halo.current.scale.setScalar(Math.max(0.0001, vis * pulse));
    }

    if (label.current) {
      _dir.copy(site.scalp).sub(ORBIT_TARGET).normalize();
      _cam.copy(state.camera.position).sub(ORBIT_TARGET).normalize();
      const facing = THREE.MathUtils.smoothstep(_dir.dot(_cam), 0.0, 0.35);
      const showInActivity = f.selected || f.hovered || act > 0.62 ? 1 : 0;
      const o = (anim.current.electrodes + anim.current.activity * showInActivity) * facing;
      label.current.style.opacity = String(Math.min(1, o));
    }
  });

  const interactive = () => anim.current.electrodes + anim.current.activity > 0.5;

  return (
    <>
      <group ref={group} position={site.scalp}>
        <mesh ref={core}>
          <sphereGeometry args={[0.045, 16, 12]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
        <mesh ref={halo}>
          <sphereGeometry args={[0.09, 16, 12]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.2}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
        {/* generous invisible hit target for touch */}
        <mesh
          onClick={(e) => {
            if (!interactive()) return;
            e.stopPropagation();
            onSelect(electrode.id);
          }}
          onPointerOver={(e) => {
            if (!interactive()) return;
            e.stopPropagation();
            onHover(electrode.id);
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            onHover(null);
            document.body.style.cursor = '';
          }}
        >
          <sphereGeometry args={[0.14, 8, 6]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        <Html center position={[0, 0.15, 0]} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <div ref={label} className={`${styles.tag} ${selected ? styles.tagOn : ''}`} style={{ opacity: 0 }}>
            {electrode.label}
          </div>
        </Html>
      </group>

      {/* dashed leader from scalp position to the template cortex point it projects to */}
      {mode !== 'overview' &&
        (mode === 'electrodes' || selected) &&
        site.cortex.map((p, i) => (
          <Line
            key={i}
            points={[site.scalp, p]}
            color={selected ? '#ffffff' : HUE_HEX[site.hue]}
            lineWidth={1}
            dashed
            dashSize={0.04}
            gapSize={0.03}
            transparent
            opacity={selected ? 0.9 : 0.22}
          />
        ))}

      {selected &&
        site.cortex.map((p, i) => (
          <mesh key={`dot${i}`} position={p}>
            <sphereGeometry args={[0.022, 10, 8]} />
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
          </mesh>
        ))}
    </>
  );
}
