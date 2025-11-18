import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import './ThreeBackground.css';

function createWavePlane(colorA: string, colorB: string, rotationY = 0) {
  const geometry = new THREE.PlaneGeometry(60, 60, 220, 220);
  const uniforms = {
    uTime: { value: 0 },
    uColor1: { value: new THREE.Color(colorA) },
    uColor2: { value: new THREE.Color(colorB) },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 pos = position;
        float wave1 = sin(pos.x * 0.5 + uTime * 0.6);
        float wave2 = cos(pos.y * 0.7 + uTime * 0.8);
        float wave3 = sin((pos.x + pos.y) * 0.3 + uTime * 0.4);
        pos.z += (wave1 + wave2 + wave3) * 1.2;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      varying vec2 vUv;
      void main() {
        float gradient = smoothstep(0.0, 1.0, vUv.y);
        vec3 base = mix(uColor1, uColor2, gradient);
        float glow = pow(1.0 - abs(vUv.x - 0.5) * 2.0, 2.0);
        vec3 color = base + glow * 0.25;
        gl_FragColor = vec4(color, 0.5);
      }
    `,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2.4;
  mesh.rotation.y = rotationY;
  mesh.position.y = -10;
  mesh.userData.uniforms = uniforms;

  return mesh;
}

function ThreeBackground() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );
    camera.position.set(0, 10, 35);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const waveOne = createWavePlane('#4cc9f0', '#c084fc');
    const waveTwo = createWavePlane('#f472b6', '#facc15', Math.PI / 6);
    waveTwo.position.y = -12;
    scene.add(waveOne);
    scene.add(waveTwo);

    const starsGeometry = new THREE.BufferGeometry();
    const starCount = 600;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPositions[i] = (Math.random() - 0.5) * 120;
      starPositions[i + 1] = Math.random() * 80;
      starPositions[i + 2] = (Math.random() - 0.5) * 120;
    }
    starsGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starsMaterial = new THREE.PointsMaterial({
      color: '#ffffff',
      size: 0.5,
      transparent: true,
      opacity: 0.35,
    });
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);

    const clock = new THREE.Clock();

    const animate = () => {
      const elapsed = clock.getElapsedTime();
      waveOne.userData.uniforms.uTime.value = elapsed;
      waveTwo.userData.uniforms.uTime.value = elapsed * 0.9;
      stars.rotation.y += 0.0005;

      renderer.render(scene, camera);
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      waveOne.geometry.dispose();
      waveTwo.geometry.dispose();
      waveOne.material.dispose();
      waveTwo.material.dispose();
      starsGeometry.dispose();
      starsMaterial.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div className="three-background" aria-hidden="true" ref={containerRef} />;
}

export default ThreeBackground;
