import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useHandStore } from '../store';

// Simple aperture material Shader
const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = `
varying vec2 vUv;
uniform float uTime;
uniform float uOpacity;

void main() {
  vec2 center = vec2(0.5, 0.5);
  float dist = distance(vUv, center);
  
  // Ring texture generation
  float ring1 = smoothstep(0.48, 0.485, dist) - smoothstep(0.49, 0.495, dist);
  float ring2 = smoothstep(0.42, 0.425, dist) - smoothstep(0.43, 0.435, dist);
  
  // Rotating rune decoration (Simulated)
  float angle = atan(vUv.y - 0.5, vUv.x - 0.5);
  float runes = sin(angle * 10.0 + uTime) * 0.5 + 0.5;
  float runeRing = smoothstep(0.35, 0.45, dist) * runes * (smoothstep(0.45, 0.35, dist));

  vec3 color = vec3(1.0, 0.9, 0.4); // Golden
  float alpha = (ring1 + ring2 + runeRing * 0.3) * uOpacity;
  
  gl_FragColor = vec4(color, alpha);
}
`;

export function MagicCircle() {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const gestureMode = useHandStore((state) => state.gestureMode);
  const isTracking = useHandStore((state) => state.isTracking);

  // Target opacity
  const opacityRef = useRef(0);

  useFrame(({ clock }) => {
    if (!meshRef.current || !materialRef.current) return;

    const time = clock.getElapsedTime();
    const targetOpacity = gestureMode === 'DAGENG' && isTracking ? 1 : 0;

    // Smooth fade in/out
    opacityRef.current = THREE.MathUtils.lerp(
      opacityRef.current,
      targetOpacity,
      0.05
    );

    materialRef.current.uniforms.uTime.value = time;
    materialRef.current.uniforms.uOpacity.value = opacityRef.current;

    // Rotation animation
    meshRef.current.rotation.z = time * 0.1;

    // Slight optimization if completely invisible
    meshRef.current.visible = opacityRef.current > 0.01;

    if (meshRef.current.visible) {
      // Fixed at a higher position above
      const targetPos = useHandStore.getState().targetPosition;
      meshRef.current.position.set(targetPos.x, targetPos.y + 15, targetPos.z);
    }
  });

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uOpacity: { value: 0 },
    }),
    []
  );

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} scale={[40, 40, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent={true}
        side={THREE.DoubleSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
      />
    </mesh>
  );
}
