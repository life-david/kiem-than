import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useHandStore, CONFIG } from '../store';
import type { GestureMode } from '../store';

// Simplified Simplex Noise
const simplex = {
  noise3D: (x: number, y: number, z: number) => {
    return (
      Math.sin(x * 1.2 + y * 0.8) *
      Math.cos(y * 1.1 + z * 0.9) *
      Math.sin(z * 0.7 + x * 1.3)
    );
  },
};

// Share positions to DivineLightning
declare global {
  interface Window {
    swordPositions?: THREE.Vector3[];
  }
}

export function SwordSwarm() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const auraRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Physics state
  const positions = useRef<THREE.Vector3[]>([]);
  const velocities = useRef<THREE.Vector3[]>([]);

  // Initialization
  if (positions.current.length === 0) {
    for (let i = 0; i < CONFIG.swordCount; i++) {
      positions.current.push(
        new THREE.Vector3(
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 15,
          (Math.random() - 0.5) * 10 - 5
        )
      );
      velocities.current.push(new THREE.Vector3());
    }
    window.swordPositions = positions.current;
  }

  // Sword geometry
  const geometry = useMemo(() => {
    const bladeGeo = new THREE.ConeGeometry(0.12, 2.5, 4);
    bladeGeo.scale(0.4, 1, 1);
    bladeGeo.rotateX(Math.PI / 2);
    bladeGeo.translate(0, 0, 1.0);

    const guardGeo = new THREE.BoxGeometry(0.5, 0.08, 0.15);
    guardGeo.translate(0, 0, -0.2);

    const handleGeo = new THREE.CylinderGeometry(0.05, 0.06, 0.7, 6);
    handleGeo.rotateX(Math.PI / 2);
    handleGeo.translate(0, 0, -0.6);

    const merged = mergeGeometries([bladeGeo, guardGeo, handleGeo]);
    return merged || bladeGeo;
  }, []);

  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: 0x00ff88,
        transparent: true,
        opacity: 0.9,
      }),
    []
  );

  const auraGeometry = useMemo(() => {
    const auraGeo = new THREE.ConeGeometry(0.15, 2.6, 4);
    auraGeo.scale(0.5, 1, 1);
    auraGeo.rotateX(Math.PI / 2);
    auraGeo.translate(0, 0, 1.0);
    return auraGeo;
  }, []);

  const auraMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: 0xffdd44,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
      }),
    []
  );

  useFrame(({ clock }) => {
    if (!meshRef.current) return;

    const targetPosition = useHandStore.getState().targetPosition;
    const isTracking = useHandStore.getState().isTracking;
    const gestureMode = useHandStore.getState().gestureMode;
    const pathHistory = useHandStore.getState().pathHistory;
    const extendPath = useHandStore.getState().extendPath;

    const time = clock.getElapsedTime();
    const delta = 1 / 60;

    // Auto-hover when no gesture: use default LOTUS mode
    let currentTarget = targetPosition;
    if (!isTracking) {
      currentTarget = new THREE.Vector3(0, 0, 0);
      // Still update history path to prevent jump on switch
      pathHistory.pop();
      pathHistory.unshift(currentTarget.clone());
    } else if (gestureMode === 'DRAGON') {
      extendPath();
    }

    // Calculate target based on mode
    for (let i = 0; i < CONFIG.swordCount; i++) {
      const pos = positions.current[i];
      const vel = velocities.current[i];
      const target = new THREE.Vector3();

      if (gestureMode === 'SHIELD' && isTracking) {
        // ============ Shield Mode: Spherical Orbit ============
        // Use Fibonacci sphere uniform distribution
        const phi = Math.acos(1 - (2 * (i + 0.5)) / CONFIG.swordCount);
        const theta = Math.PI * (1 + Math.sqrt(5)) * i;

        // Base orbit position
        const orbitX =
          CONFIG.shieldRadius *
          Math.sin(phi) *
          Math.cos(theta + time * CONFIG.shieldOrbitSpeed);
        const orbitY =
          CONFIG.shieldRadius *
          Math.sin(phi) *
          Math.sin(theta + time * CONFIG.shieldOrbitSpeed);
        const orbitZ = CONFIG.shieldRadius * Math.cos(phi);

        // Add orbit rotation animation
        const rotatedX =
          orbitX * Math.cos(time * 0.3) - orbitZ * Math.sin(time * 0.3);
        const rotatedZ =
          orbitX * Math.sin(time * 0.3) + orbitZ * Math.cos(time * 0.3);

        target.set(
          currentTarget.x + rotatedX,
          currentTarget.y + orbitY,
          currentTarget.z + rotatedZ
        );

        // Add slight fluctuation
        target.x += Math.sin(time * 3 + i) * 0.2;
        target.y += Math.cos(time * 3 + i * 0.7) * 0.2;
      } else if (
        gestureMode === 'LOTUS' ||
        (gestureMode === ('LOTUS' as GestureMode) && !isTracking)
      ) {
        // ============ Lotus Mode: Fibonacci Spiral (Golden Angle) Optimization ============
        // This distribution is more like natural lotus/sunflower, visually tighter and spectacular

        // 1. Base parameters
        const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // ~137.5 degrees
        const maxRadius = CONFIG.lotusRadius;
        const minRadius = 6; // Center hollow radius

        // 2. Calculate position of each sword
        // r = c * sqrt(i), Make area distribution uniform
        // Map to [minRadius, maxRadius] range
        const t = i / (CONFIG.swordCount - 1); // 0 -> 1
        const rRatio = Math.sqrt(t);
        const r = minRadius + (maxRadius - minRadius) * rRatio;

        // 3. Angle + Rotation animation
        // Base angle + Overall rotation + Radius-dependent differential rotation (create vortex feel)
        const theta = i * goldenAngle + time * CONFIG.lotusRotateSpeed;

        // 4. Breathing effect: Overall scale
        const breathe = 1 + Math.sin(time * 2) * 0.05;
        const currentR = r * breathe;

        // 5. Coordinate calculation
        const x = currentR * Math.cos(theta);
        const y = currentR * Math.sin(theta);

        // 6. Z-axis shaping: Flat section (completely flat, only retain slight fluctuation)
        const z = Math.sin(time * 2 + i * 0.1) * 0.2; // Very small vertical float

        target.set(
          currentTarget.x + x,
          currentTarget.y + y,
          currentTarget.z + z
        );

        // 7. Sword orientation
        // Unique to Lotus mode: Sword self-rotation, adds liveliness
        // (This part is implemented by modifying up vector or extra rotation matrix, keeping position correct here for now)
      } else if (gestureMode === 'DAGENG' && isTracking) {
        // ============ Grand Geng Sword Array ============

        // Special handling: Sword 0 as [Sect Suppression Main Sword]
        if (i === 0) {
          const centralHeight = currentTarget.y + 5; // Main sword slightly higher
          target.set(currentTarget.x, centralHeight, currentTarget.z);
          // Main sword scale set uniformly below
        } else {
          // Other swords: Surround main sword
          // Fix i index so distribution calc doesn't include 0
          const effectiveI = i - 1;
          const effectiveCount = CONFIG.swordCount - 1;

          // Vertical cylinder/ring array, sword tip down
          const layerCount = 10;
          const perLayer = Math.max(1, Math.floor(effectiveCount / layerCount));
          const layerIdx = Math.floor(effectiveI / perLayer);
          const idxInLayer = effectiveI % perLayer;

          // Radius: Multi-layer concentric circles (Base radius + Layer spacing)
          // Increase base radius to leave space for main sword
          const radius = CONFIG.dagengRadius + layerIdx * 1.5 + 2;

          // Angle: Even layers clockwise, odd layers counter-clockwise
          const dir = layerIdx % 2 === 0 ? 1 : -1;
          const theta =
            (idxInLayer / perLayer) * Math.PI * 2 +
            time * CONFIG.dagengRotateSpeed * dir;

          // Height: Cylindrical distribution
          const hCenter = currentTarget.y - 10;
          const hRange = CONFIG.dagengHeight;
          const hRand = Math.sin(effectiveI * 13.1) * 0.5 + 0.5;
          const height = hCenter + (hRand - 0.5) * hRange;

          target.set(
            currentTarget.x + Math.cos(theta) * radius,
            height,
            currentTarget.z + Math.sin(theta) * radius
          );
        }
      } else {
        // ============ Dragon Mode ============
        if (i < 5) {
          target.copy(currentTarget);
          target.x += Math.sin(time * 8 + i) * 0.3;
          target.y += Math.cos(time * 8 + i) * 0.3;
        } else {
          // Dragon body: Interpolate along trajectory history
          const pathIdx = i * 0.8; // Control dragon body length (0.5 -> 0.6 slightly larger)
          const idxA = Math.min(Math.floor(pathIdx), pathHistory.length - 1);
          const idxB = Math.min(idxA + 1, pathHistory.length - 1);
          const alpha = pathIdx - Math.floor(pathIdx);

          if (pathHistory[idxA] && pathHistory[idxB]) {
            target.lerpVectors(pathHistory[idxA], pathHistory[idxB], alpha);
          } else if (pathHistory[idxA]) {
            target.copy(pathHistory[idxA]);
          } else {
            target.copy(currentTarget);
          }

          // Add specific random jitter to make dragon body more natural
          target.x += Math.sin(time * 10 + i * 0.5) * 0.2;
          target.y += Math.cos(time * 10 + i * 0.5) * 0.2;

          const ns = CONFIG.noiseScale;
          const na =
            CONFIG.noiseStrength * (0.8 + Math.sin(time * 2 + i * 0.05) * 0.4);
          target.x += simplex.noise3D(pos.x * ns, pos.y * ns, time) * na;
          target.y += simplex.noise3D(pos.y * ns, pos.z * ns, time + 100) * na;
          target.z += simplex.noise3D(pos.z * ns, pos.x * ns, time + 200) * na;
        }
      }

      // Dynamic speed (Faster in Shield mode for quick positioning)
      let speed =
        gestureMode === 'SHIELD' ? CONFIG.sprintSpeed : CONFIG.maxSpeed;
      if (target.distanceTo(pos) > 4) speed = CONFIG.sprintSpeed;
      else if (target.distanceTo(pos) < 1)
        speed = target.distanceTo(pos) * CONFIG.maxSpeed;

      // Calculate steering force
      const desired = target.sub(pos);
      const d = desired.length();

      if (d > 0) {
        desired.normalize();
        // Decelerate when approaching target (Arrival behavior)
        if (d < 10) {
          desired.multiplyScalar(speed * (d / 10));
        } else {
          desired.multiplyScalar(speed);
        }
      }

      const steer = desired.sub(vel);
      // Stronger control force needed in Shield and Lotus modes
      const steerFactor =
        gestureMode === 'SHIELD' || gestureMode === 'LOTUS' ? 3 : 1;
      steer.clampLength(0, CONFIG.steerForce * delta * steerFactor);

      vel.add(steer);

      // Separation force (Disabled in Shield and Lotus modes, unless in standby Lotus)
      if (
        i > 0 &&
        gestureMode !== 'SHIELD' &&
        (gestureMode !== 'LOTUS' || !isTracking)
      ) {
        const prev = positions.current[i - 1];
        const diff = pos.clone().sub(prev);
        const d = diff.length();
        if (d < CONFIG.separationDist && d > 0.01) {
          diff.normalize().multiplyScalar(CONFIG.separationForce * delta);
          vel.add(diff);
        }
      }

      // Update position
      pos.add(vel.clone().multiplyScalar(delta));

      // Update matrix
      dummy.position.copy(pos);

      // Orientation: Circumferential along tangent in Shield mode, diverge outward in Lotus mode, point to velocity direction in Dragon mode
      let lookTarget: THREE.Vector3;
      if (gestureMode === 'SHIELD' && isTracking) {
        // Shield mode: Directly use current velocity direction as sword orientation
        // Velocity vector represents actual movement direction of sword
        if (vel.length() > 0.1) {
          lookTarget = pos.clone().add(vel.clone().normalize());
        } else {
          // If velocity is too small, use tangent direction as backup
          const relPos = pos.clone().sub(currentTarget);
          // Tangent direction around Y axis: (-z, 0, x) normalized
          const tangent = new THREE.Vector3(-relPos.z, 0, relPos.x).normalize();
          lookTarget = pos.clone().add(tangent);
        }
      } else if (gestureMode === 'LOTUS') {
        // Lotus mode: Sword tip points outward (Diverges from center)
        const outward = pos.clone().sub(currentTarget).normalize();
        lookTarget = pos.clone().add(outward);
      } else if (gestureMode === 'DAGENG' && isTracking) {
        // Grand Geng Sword Array: Sword tip vertically down, as if ready to fall anytime
        lookTarget = pos.clone().add(new THREE.Vector3(0, -1, 0));
      } else {
        lookTarget = pos
          .clone()
          .add(vel.length() > 0.1 ? vel : new THREE.Vector3(0, 0, -1));
      }
      dummy.lookAt(lookTarget);

      // Sword body enlarges in Grand Geng mode, adding oppression (Smooth transition)
      // 2s transition: approx 0.02 lerp speed (60fps)
      let targetScale = 1;
      if (gestureMode === 'DAGENG' && isTracking) {
        if (i === 0) targetScale = 6; // Main sword giant
        else targetScale = 1.5; // Normal sword 1.5x
      }

      const currentScale = meshRef.current.userData.currentScale || 1;
      // Slower enlargement speed for main sword, more heavy feel
      const lerpSpeed = i === 0 && gestureMode === 'DAGENG' ? 0.01 : 0.02;
      const newScale = THREE.MathUtils.lerp(
        currentScale,
        targetScale,
        lerpSpeed
      );

      // Save current scale to userData for next frame usage
      meshRef.current.userData.currentScale = newScale;

      dummy.scale.set(newScale, newScale, newScale);

      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      // Update Evil-Warding Divine Lightning Aura (Brighter in Shield mode)
      if (auraRef.current) {
        const isActive =
          gestureMode === 'SHIELD'
            ? Math.sin(time * 30 + i * 0.5) > 0.0 // Shield mode: More swords light up
            : Math.sin(time * 20 + i * 0.7) > 0.3;

        // Aura follows sword size, slightly magnified
        const auraScale = newScale * (isActive ? 1.3 : 1.0);

        // If not active and not main sword, hide (Main sword Aura always on)
        if (!isActive && !(i === 0 && gestureMode === 'DAGENG')) {
          dummy.scale.set(0, 0, 0);
        } else {
          dummy.scale.set(auraScale, auraScale, auraScale);
        }

        dummy.updateMatrix();
        auraRef.current.setMatrixAt(i, dummy.matrix);
        // Restore dummy scale for next loop
        dummy.scale.set(newScale, newScale, newScale);
      }
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (auraRef.current) {
      auraRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      <instancedMesh
        ref={meshRef}
        args={[geometry, material, CONFIG.swordCount]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={auraRef}
        args={[auraGeometry, auraMaterial, CONFIG.swordCount]}
        frustumCulled={false}
      />
    </group>
  );
}
