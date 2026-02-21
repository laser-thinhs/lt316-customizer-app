"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  diameterMm?: number | null;
  heightMm?: number | null;
  designParams?: any;
  secondaryDesignParams?: any;
  designSvgUrl?: string | null;
  rotationDeg?: number | null;
  offsetYMm?: number | null;
  engraveZoneHeightMm?: number | null;
  onTextureErrorChange?: (message: string | null) => void;
  textureReloadKey?: number;
};

export default function TumblerPreview3D({
  diameterMm = 76.2,
  heightMm = 100,
  designParams,
  secondaryDesignParams,
  designSvgUrl,
  rotationDeg = 0,
  offsetYMm = 0,
  engraveZoneHeightMm = 100,
  onTextureErrorChange,
  textureReloadKey = 0
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>("");
  const resolvedDesignParams = useMemo(
    () => (designSvgUrl ? { ...(designParams ?? {}), assetUrl: designSvgUrl } : designParams),
    [designParams, designSvgUrl]
  );
  const designLayers = useMemo(
    () => [resolvedDesignParams, secondaryDesignParams].filter((layer) => Boolean(layer?.assetUrl)),
    [resolvedDesignParams, secondaryDesignParams]
  );

  // Ensure all values are valid numbers
  const safeDiameterMm = typeof diameterMm === "number" && isFinite(diameterMm) ? diameterMm : 76.2;
  const safeHeightMm = typeof heightMm === "number" && isFinite(heightMm) ? heightMm : 100;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const initThree = async () => {
      try {
        setIsLoading(true);
        setDebugInfo(`Initializing... designParams: ${JSON.stringify(resolvedDesignParams)}`);
        
        // Dynamically import Three.js
        const THREE = await import("three");

        // Scene setup
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a1a2e);

        // Camera
        const width = container.clientWidth;
        const height = container.clientHeight;
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        camera.position.set(0, 0, 250);
        camera.lookAt(0, 0, 0);

        // Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;
        container.innerHTML = "";
        container.appendChild(renderer.domElement);

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(150, 150, 150);
        directionalLight.castShadow = true;
        scene.add(directionalLight);

        const pointLight = new THREE.PointLight(0xffffff, 0.5);
        pointLight.position.set(-150, 100, 150);
        scene.add(pointLight);

        // Cylinder
        const radiusMm = safeDiameterMm / 2;
        const circumMm = radiusMm * 2 * Math.PI;
        const mmScale = typeof resolvedDesignParams?.mmScale === "number" && isFinite(resolvedDesignParams.mmScale)
          ? resolvedDesignParams.mmScale
          : 3;
        const geometry = new THREE.CylinderGeometry(radiusMm, radiusMm, safeHeightMm, 64, 32);

        // Create texture canvas
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(circumMm * mmScale);
        canvas.height = Math.ceil(safeHeightMm * mmScale);
        
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Failed to get canvas context");

        // White background
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw image layers if available
        if (designLayers.length) {
          setDebugInfo(`Loading ${designLayers.length} artwork layer(s)`);

          for (const layer of designLayers) {
            const img = new Image();
            img.crossOrigin = "anonymous";

            await new Promise<void>((resolve, reject) => {
              img.onload = () => {
                const x = (layer.xMm || 0) * mmScale;
                const y = (layer.yMm ?? offsetYMm ?? 0) * mmScale;
                const w = (layer.widthMm || 100) * mmScale;
                const h = (layer.heightMm || 100) * mmScale;
                const rot = (((layer.rotationDeg ?? rotationDeg ?? 0) * Math.PI) / 180);

                ctx.save();
                ctx.globalAlpha = layer.opacity || 1;

                // Rotate around center
                const centerX = x + w / 2;
                const centerY = y + h / 2;
                ctx.translate(centerX, centerY);
                ctx.rotate(rot);
                ctx.translate(-centerX, -centerY);

                ctx.drawImage(img, x, y, w, h);
                ctx.restore();

                resolve();
              };
              img.onerror = (err) => {
                setDebugInfo(`Image load error: ${err}`);
                reject(new Error("Failed to load image"));
              };
              img.src = layer.assetUrl;
            });
          }
        } else {
          setDebugInfo("No asset URL provided");
        }

        // Draw seam lines
        ctx.strokeStyle = "rgba(255, 0, 0, 0.5)";
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

        // Draw grid for reference
        ctx.strokeStyle = "rgba(200, 200, 200, 0.2)";
        ctx.lineWidth = 1;
        const gridSpacing = 20 * mmScale;
        for (let x = 0; x < canvas.width; x += gridSpacing) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvas.height);
          ctx.stroke();
        }

        // Apply texture
        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearFilter;
        
        const material = new THREE.MeshPhongMaterial({ 
          map: texture, 
          shininess: 30,
          side: THREE.FrontSide
        });

        const cylinder = new THREE.Mesh(geometry, material);
        cylinder.castShadow = true;
        cylinder.receiveShadow = true;
        scene.add(cylinder);

        // Ground
        const groundGeometry = new THREE.PlaneGeometry(600, 600);
        const groundMaterial = new THREE.ShadowMaterial({ opacity: 0.3 });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -safeHeightMm / 2 - 20;
        ground.receiveShadow = true;
        scene.add(ground);

        // Mouse state
        let isDown = false;
        let startX = 0;
        let startY = 0;
        let rotX = 0;
        let rotY = 0;
        let targetRotX = 0;
        let targetRotY = 0;
        let zoom = 250;

        // Mouse events
        const onMouseDown = (e: MouseEvent) => {
          isDown = true;
          startX = e.clientX;
          startY = e.clientY;
          renderer.domElement.style.cursor = "grabbing";
        };

        const onMouseMove = (e: MouseEvent) => {
          if (!isDown) return;
          const deltaX = e.clientX - startX;
          const deltaY = e.clientY - startY;
          targetRotY += deltaX * 0.005;
          targetRotX += deltaY * 0.005;
          startX = e.clientX;
          startY = e.clientY;
        };

        const onMouseUp = () => {
          isDown = false;
          renderer.domElement.style.cursor = "grab";
        };

        const onWheel = (e: WheelEvent) => {
          e.preventDefault();
          zoom += (e.deltaY > 0 ? 1 : -1) * 15;
          zoom = Math.max(100, Math.min(600, zoom));
        };

        const onMouseEnter = () => {
          renderer.domElement.style.cursor = "grab";
        };

        const onMouseLeave = () => {
          isDown = false;
          renderer.domElement.style.cursor = "default";
        };

        renderer.domElement.addEventListener("mousedown", onMouseDown);
        renderer.domElement.addEventListener("mousemove", onMouseMove);
        renderer.domElement.addEventListener("mouseup", onMouseUp);
        renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
        renderer.domElement.addEventListener("mouseenter", onMouseEnter);
        renderer.domElement.addEventListener("mouseleave", onMouseLeave);

        // Animation loop
        const animate = () => {
          requestAnimationFrame(animate);

          rotX += (targetRotX - rotX) * 0.15;
          rotY += (targetRotY - rotY) * 0.15;
          rotX = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, rotX));

          cylinder.rotation.x = rotX;
          cylinder.rotation.y = rotY;
          camera.position.z = zoom;

          renderer.render(scene, camera);
        };
        animate();

        // Resize handler
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
        setDebugInfo("3D loaded successfully");

        return () => {
          window.removeEventListener("resize", handleResize);
          renderer.domElement.removeEventListener("mousedown", onMouseDown);
          renderer.domElement.removeEventListener("mousemove", onMouseMove);
          renderer.domElement.removeEventListener("mouseup", onMouseUp);
          renderer.domElement.removeEventListener("wheel", onWheel);
          renderer.domElement.removeEventListener("mouseenter", onMouseEnter);
          renderer.domElement.removeEventListener("mouseleave", onMouseLeave);
          if (containerRef.current?.contains(renderer.domElement)) {
            containerRef.current.removeChild(renderer.domElement);
          }
          geometry.dispose();
          material.dispose();
          texture.dispose();
          renderer.dispose();
        };
      } catch (err) {
        console.error("Error initializing Three.js:", err);
        const errMsg = err instanceof Error ? err.message : "Failed to load 3D view";
        setError(errMsg);
        setDebugInfo(`Error: ${errMsg}`);
        setIsLoading(false);
      }
    };

    initThree();
  }, [safeDiameterMm, safeHeightMm, resolvedDesignParams, designLayers, textureReloadKey, rotationDeg, offsetYMm]);

  if (error) {
    return (
      <div className="relative h-full w-full rounded bg-red-900/20 flex items-center justify-center" style={{ minHeight: "420px" }}>
        <p className="text-sm text-red-200">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full rounded bg-slate-900 overflow-hidden" style={{ minHeight: "420px" }}>
      <div ref={containerRef} className="h-full w-full" />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded">
          <p className="text-sm text-white">Loading 3D...</p>
        </div>
      )}
      <div className="absolute bottom-2 left-2 text-xs text-slate-300 pointer-events-none bg-black/40 px-2 py-1 rounded max-w-[200px]">
        <p className="font-semibold">Ø {safeDiameterMm.toFixed(1)}mm × H {safeHeightMm.toFixed(1)}mm</p>
        <p className="text-slate-400">🖱️ Drag to rotate • 🔄 Scroll to zoom</p>
        <p className="text-slate-500 mt-1 break-words text-[10px]">{debugInfo}</p>
      </div>
    </div>
  );
}
