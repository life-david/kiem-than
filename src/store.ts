import { create } from 'zustand';
import * as THREE from 'three';

// =========== Configuration Parameters ===========
// Simple mobile detection
const isMobile =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  ) || window.innerWidth < 768;

export const CONFIG = {
  swordCount: isMobile ? 300 : 500,
  pathHistoryLength: 300,
  maxSpeed: 25,
  sprintSpeed: 50,
  steerForce: 28,
  separationDist: 3,
  separationForce: 10,
  noiseScale: 0.3, // Noise scale
  noiseStrength: 1, // Noise strength
  formationRadius: 1.5, // Sword array radius
  dragonDensity: 0.8, // Tornado mode density
  // Shield mode parameters
  shieldRadius: 18, // Shield sphere radius
  shieldOrbitSpeed: 2.5, // Orbit rotation speed
  // Lotus mode parameters
  lotusRadius: 24, // Lotus radius
  lotusRotateSpeed: 2.5, // Lotus rotation speed
  // Grand Geng sword array parameters
  dagengRadius: 30, // Sword array radius
  dagengHeight: 20, // Sword array height range
  dagengRotateSpeed: 0.2, // Overall rotation speed
};

// Gesture mode
export type GestureMode = 'DRAGON' | 'SHIELD' | 'LOTUS' | 'DAGENG';

interface HandState {
  targetPosition: THREE.Vector3;
  isTracking: boolean;
  gestureMode: GestureMode; // Current gesture mode
  pathHistory: THREE.Vector3[];
  lastDirection: THREE.Vector3;

  setTarget: (pos: THREE.Vector3) => void;
  setTracking: (tracking: boolean) => void;
  setGestureMode: (mode: GestureMode) => void;
  updatePath: (pos: THREE.Vector3) => void;
  extendPath: () => void;
}

export const useHandStore = create<HandState>((set, get) => ({
  targetPosition: new THREE.Vector3(0, 0, 0),
  isTracking: false,
  gestureMode: 'LOTUS',
  pathHistory: Array.from(
    { length: CONFIG.pathHistoryLength },
    () => new THREE.Vector3(0, 0, 0)
  ),
  lastDirection: new THREE.Vector3(0, 0, 0),

  setTarget: (pos) => set({ targetPosition: pos }),

  setTracking: (tracking) => set({ isTracking: tracking }),

  setGestureMode: (mode) => set({ gestureMode: mode }),

  updatePath: (pos) => {
    const { pathHistory, lastDirection } = get();
    const last = pathHistory[0];
    const diff = pos.clone().sub(last);
    const dist = diff.length();

    if (dist > 0.1) {
      lastDirection.copy(diff.normalize());
      pathHistory.pop();
      pathHistory.unshift(pos.clone());
    }
  },

  extendPath: () => {
    const { pathHistory, lastDirection } = get();
    if (lastDirection.length() < 0.01) return;

    const last = pathHistory[0];
    const newPoint = last
      .clone()
      .add(lastDirection.clone().multiplyScalar(0.3));
    pathHistory.pop();
    pathHistory.unshift(newPoint);
  },
}));
