"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { Bounds, OrbitControls, useGLTF } from "@react-three/drei";
import { renderSvgToCanvas } from "@/lib/svg-artwork";

type Props = {
  meshPath: string;
  overlaySvgPath?: string;
  className?: string;
};

type PathState = "checking" | "ready" | "missing";

function collectTargetMaterials(root: THREE.Object3D) {
  const wrapMaterials = new Set<THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial | THREE.MeshBasicMaterial>();
  const fallbackMaterials = new Set<THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial | THREE.MeshBasicMaterial>();

  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    const nodeMaterials = Array.isArray(node.material) ? node.material : [node.material];
    const hasNamedWrapMaterial = nodeMaterials.some((material) => material?.name === "WrapArea");
    const isWrapNode = hasNamedWrapMaterial || node.name === "WrapArea";

    for (const material of nodeMaterials) {
      if (
        material instanceof THREE.MeshStandardMaterial ||
        material instanceof THREE.MeshPhysicalMaterial ||
        material instanceof THREE.MeshBasicMaterial
      ) {
        fallbackMaterials.add(material);
        if (isWrapNode) wrapMaterials.add(material);
      }
    }
  });

  return wrapMaterials.size > 0 ? Array.from(wrapMaterials) : Array.from(fallbackMaterials);
}

function MeshScene({ meshPath, overlaySvgPath }: { meshPath: string; overlaySvgPath?: string }) {
  const { scene } = useGLTF(meshPath);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const previousTextureRef = useRef<THREE.CanvasTexture | null>(null);

  useEffect(() => {
    const materials = collectTargetMaterials(cloned);
    if (materials.length === 0) return;

    let cancelled = false;

    const applyOverlay = async () => {
      if (!overlaySvgPath) {
        if (previousTextureRef.current) {
          previousTextureRef.current.dispose();
          previousTextureRef.current = null;
        }
        for (const material of materials) {
          material.map = null;
          material.needsUpdate = true;
        }
        return;
      }

      try {
        const response = await fetch(overlaySvgPath);
        if (!response.ok) return;
        const svgText = await response.text();
        if (cancelled) return;

        const textureCanvas = await renderSvgToCanvas(svgText, 2048);
        if (cancelled) return;

        const texture = new THREE.CanvasTexture(textureCanvas);
        if ("colorSpace" in texture) {
          texture.colorSpace = THREE.SRGBColorSpace;
        }
        texture.flipY = false;
        texture.needsUpdate = true;

        if (previousTextureRef.current) previousTextureRef.current.dispose();
        previousTextureRef.current = texture;

        for (const material of materials) {
          material.map = texture;
          material.needsUpdate = true;
        }
      } catch {
      }
    };

    void applyOverlay();
    return () => {
      cancelled = true;
    };
  }, [cloned, overlaySvgPath]);

  useEffect(() => {
    return () => {
      if (previousTextureRef.current) previousTextureRef.current.dispose();
    };
  }, []);

  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight intensity={0.95} position={[3, 4, 4]} />
      <directionalLight intensity={0.4} position={[-2, 1, -3]} />
      <Bounds fit clip observe margin={1.15}>
        <primitive object={cloned} />
      </Bounds>
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
    </>
  );
}

export default function TemplateMeshPreview3D({ meshPath, overlaySvgPath, className }: Props) {
  const [pathState, setPathState] = useState<PathState>("checking");

  useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      setPathState("checking");
      try {
        const response = await fetch(meshPath, { method: "HEAD" });
        if (cancelled) return;
        setPathState(response.ok ? "ready" : "missing");
      } catch {
        if (!cancelled) setPathState("missing");
      }
    };

    void verify();
    return () => {
      cancelled = true;
    };
  }, [meshPath]);

  if (pathState === "checking") {
    return <div className={`flex h-full w-full items-center justify-center text-xs text-slate-200 ${className ?? ""}`.trim()}>Loading 3D model…</div>;
  }

  if (pathState === "missing") {
    return <div className={`flex h-full w-full items-center justify-center px-4 text-center text-xs text-amber-200 ${className ?? ""}`.trim()}>Model not found at {meshPath}</div>;
  }

  return (
    <div className={`h-full w-full ${className ?? ""}`.trim()}>
      <Canvas dpr={[1, 2]} camera={{ fov: 38, near: 0.01, far: 1000, position: [0, 0, 3.5] }}>
        <Suspense
          fallback={
            <mesh>
              <boxGeometry args={[0.25, 0.25, 0.25]} />
              <meshStandardMaterial color="#94a3b8" />
            </mesh>
          }
        >
          <MeshScene meshPath={meshPath} overlaySvgPath={overlaySvgPath} />
        </Suspense>
      </Canvas>
    </div>
  );
}
