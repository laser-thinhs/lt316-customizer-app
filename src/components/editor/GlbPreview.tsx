"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import { Bounds, OrbitControls, useGLTF } from "@react-three/drei";
import { CanonicalSvgArtwork, renderSvgToCanvas } from "@/lib/svg-artwork";

type Props = {
  assetKey: string;
  artwork: CanonicalSvgArtwork | null;
  textureSizePx: 1024 | 2048;
  className?: string;
};

type PathStatus =
  | { state: "checking" }
  | { state: "ready" }
  | { state: "missing"; message: string };

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

function Scene({ glbPath, artwork, textureSizePx }: { glbPath: string; artwork: CanonicalSvgArtwork | null; textureSizePx: 1024 | 2048 }) {
  const { invalidate } = useThree();
  const { scene } = useGLTF(glbPath);
  const modelScene = useMemo(() => scene.clone(true), [scene]);
  const previousTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const originalMapsRef = useRef<Map<string, THREE.Texture | null>>(new Map());

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

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight intensity={0.95} position={[3, 4, 4]} />
      <directionalLight intensity={0.4} position={[-2, 1, -3]} />
      <Bounds fit clip observe margin={1.15}>
        <primitive object={modelScene} />
      </Bounds>
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} onChange={() => invalidate()} />
    </>
  );
}

export default function GlbPreview({ assetKey, artwork, textureSizePx, className }: Props) {
  const glbPath = useMemo(() => `/model-assets/${assetKey}/model.glb`, [assetKey]);
  const [pathStatus, setPathStatus] = useState<PathStatus>({ state: "checking" });

  useEffect(() => {
    let cancelled = false;

    const verifyPath = async () => {
      setPathStatus({ state: "checking" });
      try {
        const response = await fetch(glbPath, { method: "HEAD" });
        if (cancelled) return;
        if (!response.ok) {
          setPathStatus({
            state: "missing",
            message: `GLB not found. Expected: ${glbPath}`
          });
          return;
        }
        setPathStatus({ state: "ready" });
      } catch {
        if (!cancelled) {
          setPathStatus({
            state: "missing",
            message: `Unable to load GLB. Expected: ${glbPath}`
          });
        }
      }
    };

    void verifyPath();

    return () => {
      cancelled = true;
    };
  }, [glbPath]);

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
      <GlbErrorBoundary
        fallback={
          <div className="flex h-full w-full items-center justify-center px-4 text-center text-xs text-amber-200">
            Failed to render GLB. Confirm model exists at {glbPath}.
          </div>
        }
      >
        <Canvas frameloop="demand" dpr={[1, 2]} camera={{ fov: 38, near: 0.01, far: 1000, position: [0, 0, 3.5] }}>
          <Suspense
            fallback={
              <mesh>
                <boxGeometry args={[0.25, 0.25, 0.25]} />
                <meshStandardMaterial color="#94a3b8" />
              </mesh>
            }
          >
            <Scene glbPath={glbPath} artwork={artwork} textureSizePx={textureSizePx} />
          </Suspense>
        </Canvas>
      </GlbErrorBoundary>
    </div>
  );
}
