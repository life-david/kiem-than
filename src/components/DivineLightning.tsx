import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useHandStore, CONFIG } from '../store';

// Get SwordSwarm positions (needs sharing)
// For simplicity, we maintain a positions reference here
// Should actually share via store, but using window to keep original logic simple

declare global {
  interface Window {
    swordPositions?: THREE.Vector3[];
  }
}

export function DivineLightning() {
  const lineRef = useRef<THREE.LineSegments>(null);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const posArray = new Float32Array(100 * 3 * 2); // 100 segments
    geo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    return geo;
  }, []);

  const material = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: 0xffdd44,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
      }),
    []
  );

  // Intensity smooth transition ref
  const intensityRef = useRef(0);

  useFrame(({ clock }) => {
    if (!lineRef.current) return;

    const isTracking = useHandStore.getState().isTracking;
    const gestureMode = useHandStore.getState().gestureMode;
    const time = clock.getElapsedTime();

    // Target intensity: 1 for Grand Geng mode, 0 for others
    const targetIntensity = gestureMode === 'DAGENG' ? 1 : 0;
    // Smooth interpolation: Speed consistent with sword enlargement (0.02)
    intensityRef.current = THREE.MathUtils.lerp(
      intensityRef.current,
      targetIntensity,
      0.02
    );
    const intensity = intensityRef.current;

    // Dynamically calculate parameters
    // Flash speed: 15 -> 25
    const flashSpeed = 15 + intensity * 10;
    // Flash threshold: 0.7 -> 0.4 (Lower value means longer flash)
    const flashThreshold = 0.7 - intensity * 0.3;

    // Connection line count: 30 -> 100
    const count = Math.floor(30 + intensity * 70);
    // Connection distance: 5 -> 25
    const maxDist = 5 + intensity * 20;
    // Jitter: 0.2 -> 0.5
    const jitter = 0.2 + intensity * 0.3;

    // Flash logic
    const flash = Math.sin(time * flashSpeed) > flashThreshold;
    lineRef.current.visible = flash && isTracking;
    if (!flash || !isTracking) return;

    const positions = window.swordPositions;
    if (!positions || positions.length === 0) return;

    const posAttr = lineRef.current.geometry.attributes.position;
    const arr = posAttr.array as Float32Array;
    let idx = 0;

    for (let i = 0; i < count; i++) {
      const a = Math.floor(Math.random() * CONFIG.swordCount);
      const b = Math.floor(Math.random() * CONFIG.swordCount);

      if (a >= positions.length || b >= positions.length) continue;

      const pA = positions[a];
      const pB = positions[b];

      if (pA.distanceTo(pB) < maxDist) {
        arr[idx++] = pA.x + (Math.random() - 0.5) * jitter;
        arr[idx++] = pA.y + (Math.random() - 0.5) * jitter;
        arr[idx++] = pA.z + (Math.random() - 0.5) * jitter;
        arr[idx++] = pB.x + (Math.random() - 0.5) * jitter;
        arr[idx++] = pB.y + (Math.random() - 0.5) * jitter;
        arr[idx++] = pB.z + (Math.random() - 0.5) * jitter;
      }
    }
    // Clear remaining
    while (idx < arr.length) arr[idx++] = 0;
    posAttr.needsUpdate = true;
  });

  return <lineSegments ref={lineRef} geometry={geometry} material={material} />;
}
