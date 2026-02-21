"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, OrbitControls, useGLTF } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { loadSvgTextureFromPath } from "@/lib/rendering/svgTexture";
import type { Placement } from "@/core/v2/types";

type Props = {
  meshPath: string;
  overlaySvgPath?: string;
  className?: string;
  colorHex?: string;
  colorId?: string;
  placement?: Placement;
  wrapWidthMm?: number;
  debug?: boolean;
};

type PathState = "checking" | "ready" | "missing";

type BodyFit = {
  center: THREE.Vector3;
  bodyRadius: number;
  bodyHeight: number;
};

const defaultColorMap: Record<string, string> = {
  black: "#18181b",
  navy: "#1b2f53",
  white: "#f8fafc",
  gray: "#6b7280",
  stainless: "#9ca3af"
};

function resolveColor(colorId?: string, colorHex?: string): THREE.Color {
  if (colorHex) return new THREE.Color(colorHex);
  if (colorId && defaultColorMap[colorId]) return new THREE.Color(defaultColorMap[colorId]);
  return new THREE.Color("#334155");
}

function fitBody(sceneObject: THREE.Object3D): BodyFit {
  const box = new THREE.Box3().setFromObject(sceneObject);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  return {
    center,
    bodyRadius: Math.max(size.x, size.z) * 0.28,
    bodyHeight: Math.max(size.y * 0.42, 0.18)
  };
}

function findWrapMesh(root: THREE.Object3D): THREE.Mesh | null {
  let result: THREE.Mesh | null = null;
  root.traverse((node) => {
    if (result) return;
    if (!(node instanceof THREE.Mesh)) return;
    const nameLower = node.name.toLowerCase();
    if (nameLower.includes("wrap") || nameLower.includes("label") || nameLower.includes("decal")) {
      result = node;
    }
  });
  return result;
}

function configureBodyMaterials(root: THREE.Object3D, color: THREE.Color) {
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;

    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (!(material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshPhysicalMaterial)) continue;

      const lowered = `${node.name} ${material.name}`.toLowerCase();
      const isLid = lowered.includes("lid") || lowered.includes("cap");
      const isBody = lowered.includes("body") || lowered.includes("shell") || lowered.includes("cup") || lowered.includes("wraparea");
      const isWrap = lowered.includes("wrap") || lowered.includes("label") || lowered.includes("decal");

      // Skip wrap meshes when applying body color
      if (isWrap) {
        material.color = new THREE.Color("#ffffff");
        material.metalness = 0.08;
        material.roughness = 0.58;
        material.transparent = true;
        material.side = THREE.DoubleSide;
      } else if (isBody || !isLid) {
        material.color = color.clone();
        material.metalness = 0.42;
        material.roughness = 0.34;
      }

      if (isLid && !isWrap) {
        material.metalness = 0.18;
        material.roughness = 0.6;
      }

      material.needsUpdate = true;
    }

    node.castShadow = true;
    node.receiveShadow = true;
  });
}

function SceneCamera({ focus, radius }: { focus: THREE.Vector3; radius: number }) {
  const { camera } = useThree();

  useEffect(() => {
    const distance = Math.max(radius * 3.4, 1.4);
    camera.position.set(focus.x + distance * 0.95, focus.y + radius * 0.55, focus.z + distance * 0.78);
    camera.lookAt(focus);
    camera.updateProjectionMatrix();
  }, [camera, focus, radius]);

  return null;
}

function MeshScene({ meshPath, overlaySvgPath, colorHex, colorId, placement, wrapWidthMm, debug }: Props) {
  const { scene } = useGLTF(meshPath);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const previousTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const debugRef = useRef<{ wrapMesh: THREE.Mesh | null }>({ wrapMesh: null });

  const cloned = useMemo(() => scene.clone(true), [scene]);
  const bodyColor = useMemo(() => resolveColor(colorId, colorHex), [colorId, colorHex]);
  const fit = useMemo(() => fitBody(cloned), [cloned]);

  useEffect(() => {
    configureBodyMaterials(cloned, bodyColor);
    // Find or create wrap mesh
    const existing = findWrapMesh(cloned);
    if (!existing && debug) {
      console.warn("[3D Preview] No wrap mesh found in loaded model");
    }
    debugRef.current.wrapMesh = existing;
  }, [cloned, bodyColor, debug]);

  useEffect(() => {
    const wrapMesh = debugRef.current.wrapMesh;
    if (!overlaySvgPath || !wrapMesh) {
      if (previousTextureRef.current) {
        previousTextureRef.current.dispose();
        previousTextureRef.current = null;
      }
      const materials = Array.isArray(wrapMesh?.material) ? wrapMesh.material : [wrapMesh?.material];
      for (const material of materials) {
        if (material instanceof THREE.MeshStandardMaterial) {
          material.map = null;
          material.needsUpdate = true;
        }
      }
      return;
    }

    let cancelled = false;

    const applyOverlay = async () => {
      try {
        if (debug) console.log("[3D Preview] Loading texture from:", overlaySvgPath);
        const texture = await loadSvgTextureFromPath(overlaySvgPath);
        if (cancelled || !wrapMesh) {
          texture.dispose();
          return;
        }

        if (previousTextureRef.current) previousTextureRef.current.dispose();
        previousTextureRef.current = texture;

        const materials = Array.isArray(wrapMesh.material) ? wrapMesh.material : [wrapMesh.material];
        for (const material of materials) {
          if (material instanceof THREE.MeshStandardMaterial) {
            material.map = texture;
            material.transparent = true;
            material.alphaTest = 0.03;
            material.needsUpdate = true;
            if (debug) console.log("[3D Preview] Texture applied to wrap mesh");
          }
        }
      } catch (error) {
        if (debug) console.error("[3D Preview] Failed to load texture:", error);
      }
    };

    void applyOverlay();
    return () => {
      cancelled = true;
    };
  }, [overlaySvgPath, debug]);

  useEffect(() => {
    const texture = previousTextureRef.current;
    if (!texture) return;

    const seamShift = wrapWidthMm && wrapWidthMm > 0 ? (placement?.seamX_mm ?? 0) / wrapWidthMm : 0;
    const rotationShift = (placement?.rotation_deg ?? 0) / 360;
    const scale = Math.max(placement?.scale ?? 1, 0.15);

    texture.repeat.set(1 / scale, 1);
    texture.offset.set((seamShift + rotationShift) % 1, 0);
    texture.needsUpdate = true;

    if (debug) {
      console.log("[3D Preview] Texture UV updated", {
        seamShift: seamShift.toFixed(3),
        rotationShift: rotationShift.toFixed(3),
        scale: scale.toFixed(2),
        repeatU: (1 / scale).toFixed(2),
        offsetU: ((seamShift + rotationShift) % 1).toFixed(3)
      });
    }
  }, [placement?.rotation_deg, placement?.scale, placement?.seamX_mm, wrapWidthMm, debug]);

  useFrame(() => {
    controlsRef.current?.update();
  });

  useEffect(() => {
    return () => {
      if (previousTextureRef.current) previousTextureRef.current.dispose();
    };
  }, []);

  return (
    <>
      <color attach="background" args={["#0f172a"]} />
      <fog attach="fog" args={["#0f172a", 6, 16]} />

      <Environment preset="studio" />
      <hemisphereLight args={["#e2e8f0", "#1e293b", 0.45]} />
      <directionalLight castShadow intensity={1.25} position={[3.2, 5.2, 4.6]} shadow-mapSize={[1024, 1024]} />
      <directionalLight intensity={0.7} position={[-3.8, 2.3, -2.5]} />

      <SceneCamera focus={fit.center} radius={Math.max(fit.bodyRadius, 0.35)} />

      <primitive object={cloned} />

      <ContactShadows position={[fit.center.x, fit.center.y - fit.bodyHeight * 0.62, fit.center.z]} opacity={0.5} blur={2.8} scale={fit.bodyRadius * 5.5} far={2.2} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[fit.center.x, fit.center.y - fit.bodyHeight * 0.64, fit.center.z]}>
        <planeGeometry args={[8, 8]} />
        <meshStandardMaterial color="#111827" roughness={0.95} metalness={0} />
      </mesh>

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableRotate
        enablePan={false}
        enableDamping
        dampingFactor={0.07}
        target={fit.center}
        minDistance={Math.max(fit.bodyRadius * 2.1, 0.9)}
        maxDistance={Math.max(fit.bodyRadius * 5.3, 3.4)}
      />
    </>
  );
}

export default function TemplateMeshPreview3D({ meshPath, overlaySvgPath, className, colorHex, colorId, placement, wrapWidthMm, debug }: Props) {
  const [pathState, setPathState] = useState<PathState>("checking");
  const [textureError, setTextureError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      setPathState("checking");
      setTextureError(null);
      try {
        const response = await fetch(meshPath, { method: "HEAD" });
        if (cancelled) return;
        if (response.ok) {
          setPathState("ready");
          if (debug) console.log("[3D Preview] Mesh loaded:", meshPath);
        } else {
          setPathState("missing");
          setTextureError(`Mesh returned ${response.status}`);
        }
      } catch (error) {
        if (!cancelled) {
          setPathState("missing");
          setTextureError(error instanceof Error ? error.message : "Unknown error");
          if (debug) console.error("[3D Preview] Mesh load error:", error);
        }
      }
    };

    void verify();
    return () => {
      cancelled = true;
    };
  }, [meshPath, debug]);

  if (pathState === "checking") {
    return <div className={`flex h-full w-full items-center justify-center text-xs text-slate-200 ${className ?? ""}`.trim()}>Loading 3D model…</div>;
  }

  if (pathState === "missing") {
    return (
      <div className={`flex h-full w-full flex-col items-center justify-center gap-2 px-4 text-center text-xs text-amber-200 ${className ?? ""}`.trim()}>
        <div>Model not found</div>
        <div className="text-xs text-amber-300">{textureError || meshPath}</div>
      </div>
    );
  }

  return (
    <div className={`h-full w-full ${className ?? ""}`.trim()}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ fov: 32, near: 0.01, far: 1000 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, outputColorSpace: THREE.SRGBColorSpace }}
        onCreated={({ gl }) => {
          gl.toneMappingExposure = 1.2;
        }}
      >
        <Suspense fallback={null}>
          <MeshScene
            meshPath={meshPath}
            overlaySvgPath={overlaySvgPath}
            colorHex={colorHex}
            colorId={colorId}
            placement={placement}
            wrapWidthMm={wrapWidthMm}
            debug={debug}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
