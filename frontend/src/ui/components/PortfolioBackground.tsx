import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import './PortfolioBackground.css';

function PortfolioBackground() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );
    camera.position.z = 50;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    // container.appendChild(renderer.domElement)

    // Create particle system with more particles
    const particleCount = 3000;
    const particles = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    const color1 = new THREE.Color('#c084fc');
    const color2 = new THREE.Color('#4cc9f0');
    const color3 = new THREE.Color('#f472b6');

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      const radius = 50 + Math.random() * 30;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = radius * Math.cos(phi);

      const colorChoice = Math.random();
      let color;
      if (colorChoice < 0.33) {
        color = color1;
      } else if (colorChoice < 0.66) {
        color = color2;
      } else {
        color = color3;
      }

      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;

      sizes[i] = Math.random() * 2 + 0.5;
    }

    particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    particles.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const particleMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
      },
      vertexShader: `
        attribute float size;
        attribute vec3 color;
        varying vec3 vColor;
        varying float vSize;
        uniform float time;
        
        void main() {
          vColor = color;
          vSize = size;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          
          // Add pulsing effect
          float pulse = sin(time * 2.0 + position.y * 0.1) * 0.5 + 0.5;
          mvPosition.xyz += normalize(mvPosition.xyz) * pulse * 0.5;
          
          gl_PointSize = size * (300.0 / -mvPosition.z) * (1.0 + pulse * 0.3);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vSize;
        
        void main() {
          float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
          float alpha = 1.0 - smoothstep(0.0, 0.5, distanceToCenter);
          float glow = 1.0 - smoothstep(0.3, 0.5, distanceToCenter);
          vec3 finalColor = vColor + glow * 0.5;
          gl_FragColor = vec4(finalColor, alpha * 0.9);
        }
      `,
      transparent: true,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
    });

    const particleSystem = new THREE.Points(particles, particleMaterial);
    scene.add(particleSystem);

    // Create multiple wireframe spheres with different sizes
    const spheres: any[] = [];
    const sphereConfigs = [
      { radius: 30, color: '#c084fc', opacity: 0.25, segments: 2 },
      { radius: 20, color: '#4cc9f0', opacity: 0.2, segments: 1 },
      { radius: 15, color: '#f472b6', opacity: 0.15, segments: 1 },
    ];

    sphereConfigs.forEach((config) => {
      const sphereGeometry = new THREE.IcosahedronGeometry(config.radius, config.segments);
      const sphereMaterial = new THREE.MeshBasicMaterial({
        color: config.color,
        wireframe: true,
        transparent: true,
        opacity: config.opacity,
      });
      const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
      sphere.userData = {
        rotationSpeedX: (Math.random() - 0.5) * 0.02,
        rotationSpeedY: (Math.random() - 0.5) * 0.03,
        rotationSpeedZ: (Math.random() - 0.5) * 0.01,
      };
      scene.add(sphere);
      spheres.push(sphere);
    });

    // Create floating geometric shapes
    const shapes: any[] = [];
    const shapeCount = 12;

    for (let i = 0; i < shapeCount; i++) {
      const geometry = new THREE.TetrahedronGeometry(2, 0);
      const material = new THREE.MeshPhongMaterial({
        color: i % 3 === 0 ? '#c084fc' : i % 3 === 1 ? '#4cc9f0' : '#f472b6',
        transparent: true,
        opacity: 0.4,
        emissive: i % 3 === 0 ? '#c084fc' : i % 3 === 1 ? '#4cc9f0' : '#f472b6',
        emissiveIntensity: 0.3,
      });
      const shape = new THREE.Mesh(geometry, material);

      const angle = (i / shapeCount) * Math.PI * 2;
      const radius = 35 + Math.random() * 15;
      shape.position.set(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        (Math.random() - 0.5) * 40,
      );

      shape.userData = {
        baseAngle: angle,
        radius: radius,
        speed: 0.01 + Math.random() * 0.02,
        rotationSpeed: {
          x: (Math.random() - 0.5) * 0.05,
          y: (Math.random() - 0.5) * 0.05,
          z: (Math.random() - 0.5) * 0.05,
        },
      };

      scene.add(shape);
      shapes.push(shape);
    }

    // Create connecting lines between nearby particles
    const lineGeometry = new THREE.BufferGeometry();
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.15,
    });

    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    // Add multiple point lights with colors
    const lights: any[] = [];
    type LightConfig = {
      color: string;
      position: [number, number, number];
      intensity: number;
    };
    const lightConfigs: LightConfig[] = [
      { color: '#c084fc', position: [50, 50, 50], intensity: 1.5 },
      { color: '#4cc9f0', position: [-50, -50, 50], intensity: 1.5 },
      { color: '#f472b6', position: [0, 0, 100], intensity: 1.2 },
      { color: '#c084fc', position: [-50, 50, -50], intensity: 1.0 },
    ];

    lightConfigs.forEach((config) => {
      const light = new THREE.PointLight(config.color, config.intensity, 200);
      light.position.set(...config.position);
      // Store base intensity for pulsing logic later
      light.userData = { ...(light.userData || {}), baseIntensity: config.intensity };
      scene.add(light);
      lights.push(light);
    });

    const clock = new THREE.Clock();
    let mouseX = 0;
    let mouseY = 0;

    const handleMouseMove = (event: any) => {
      mouseX = (event.clientX / window.innerWidth) * 2 - 1;
      mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
    };

    window.addEventListener('mousemove', handleMouseMove);

    const animate = () => {
      const elapsed = clock.getElapsedTime();

      // Update particles
      particleMaterial.uniforms.time.value = elapsed;

      // Rotate particle system
      particleSystem.rotation.x = elapsed * 0.05;
      particleSystem.rotation.y = elapsed * 0.08;

      // Animate spheres
      spheres.forEach((sphere, index) => {
        sphere.rotation.x += sphere.userData.rotationSpeedX;
        sphere.rotation.y += sphere.userData.rotationSpeedY;
        sphere.rotation.z += sphere.userData.rotationSpeedZ;

        // Add slight pulsing
        const scale = 1 + Math.sin(elapsed * 2 + index) * 0.1;
        sphere.scale.setScalar(scale);
      });

      // Animate floating shapes
      shapes.forEach((shape, index) => {
        const angle = shape.userData.baseAngle + elapsed * shape.userData.speed;
        shape.position.x = Math.cos(angle) * shape.userData.radius;
        shape.position.y = Math.sin(angle) * shape.userData.radius;
        shape.position.z += Math.sin(elapsed * 0.5 + index) * 0.1;

        shape.rotation.x += shape.userData.rotationSpeed.x;
        shape.rotation.y += shape.userData.rotationSpeed.y;
        shape.rotation.z += shape.userData.rotationSpeed.z;

        // Pulsing effect
        const pulse = Math.sin(elapsed * 3 + index) * 0.3 + 0.7;
        shape.scale.setScalar(pulse);
      });

      // Animate lights
      lights.forEach((light, index) => {
        const time = elapsed * (0.5 + index * 0.2);
        light.position.x = Math.sin(time) * 60;
        light.position.y = Math.cos(time) * 60;
        light.position.z = 50 + Math.sin(time * 0.7) * 30;

        // Light intensity pulsing
        light.intensity = light.userData?.baseIntensity || 1.5;
        light.intensity += Math.sin(elapsed * 2 + index) * 0.3;
      });

      // Camera movement based on mouse
      camera.position.x += (mouseX * 8 - camera.position.x) * 0.03;
      camera.position.y += (mouseY * 8 - camera.position.y) * 0.03;
      camera.position.z = 50 + Math.sin(elapsed * 0.3) * 5;
      camera.lookAt(scene.position);

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
      window.removeEventListener('mousemove', handleMouseMove);
      renderer.dispose();
      particleMaterial.dispose();
      particles.dispose();
      lineMaterial.dispose();
      lineGeometry.dispose();
      spheres.forEach((sphere) => {
        sphere.geometry.dispose();
        sphere.material.dispose();
      });
      shapes.forEach((shape) => {
        shape.geometry.dispose();
        shape.material.dispose();
      });
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div className="portfolio-background" aria-hidden="true" ref={containerRef} />;
}

export default PortfolioBackground;
