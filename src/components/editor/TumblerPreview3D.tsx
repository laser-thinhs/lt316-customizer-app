"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { createCylinderTexture, type DesignParams } from "@/lib/rendering/cylinderTexture";
import { circumferenceMm } from "@/lib/geometry/cylinder";

type Props = {
  diameterMm?: number | null;
  heightMm?: number | null;
  designParams?: DesignParams | null;
  rotationDeg?: number | null;
  offsetYMm?: number | null;
  engraveZoneHeightMm?: number | null;
};

export default function TumblerPreview3D({
  diameterMm = 76.2,
  heightMm = 100,
  designParams,
  rotationDeg = 0,
  offsetYMm = 0,
  engraveZoneHeightMm = 100
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const cylinderRef = useRef<THREE.Mesh | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animationIdRef = useRef<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Mouse control state
  const mouseStateRef = useRef({
    isDown: false,
    startX: 0,
    startY: 0,
    rotationX: 0,
    rotationY: 0,
    targetRotationX: 0,
    targetRotationY: 0
  });

  // Ensure all values are valid numbers
  const safeDiameterMm = typeof diameterMm === "number" && isFinite(diameterMm) ? diameterMm : 76.2;
  const safeHeightMm = typeof heightMm === "number" && isFinite(heightMm) ? heightMm : 100;
  const safeOffsetYMm = typeof offsetYMm === "number" && isFinite(offsetYMm) ? offsetYMm : 0;

  useEffect(() => {
    if (!containerRef.current) return;

    try {
      setIsLoading(true);

      // Scene setup
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x1a1a2e);
      sceneRef.current = scene;

      // Camera
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
      camera.position.set(0, 0, 200);
      camera.lookAt(0, 0, 0);
      cameraRef.current = camera;

      // Renderer
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.shadowMap.enabled = true;
      containerRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // Lights
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
      directionalLight.position.set(100, 100, 100);
      directionalLight.castShadow = true;
      directionalLight.shadow.mapSize.width = 1024;
      directionalLight.shadow.mapSize.height = 1024;
      scene.add(directionalLight);

      const pointLight = new THREE.PointLight(0xffffff, 0.4);
      pointLight.position.set(-100, 50, 100);
      scene.add(pointLight);

      // Cylinder geometry
      const radiusMm = safeDiameterMm / 2;
      const geometry = new THREE.CylinderGeometry(radiusMm, radiusMm, safeHeightMm, 64, 32);

      // Create initial material with placeholder texture
      const placeholderTexture = createPlaceholderTexture(radiusMm * 2 * Math.PI, safeHeightMm);
      const material = new THREE.MeshPhongMaterial({
        map: placeholderTexture,
        side: THREE.FrontSide,
        shininess: 30
      });

      const cylinder = new THREE.Mesh(geometry, material);
      cylinder.castShadow = true;
      cylinder.receiveShadow = true;
      scene.add(cylinder);
      cylinderRef.current = cylinder;

      // Update texture if design params provided
      if (designParams) {
        updateCylinderTexture(cylinder, radiusMm, safeHeightMm, designParams).catch(console.error);
      }

      // Ground plane
      const groundGeometry = new THREE.PlaneGeometry(400, 400);
      const groundMaterial = new THREE.ShadowMaterial({ opacity: 0.3 });
      const ground = new THREE.Mesh(groundGeometry, groundMaterial);
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -safeHeightMm / 2 - 10;
      ground.receiveShadow = true;
      scene.add(ground);

      // Mouse event listeners
      const onMouseDown = (e: MouseEvent) => {
        mouseStateRef.current.isDown = true;
        mouseStateRef.current.startX = e.clientX;
        mouseStateRef.current.startY = e.clientY;
        if (renderer.domElement.style.cursor !== "grab") {
          renderer.domElement.style.cursor = "grabbing";
        }
      };

      const onMouseMove = (e: MouseEvent) => {
        if (!mouseStateRef.current.isDown) return;

        const deltaX = e.clientX - mouseStateRef.current.startX;
        const deltaY = e.clientY - mouseStateRef.current.startY;

        mouseStateRef.current.targetRotationY += deltaX * 0.01;
        mouseStateRef.current.targetRotationX += deltaY * 0.01;

        mouseStateRef.current.startX = e.clientX;
        mouseStateRef.current.startY = e.clientY;
      };

      const onMouseUp = () => {
        mouseStateRef.current.isDown = false;
        renderer.domElement.style.cursor = "grab";
      };

      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        const zoomSpeed = 10;
        const direction = e.deltaY > 0 ? 1 : -1;
        camera.position.z += direction * zoomSpeed;
        camera.position.z = Math.max(50, Math.min(500, camera.position.z));
      };

      const onMouseEnter = () => {
        renderer.domElement.style.cursor = "grab";
      };

      const onMouseLeave = () => {
        mouseStateRef.current.isDown = false;
        renderer.domElement.style.cursor = "default";
      };

      renderer.domElement.addEventListener("mousedown", onMouseDown);
      renderer.domElement.addEventListener("mousemove", onMouseMove);
      renderer.domElement.addEventListener("mouseup", onMouseUp);
      renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
      renderer.domElement.addEventListener("mouseenter", onMouseEnter);
      renderer.domElement.addEventListener("mouseleave", onMouseLeave);

      // Animation loop
      let animationId: number;
      const animate = () => {
        animationId = requestAnimationFrame(animate);

        if (cylinderRef.current) {
          // Smooth rotation towards target
          mouseStateRef.current.rotationX += (mouseStateRef.current.targetRotationX - mouseStateRef.current.rotationX) * 0.1;
          mouseStateRef.current.rotationY += (mouseStateRef.current.targetRotationY - mouseStateRef.current.rotationY) * 0.1;

          // Clamp X rotation to prevent flipping
          mouseStateRef.current.rotationX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, mouseStateRef.current.rotationX));

          cylinderRef.current.rotation.x = mouseStateRef.current.rotationX;
          cylinderRef.current.rotation.y = mouseStateRef.current.rotationY;
        }

        renderer.render(scene, camera);
      };
      animate();
      animationIdRef.current = animationId;

      // Handle resize
      const handleResize = () => {
        if (!containerRef.current) return;
        const newWidth = containerRef.current.clientWidth;
        const newHeight = containerRef.current.clientHeight;
        camera.aspect = newWidth / newHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(newWidth, newHeight);
      };
      window.addEventListener("resize", handleResize);

      setIsLoading(false);

      // Cleanup
      return () => {
        window.removeEventListener("resize", handleResize);
        renderer.domElement.removeEventListener("mousedown", onMouseDown);
        renderer.domElement.removeEventListener("mousemove", onMouseMove);
        renderer.domElement.removeEventListener("mouseup", onMouseUp);
        renderer.domElement.removeEventListener("wheel", onWheel);
        renderer.domElement.removeEventListener("mouseenter", onMouseEnter);
        renderer.domElement.removeEventListener("mouseleave", onMouseLeave);
        if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current);
        if (containerRef.current?.contains(renderer.domElement)) {
          containerRef.current.removeChild(renderer.domElement);
        }
        geometry.dispose();
        material.dispose();
        placeholderTexture.dispose();
        renderer.dispose();
      };
    } catch (error) {
      console.error("Error in TumblerPreview3D:", error);
      setIsLoading(false);
    }
  }, [safeDiameterMm, safeHeightMm]);

  // Update texture when design params change
  useEffect(() => {
    if (!cylinderRef.current || !designParams) return;

    const updateTexture = async () => {
      try {
        const radiusMm = safeDiameterMm / 2;
        await updateCylinderTexture(cylinderRef.current!, radiusMm, safeHeightMm, designParams);
      } catch (error) {
        console.error("Failed to update texture:", error);
      }
    };

    updateTexture();
  }, [designParams, safeDiameterMm, safeHeightMm]);

  return (
    <div className="relative h-full w-full rounded bg-slate-900 overflow-hidden" style={{ minHeight: "420px" }}>
      <div ref={containerRef} className="h-full w-full" />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded">
          <p className="text-sm text-white">Loading texture...</p>
        </div>
      )}
      <div className="absolute bottom-2 left-2 text-xs text-slate-400 pointer-events-none">
        <p>Ø {safeDiameterMm.toFixed(1)}mm × H {safeHeightMm.toFixed(1)}mm</p>
        <p>Drag to rotate • Scroll to zoom</p>
      </div>
    </div>
  );
}

/**
 * Create a placeholder texture with grid and text
 */
function createPlaceholderTexture(widthMm: number, heightMm: number, mmScale = 3): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(widthMm * mmScale);
  canvas.height = Math.ceil(heightMm * mmScale);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get canvas context");

  // Gradient background
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#2d3e50");
  gradient.addColorStop(1, "#34495e");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Grid
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 1;
  const gridPx = 10 * mmScale;
  for (let x = 0; x <= canvas.width; x += gridPx) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  // Seam line
  ctx.strokeStyle = "rgba(255, 0, 0, 0.4)";
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, canvas.height);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(canvas.width - 1, 0);
  ctx.lineTo(canvas.width - 1, canvas.height);
  ctx.stroke();
  ctx.setLineDash([]);

  // Text
  ctx.fillStyle = "#ecf0f1";
  ctx.font = "bold 24px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Upload Design", canvas.width / 2, canvas.height / 2 - 30);
  ctx.font = "14px Arial";
  ctx.fillText("(will wrap around)", canvas.width / 2, canvas.height / 2 + 20);

  return new THREE.CanvasTexture(canvas);
}

/**
 * Update cylinder texture with design
 */
async function updateCylinderTexture(
  cylinder: THREE.Mesh,
  radiusMm: number,
  heightMm: number,
  designParams: DesignParams
): Promise<void> {
  const circumMm = radiusMm * 2 * Math.PI;

  // Create texture canvas
  const textureCanvas = await createCylinderTexture({
    circumferenceMm: circumMm,
    heightMm,
    designParams
  });

  // Convert to Three.js texture
  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;

  // Update material
  const material = cylinder.material as THREE.MeshPhongMaterial;
  if (material.map) material.map.dispose();
  material.map = texture;
  material.needsUpdate = true;
}
