"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { ZoneRisk } from "@/types/climate";

interface GlobeMapProps {
  zones: ZoneRisk[];
  autoRotate?: boolean;
}

const latLonToVector3 = (latDeg: number, lonDeg: number, radius: number): THREE.Vector3 => {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;

  const x = radius * Math.cos(lat) * Math.cos(lon);
  const y = radius * Math.sin(lat);
  const z = radius * Math.cos(lat) * Math.sin(lon);

  return new THREE.Vector3(x, y, z);
};

const createLabelSprite = (label: string, score: number): THREE.Sprite => {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    const bg = score >= 0.65 ? "rgba(127, 29, 29, 0.92)" : "rgba(15, 23, 42, 0.9)";
    const stroke = score >= 0.65 ? "rgba(252, 165, 165, 0.95)" : "rgba(125, 211, 252, 0.9)";

    ctx.fillStyle = bg;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 4;

    const radius = 24;
    const w = canvas.width - 16;
    const h = canvas.height - 16;
    const x = 8;
    const y = 8;

    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();

    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#f8fafc";
    ctx.font = "700 42px Segoe UI";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label.toUpperCase(), canvas.width / 2, canvas.height / 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });

  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.64, 0.16, 1);
  sprite.renderOrder = 10;

  return sprite;
};

const colorFromScore = (score: number): number => {
  if (score >= 0.85) return 0x9f1239; // dark red
  if (score >= 0.65) return 0xdc2626; // red
  if (score >= 0.4) return 0xf59e0b; // amber
  return 0x10b981; // emerald
};

export default function GlobeMap({ zones, autoRotate = true }: GlobeMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const globeGroupRef = useRef<THREE.Group | null>(null);
  const markersRef = useRef<THREE.Group | null>(null);
  const labelsRef = useRef<THREE.Group | null>(null);
  const animationIdRef = useRef<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x0f172a);

    // Camera setup
    const width = container.clientWidth;
    const height = container.clientHeight;
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 10000);
    camera.position.z = 2.5;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Create globe
    const geometry = new THREE.IcosahedronGeometry(1, 32);
    const canvas = document.createElement("canvas");
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      // Create a simple gradient texture
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, "#1e3a8a");
      gradient.addColorStop(0.5, "#0369a1");
      gradient.addColorStop(1, "#164e63");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Add some noise/texture
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      for (let i = 0; i < 1000; i++) {
        ctx.fillRect(
          Math.random() * canvas.width,
          Math.random() * canvas.height,
          Math.random() * 20,
          Math.random() * 20,
        );
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshPhongMaterial({
      map: texture,
      emissive: 0x1a365d,
      shininess: 5,
    });
    const globe = new THREE.Mesh(geometry, material);
    const globeGroup = new THREE.Group();
    globeGroup.add(globe);
    globeGroupRef.current = globeGroup;
    scene.add(globeGroup);

    // Lighting
    const light = new THREE.DirectionalLight(0xffffff, 0.8);
    light.position.set(5, 3, 5);
    scene.add(light);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    // Create markers group
    const markersGroup = new THREE.Group();
    markersRef.current = markersGroup;
    globeGroup.add(markersGroup);

    const labelsGroup = new THREE.Group();
    labelsRef.current = labelsGroup;
    globeGroup.add(labelsGroup);

    const taggedZoneIds = new Set(
      [...zones]
        .sort((a, b) => b.overallScore - a.overallScore)
        .slice(0, 24)
        .map((zone) => zone.id),
    );

    // Add zone markers
    for (const zone of zones) {
      const markerPosition = latLonToVector3(zone.lat, zone.lon, 1.02);
      const labelPosition = latLonToVector3(zone.lat, zone.lon, 1.13);

      const size = Math.max(0.02, Math.min(0.08, zone.overallScore * 0.08));
      const markerGeom = new THREE.SphereGeometry(size, 8, 8);
      const markerMat = new THREE.MeshStandardMaterial({
        color: colorFromScore(zone.overallScore),
        emissive: colorFromScore(zone.overallScore),
        emissiveIntensity: 0.5,
      });
      const marker = new THREE.Mesh(markerGeom, markerMat);
      marker.position.copy(markerPosition);
      marker.userData = { zone };
      markersGroup.add(marker);

      if (taggedZoneIds.has(zone.id)) {
        const scoreLabel = `${zone.name} ${(zone.overallScore * 100).toFixed(0)}%`;
        const tag = createLabelSprite(scoreLabel, zone.overallScore);
        tag.position.copy(labelPosition);
        labelsGroup.add(tag);
      }
    }

    // Handle window resize
    const handleResize = () => {
      const newWidth = container.clientWidth || width;
      const newHeight = container.clientHeight || height;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };
    window.addEventListener("resize", handleResize);

    // Animation loop
    const rotationSpeed = 0.0035;
    const pulseOffset = Math.random() * Math.PI * 2;
    const clock = new THREE.Clock();
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();
      const delta = clock.getDelta();

      if (autoRotate && globeGroup) {
        globeGroup.rotation.y += rotationSpeed * delta * 60;
      }

      if (markersGroup) {
        markersGroup.children.forEach((marker) => {
          // Pulse effect
          const scale = 1 + Math.sin(elapsed * 3 + pulseOffset) * 0.12;
          marker.scale.set(scale, scale, scale);
        });
      }

      if (labelsGroup) {
        labelsGroup.children.forEach((tag, index) => {
          const material = tag instanceof THREE.Sprite ? tag.material : null;
          if (material instanceof THREE.SpriteMaterial) {
            material.opacity = 0.92 + Math.sin(elapsed * 2 + index * 0.35) * 0.08;
          }
        });
      }

      renderer.render(scene, camera);
    };
    animate();

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [zones, autoRotate]);

  return (
    <div
      ref={containerRef}
      className="relative h-[420px] w-full overflow-hidden rounded-2xl border border-white/15 shadow-2xl shadow-cyan-950/30"
      style={{ background: "#0f172a" }}
    >
      <div className="pointer-events-none absolute left-3 top-3 z-[500] rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100">
        🌍 3D Globe with live risk markers
      </div>
    </div>
  );
}
