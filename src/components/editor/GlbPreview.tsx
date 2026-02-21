"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import { Environment, OrbitControls, useGLTF } from "@react-three/drei";
import { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { CanonicalSvgArtwork, renderSvgToCanvas } from "@/lib/svg-artwork";
import { DEFAULT_SCENE_PRESET_ID, getScenePresetById, SCENE_PRESETS } from "./scenePresets";

type Props = {
  assetKey: string;
  glbPath?: string;
  artwork: CanonicalSvgArtwork | null;
  textureSizePx: 1024 | 2048;
  className?: string;
};

type PathStatus =
  | { state: "checking" }
  | { state: "ready" }
  | { state: "missing"; message: string };

type PersistedSceneSettings = {
  presetId: string;
  groundEnabled: boolean;
  shadowsEnabled: boolean;
};

class GlbErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { fallback: React.ReactNode; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  override render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

function collectWrapMaterials(root: THREE.Object3D) {
  const materials = new Set<THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial | THREE.MeshBasicMaterial>();

  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;

    const nodeMaterials = Array.isArray(node.material) ? node.material : [node.material];
    const hasNamedWrapMaterial = nodeMaterials.some((material) => material?.name === "WrapArea");
    const shouldUseNode = hasNamedWrapMaterial || node.name === "WrapArea";
    if (!shouldUseNode) return;

    for (const material of nodeMaterials) {
      if (
        material instanceof THREE.MeshStandardMaterial ||
        material instanceof THREE.MeshPhysicalMaterial ||
        material instanceof THREE.MeshBasicMaterial
      ) {
        materials.add(material);
      }
    }
  });

  return Array.from(materials);
}

function GradientBackground({ topColor, bottomColor }: { topColor: string; bottomColor: string }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          topColor: { value: new THREE.Color(topColor) },
          bottomColor: { value: new THREE.Color(bottomColor) }
        },
        vertexShader: `varying vec3 vWorldPosition;
          void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            gl_Position = projectionMatrix * viewMatrix * worldPosition;
          }`,
        fragmentShader: `uniform vec3 topColor;
          uniform vec3 bottomColor;
          varying vec3 vWorldPosition;
          void main() {
            float h = normalize(vWorldPosition).y * 0.5 + 0.5;
            gl_FragColor = vec4(mix(bottomColor, topColor, smoothstep(0.0, 1.0, h)), 1.0);
          }`,
        side: THREE.BackSide,
        depthWrite: false
      }),
    [topColor, bottomColor]
  );

  useEffect(() => () => material.dispose(), [material]);

  return (
    <mesh renderOrder={-1000}>
      <sphereGeometry args={[50, 32, 16]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function Scene({
  glbPath,
  artwork,
  textureSizePx,
  presetId,
  groundEnabled,
  shadowsEnabled,
  fitVersion
}: {
  glbPath: string;
  artwork: CanonicalSvgArtwork | null;
  textureSizePx: 1024 | 2048;
  presetId: string;
  groundEnabled: boolean;
  shadowsEnabled: boolean;
  fitVersion: number;
}) {
  const { camera, invalidate, scene: threeScene } = useThree();
  const { scene } = useGLTF(glbPath);
  const modelScene = useMemo(() => scene.clone(true), [scene]);
  const previousTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const originalMapsRef = useRef<Map<string, THREE.Texture | null>>(new Map());
  const orbitControlsRef = useRef<OrbitControlsImpl | null>(null);
  const preset = useMemo(() => getScenePresetById(presetId), [presetId]);

  useEffect(() => {
    const wrapMaterials = collectWrapMaterials(modelScene);
    for (const material of wrapMaterials) {
      if (!originalMapsRef.current.has(material.uuid)) {
        originalMapsRef.current.set(material.uuid, material.map ?? null);
      }
    }
  }, [modelScene]);

  useEffect(() => {
    const wrapMaterials = collectWrapMaterials(modelScene);
    if (wrapMaterials.length === 0) return;

    let cancelled = false;

    const timer = window.setTimeout(() => {
      if (!artwork) {
        for (const material of wrapMaterials) {
          material.map = originalMapsRef.current.get(material.uuid) ?? null;
          material.needsUpdate = true;
        }
        previousTextureRef.current?.dispose();
        previousTextureRef.current = null;
        invalidate();
        return;
      }

      void (async () => {
        try {
          const textureCanvas = await renderSvgToCanvas(artwork.svgText, textureSizePx);
          if (cancelled) return;

          const nextTexture = new THREE.CanvasTexture(textureCanvas);
          if ("colorSpace" in nextTexture) {
            nextTexture.colorSpace = THREE.SRGBColorSpace;
          }
          nextTexture.flipY = false;
          nextTexture.needsUpdate = true;

          for (const material of wrapMaterials) {
            material.map = nextTexture;
            material.needsUpdate = true;
          }

          previousTextureRef.current?.dispose();
          previousTextureRef.current = nextTexture;
          invalidate();
        } catch {
          if (!cancelled) invalidate();
        }
      })();
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [artwork, textureSizePx, modelScene, invalidate]);

  useEffect(() => {
    return () => {
      previousTextureRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    if (preset.background.type === "solid") {
      threeScene.background = new THREE.Color(preset.background.colorA);
    } else {
      threeScene.background = null;
    }
    invalidate();

    return () => {
      threeScene.background = null;
    };
  }, [preset.background, threeScene, invalidate]);

  useEffect(() => {
    const bounds = new THREE.Box3().setFromObject(modelScene);
    if (bounds.isEmpty()) return;

    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const maxSize = Math.max(size.x, size.y, size.z);
    const perspectiveCamera = camera as THREE.PerspectiveCamera;
    const fitHeightDistance = maxSize / (2 * Math.atan((Math.PI * perspectiveCamera.fov) / 360));
    const fitWidthDistance = fitHeightDistance / perspectiveCamera.aspect;
    const distance = 1.1 * Math.max(fitHeightDistance, fitWidthDistance);

    const nextPosition = new THREE.Vector3(center.x + distance * 0.55, center.y + distance * 0.3, center.z + distance);
    camera.position.copy(nextPosition);
    perspectiveCamera.near = Math.max(distance / 100, 0.01);
    perspectiveCamera.far = distance * 100;
    perspectiveCamera.updateProjectionMatrix();
    camera.lookAt(center);

    const controls = orbitControlsRef.current;
    if (controls) {
      controls.target.copy(center);
      controls.update();
    }
    invalidate();
  }, [camera, fitVersion, modelScene, invalidate]);

  return (
    <>
      {preset.background.type === "gradient" ? (
        <GradientBackground topColor={preset.background.colorA} bottomColor={preset.background.colorB} />
      ) : null}
      {preset.background.type === "env" ? <Environment preset={preset.background.env} background={false} /> : null}
      <ambientLight intensity={preset.lights.ambient} />
      <directionalLight
        castShadow={shadowsEnabled}
        intensity={preset.lights.key.intensity}
        position={preset.lights.key.pos}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight castShadow={false} intensity={preset.lights.fill.intensity} position={preset.lights.fill.pos} />
      <directionalLight castShadow={false} intensity={preset.lights.rim.intensity} position={preset.lights.rim.pos} />
      {groundEnabled ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, preset.ground.y, 0]} receiveShadow={shadowsEnabled}>
          <planeGeometry args={[preset.ground.size, preset.ground.size]} />
          <shadowMaterial transparent opacity={shadowsEnabled ? preset.ground.shadowOpacity : 0} />
        </mesh>
      ) : null}
      <primitive object={modelScene} castShadow receiveShadow />
      <OrbitControls
        ref={orbitControlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        onStart={() => invalidate()}
        onChange={() => invalidate()}
      />
    </>
  );
}

export default function GlbPreview({ assetKey, glbPath, artwork, textureSizePx, className }: Props) {
  const resolvedGlbPath = useMemo(
    () => (glbPath && glbPath.trim().length > 0 ? glbPath : `/model-assets/${assetKey}/model.glb`),
    [glbPath, assetKey]
  );
  const [pathStatus, setPathStatus] = useState<PathStatus>({ state: "checking" });
  const [presetId, setPresetId] = useState(DEFAULT_SCENE_PRESET_ID);
  const [groundEnabled, setGroundEnabled] = useState(true);
  const [shadowsEnabled, setShadowsEnabled] = useState(false);
  const [fitVersion, setFitVersion] = useState(0);

  const storageKey = useMemo(() => `glb-preview-scene:${assetKey}`, [assetKey]);

  useEffect(() => {
    const lowEndDevice = (navigator.hardwareConcurrency ?? 8) <= 4 || (navigator as Navigator & { deviceMemory?: number }).deviceMemory === 1;
    const fallbackPreset = getScenePresetById(DEFAULT_SCENE_PRESET_ID);
    setPresetId(fallbackPreset.id);
    setGroundEnabled(fallbackPreset.ground.enabled);
    setShadowsEnabled(false);

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as PersistedSceneSettings;
      const persistedPreset = getScenePresetById(parsed.presetId);
      setPresetId(persistedPreset.id);
      setGroundEnabled(Boolean(parsed.groundEnabled));
      setShadowsEnabled(Boolean(parsed.shadowsEnabled) && !lowEndDevice);
    } catch {
      // ignore malformed local storage
    }
  }, [storageKey]);

  useEffect(() => {
    const payload: PersistedSceneSettings = { presetId, groundEnabled, shadowsEnabled };
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [storageKey, presetId, groundEnabled, shadowsEnabled]);

  useEffect(() => {
    let cancelled = false;

    const verifyPath = async () => {
      setPathStatus({ state: "checking" });
      try {
        const response = await fetch(resolvedGlbPath, { method: "HEAD" });
        if (cancelled) return;
        if (!response.ok) {
          setPathStatus({
            state: "missing",
            message: `GLB not found. Expected: ${resolvedGlbPath}`
          });
          return;
        }
        setPathStatus({ state: "ready" });
      } catch {
        if (!cancelled) {
          setPathStatus({
            state: "missing",
            message: `Unable to load GLB. Expected: ${resolvedGlbPath}`
          });
        }
      }
    };

    void verifyPath();

    return () => {
      cancelled = true;
    };
  }, [resolvedGlbPath]);

  if (pathStatus.state === "checking") {
    return (
      <div className={`flex h-full w-full items-center justify-center bg-slate-900 text-xs text-slate-200 ${className ?? ""}`.trim()}>
        Loading 3D model...
      </div>
    );
  }

  if (pathStatus.state === "missing") {
    return (
      <div className={`flex h-full w-full items-center justify-center bg-slate-900 px-4 text-center text-xs text-amber-200 ${className ?? ""}`.trim()}>
        {pathStatus.message}
      </div>
    );
  }

  return (
    <div className={`h-full w-full bg-slate-900 ${className ?? ""}`.trim()}>
      <div className="flex items-center gap-3 border-b border-slate-700/70 bg-slate-900 px-3 py-2 text-xs text-slate-100">
        <label className="inline-flex items-center gap-1">
          <span>Scene</span>
          <select
            value={presetId}
            onChange={(event) => setPresetId(event.target.value)}
            className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs"
          >
            {SCENE_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-flex items-center gap-1">
          <input type="checkbox" checked={groundEnabled} onChange={(event) => setGroundEnabled(event.target.checked)} />
          Ground
        </label>
        <label className="inline-flex items-center gap-1">
          <input type="checkbox" checked={shadowsEnabled} onChange={(event) => setShadowsEnabled(event.target.checked)} />
          Shadows
        </label>
        <button
          type="button"
          className="rounded border border-slate-600 px-2 py-1 text-xs hover:bg-slate-800"
          onClick={() => setFitVersion((version) => version + 1)}
        >
          Fit camera
        </button>
      </div>
      <GlbErrorBoundary
        fallback={
          <div className="flex h-full w-full items-center justify-center px-4 text-center text-xs text-amber-200">
            Failed to render GLB. Confirm model exists at {resolvedGlbPath}.
          </div>
        }
      >
        <Canvas
          frameloop="demand"
          dpr={[1, 2]}
          shadows={shadowsEnabled}
          camera={{ fov: 38, near: 0.01, far: 1000, position: [0, 0, 3.5] }}
        >
          <Suspense
            fallback={
              <mesh>
                <boxGeometry args={[0.25, 0.25, 0.25]} />
                <meshStandardMaterial color="#94a3b8" />
              </mesh>
            }
          >
            <Scene
              glbPath={resolvedGlbPath}
              artwork={artwork}
              textureSizePx={textureSizePx}
              presetId={presetId}
              groundEnabled={groundEnabled}
              shadowsEnabled={shadowsEnabled}
              fitVersion={fitVersion}
            />
          </Suspense>
        </Canvas>
      </GlbErrorBoundary>
    </div>
  );
}
