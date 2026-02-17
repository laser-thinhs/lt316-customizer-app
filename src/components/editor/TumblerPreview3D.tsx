"use client";

import { useEffect, useRef } from "react";

type Props = {
  diameterMm?: number | null;
  heightMm?: number | null;
  designSvgUrl?: string;
  rotationDeg?: number | null;
  offsetYMm?: number | null;
  engraveZoneHeightMm?: number | null;
};

export default function TumblerPreview3D({
  diameterMm = 76.2,
  heightMm = 100,
  designSvgUrl,
  rotationDeg = 0,
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
        const height = heightMm ?? 100;
        const geometry = new THREE.CylinderGeometry(radius, radius, height, 64, 32);

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
        scene.add(cylinder);

        // Animation
        let animationId: number;
        const animate = () => {
          animationId = requestAnimationFrame(animate);
          cylinder.rotation.y += 0.005;
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
  }, [diameterMm, heightMm]);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full rounded bg-slate-900"
      style={{ minHeight: "420px" }}
    />
  );
}
