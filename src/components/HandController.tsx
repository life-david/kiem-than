import { useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useHandStore } from '../store';
import type { GestureMode } from '../store';
import {
  globalVideo,
  globalLandmarker,
  detectGesture,
} from '../services/HandTrackingService';

// Record last frame time to prevent duplicate detection
let lastVideoTime = -1;

// Canvas internal component: only responsible for handling frame updates
export function HandController() {
  const { camera } = useThree();
  const setTarget = useHandStore((state) => state.setTarget);
  const setTracking = useHandStore((state) => state.setTracking);
  const setGestureMode = useHandStore((state) => state.setGestureMode);
  const updatePath = useHandStore((state) => state.updatePath);

  // Debounce state
  const pendingGesture = useRef<GestureMode | null>(null);
  const gestureStartTime = useRef<number>(0);
  const currentConfirmedGesture = useRef<GestureMode>('LOTUS'); // Default initial state

  useFrame(({ clock }) => {
    if (!globalLandmarker || !globalVideo || globalVideo.readyState !== 4)
      return;
    if (globalVideo.currentTime === lastVideoTime) return;

    lastVideoTime = globalVideo.currentTime;
    const results = globalLandmarker.detectForVideo(
      globalVideo,
      performance.now()
    );

    if (results.landmarks && results.landmarks.length > 0) {
      setTracking(true);
      const lm = results.landmarks[0];

      // 1. Detect instantaneous gesture
      const detectedGesture = detectGesture(lm);

      // 2. Debounce logic
      const now = clock.getElapsedTime();

      if (detectedGesture !== pendingGesture.current) {
        // If detected gesture changes, reset timer
        pendingGesture.current = detectedGesture;
        gestureStartTime.current = now;
      } else {
        // If gesture remains consistent
        const duration = now - gestureStartTime.current;
        const DELAY_THRESHOLD = 0.25; // 0.25s delay

        // Switch only if duration exceeds threshold and differs from current confirmed gesture
        if (
          duration > DELAY_THRESHOLD &&
          detectedGesture !== currentConfirmedGesture.current
        ) {
          currentConfirmedGesture.current = detectedGesture;
          setGestureMode(detectedGesture);
        }
      }

      // Always use "currently confirmed gesture" to decide logic
      const activeGesture = currentConfirmedGesture.current;

      // Calculate palm center (for Shield/Lotus mode) or index finger position (for Dragon mode)
      let targetPoint: { x: number; y: number };

      if (activeGesture === 'SHIELD' || activeGesture === 'LOTUS') {
        // Palm center: use midpoint of wrist and middle finger base
        const wrist = lm[0];
        const middleBase = lm[9];
        targetPoint = {
          x: (wrist.x + middleBase.x) / 2,
          y: (wrist.y + middleBase.y) / 2,
        };
      } else {
        // Index finger tip
        targetPoint = lm[8];
      }

      const ndcX = (1 - targetPoint.x) * 2 - 1;
      const ndcY = -(targetPoint.y * 2 - 1);

      const vec = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(camera);
      const dir = vec.sub(camera.position).normalize();
      const dist = -camera.position.z / dir.z;
      const worldPos = camera.position.clone().add(dir.multiplyScalar(dist));

      setTarget(worldPos);

      // Update path only in Dragon mode
      if (activeGesture === 'DRAGON') {
        updatePath(worldPos);
      }
    } else {
      setTracking(false);
      // Do not reset gesture when tracking lost, keep last state to prevent flickering
      // Optionally reset after tracking lost for a while, keeping it simple here
    }
  });

  return null;
}
