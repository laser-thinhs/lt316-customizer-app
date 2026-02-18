"use client";

import { useEffect, useRef } from "react";

type Props = {
  diameterMm?: number | null;
  heightMm?: number | null;
  designSvgUrl?: string;
  rotationDeg?: number | null;
  onRotationDegChange?: (nextRotation: number) => void;
  offsetYMm?: number | null;
  engraveZoneHeightMm?: number | null;
};

export default function TumblerPreview3D({
  diameterMm = 76.2,
  heightMm = 100,
  designSvgUrl = "",
  rotationDeg = 0,
  onRotationDegChange,
  offsetYMm = 0,
  engraveZoneHeightMm = 100
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Dynamically load Three.js to avoid SSR issues
    import("three").then((THREE) => {
      try {
        const width = containerRef.current!.clientWidth;
        const height = containerRef.current!.clientHeight;

        // Scene
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a1a2e);

        // Camera
        const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        camera.position.set(150, 60, 150);
        camera.lookAt(0, 0, 0);

        // Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio);
        containerRef.current!.appendChild(renderer.domElement);

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(100, 100, 100);
        scene.add(directionalLight);

        // Cylinder
        const radius = (diameterMm ?? 76.2) / 2;
        const cylinderHeight = heightMm ?? 100;
        const geometry = new THREE.CylinderGeometry(radius, radius, cylinderHeight, 64, 32);

        // Canvas texture
        const canvas = document.createElement("canvas");
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const gradient = ctx.createLinearGradient(0, 0, 512, 512);
          gradient.addColorStop(0, "#2d3e50");
          gradient.addColorStop(1, "#34495e");
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, 512, 512);

          ctx.fillStyle = "#ecf0f1";
          ctx.font = "bold 24px Arial";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("Design Here", 256, 226);
          ctx.font = "14px Arial";
          ctx.fillText("(Upload artwork to preview)", 256, 276);
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearFilter;

        const material = new THREE.MeshPhongMaterial({
          map: texture,
          side: THREE.DoubleSide,
          shininess: 30
        });

        const cylinder = new THREE.Mesh(geometry, material);
        cylinder.rotation.y = (rotationDeg ?? 0) * (Math.PI / 180);
        cylinder.position.y = Number(offsetYMm ?? 0);
        scene.add(cylinder);

        if (ctx && designSvgUrl) {
          ctx.fillStyle = "#22c55e";
          ctx.font = "12px Arial";
          ctx.fillText(`Artwork: ${designSvgUrl.split("/").pop() ?? "linked"}`, 256, 308);
          texture.needsUpdate = true;
        }

        if (ctx && Number.isFinite(engraveZoneHeightMm)) {
          const guideY = Math.max(20, Math.min(492, 512 - Number(engraveZoneHeightMm) * 2));
          ctx.strokeStyle = "#f59e0b";
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.moveTo(40, guideY);
          ctx.lineTo(472, guideY);
          ctx.stroke();
          ctx.setLineDash([]);
          texture.needsUpdate = true;
        }

        // Animation
        let animationId: number;
        const animate = () => {
          animationId = requestAnimationFrame(animate);
          renderer.render(scene, camera);
        };
        animate();

        // Cleanup
        return () => {
          cancelAnimationFrame(animationId);
          if (containerRef.current?.contains(renderer.domElement)) {
            containerRef.current.removeChild(renderer.domElement);
          }
          geometry.dispose();
          material.dispose();
          texture.dispose();
          renderer.dispose();
        };
      } catch (err) {
        console.error("Three.js error:", err);
      }
    });
  }, [diameterMm, heightMm, designSvgUrl, rotationDeg, offsetYMm, engraveZoneHeightMm]);

  const rotateBy = (deltaDeg: number) => {
    const normalized = ((((rotationDeg ?? 0) + deltaDeg) % 360) + 360) % 360;
    onRotationDegChange?.(Number(normalized.toFixed(2)));
  };

  return (
    <div className="relative h-full w-full" style={{ minHeight: "420px" }}>
      <div
        ref={containerRef}
        className="h-full w-full rounded bg-slate-900"
        style={{ minHeight: "420px" }}
      />

      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex items-center justify-center">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-slate-950/80 px-3 py-2 text-white shadow">
          <button
            type="button"
            onClick={() => rotateBy(-15)}
            className="rounded-full border border-white/30 px-2 py-1 text-sm leading-none hover:bg-white/10"
            aria-label="Rotate model left"
          >
            ←
          </button>
          <span className="min-w-16 text-center text-xs tabular-nums">{(rotationDeg ?? 0).toFixed(1)}°</span>
          <button
            type="button"
            onClick={() => rotateBy(15)}
            className="rounded-full border border-white/30 px-2 py-1 text-sm leading-none hover:bg-white/10"
            aria-label="Rotate model right"
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}
