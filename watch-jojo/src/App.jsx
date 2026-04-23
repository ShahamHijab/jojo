import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import "./App.css";

// ─── Data ─────────────────────────────────────────────────────────────────────
const PARTS = [
  { num: "I",    name: "Phantom Blood",       color: "#ff6b35", accent: "#ff3300", desc: "Jonathan Joestar. A true gentleman.", stand: "Ripple" },
  { num: "II",   name: "Battle Tendency",     color: "#ffd700", accent: "#ff8800", desc: "Joseph Joestar. Your next line is...", stand: "Ripple & Hamon" },
  { num: "III",  name: "Stardust Crusaders",  color: "#00cfff", accent: "#0044ff", desc: "Jotaro Kujo. Yare yare daze.", stand: "Star Platinum" },
  { num: "IV",   name: "Diamond is Unbreak.", color: "#ff69b4", accent: "#cc00aa", desc: "Josuke Higashikata. Great hair.", stand: "Crazy Diamond" },
  { num: "V",    name: "Golden Wind",         color: "#c0a060", accent: "#ffcc44", desc: "Giorno Giovanna. I have a dream.", stand: "Gold Experience" },
  { num: "VI",   name: "Stone Ocean",         color: "#7fff00", accent: "#00ffaa", desc: "Jolyne Cujoh. Stone Free.", stand: "Stone Free" },
  { num: "VII",  name: "Steel Ball Run",      color: "#dda0dd", accent: "#aa44ff", desc: "Johnny Joestar. Tusk Act 4.", stand: "Tusk" },
  { num: "VIII", name: "JoJolion",            color: "#20b2aa", accent: "#00ffdd", desc: "Josuke Higashikata. Soft & Wet.", stand: "Soft & Wet" },
];

const ORA_WORDS = [
  "ORA ORA ORA!", "MUDA MUDA!", "WRYYY!", "STAR PLATINUM!", 
  "YARE YARE...", "KONO DIO DA!", "NIGERUNDAYO!", "ZA WARUDO!",
  "EMERALD SPLASH!", "ARRIVEDERCI!", "GOLDEN EXPERIENCE!", "TUSK ACT 4!"
];

// ─── Vertex shader ─────────────────────────────────────────────────────────────
const vertexShader = `
  uniform float uTime;
  uniform float uMouse;
  varying vec2 vUv;
  varying vec3 vPos;
  void main() {
    vUv = uv;
    vPos = position;
    vec3 pos = position;
    pos.x += sin(pos.y * 3.0 + uTime) * 0.05;
    pos.y += cos(pos.x * 3.0 + uTime) * 0.05;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform vec3 uColor;
  varying vec2 vUv;
  varying vec3 vPos;
  void main() {
    float d = length(vUv - 0.5);
    float ring = sin(d * 20.0 - uTime * 3.0) * 0.5 + 0.5;
    vec3 col = mix(uColor, vec3(1.0, 0.84, 0.0), ring * 0.5);
    float alpha = 1.0 - smoothstep(0.3, 0.5, d);
    gl_FragColor = vec4(col, alpha * 0.8);
  }
`;

// ─── Scene init ───────────────────────────────────────────────────────────────
function initScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x050008, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 6;

  scene.fog = new THREE.FogExp2(0x050008, 0.035);

  // ── Stars (two layers for parallax)
  const makeStars = (count, size, spread) => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i*3]   = (Math.random()-0.5)*spread;
      pos[i*3+1] = (Math.random()-0.5)*spread;
      pos[i*3+2] = (Math.random()-0.5)*spread - 5;
      const c = new THREE.Color().setHSL(Math.random()*0.2+0.05, 0.8, 0.7+Math.random()*0.3);
      colors[i*3]=c.r; colors[i*3+1]=c.g; colors[i*3+2]=c.b;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({ size, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.9 });
    return new THREE.Points(geo, mat);
  };
  const stars1 = makeStars(4000, 0.1, 300);
  const stars2 = makeStars(1000, 0.22, 100);
  scene.add(stars1, stars2);

  // ── Central torus knot (main hero)
  const torusGeo = new THREE.TorusKnotGeometry(1.5, 0.35, 256, 24, 2, 3);
  const torusMat = new THREE.MeshPhysicalMaterial({
    color: 0xffd700,
    metalness: 1,
    roughness: 0.05,
    emissive: 0xff1493,
    emissiveIntensity: 0.2,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
  });
  const torus = new THREE.Mesh(torusGeo, torusMat);
  torus.castShadow = true;
  scene.add(torus);

  // ── Wireframe shell
  const wireGeo = new THREE.TorusKnotGeometry(1.72, 0.06, 160, 16, 2, 3);
  const wireMat = new THREE.MeshBasicMaterial({ color: 0x7b00ff, wireframe: true, transparent: true, opacity: 0.35 });
  const wireShell = new THREE.Mesh(wireGeo, wireMat);
  scene.add(wireShell);

  // ── Second torus knot (counter-rotating, smaller)
  const torus2Geo = new THREE.TorusKnotGeometry(1.0, 0.15, 180, 16, 3, 5);
  const torus2Mat = new THREE.MeshPhysicalMaterial({
    color: 0x00ffff,
    metalness: 0.9,
    roughness: 0.1,
    emissive: 0x00cfff,
    emissiveIntensity: 0.4,
    transparent: true,
    opacity: 0.7,
  });
  const torus2 = new THREE.Mesh(torus2Geo, torus2Mat);
  scene.add(torus2);

  // ── Particle orbit rings (3 tilted rings)
  const orbits = [];
  const orbitColors = [0x00ffff, 0xff1493, 0xffd700];
  for (let r = 0; r < 3; r++) {
    const geo = new THREE.BufferGeometry();
    const count = 600;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const radius = 2.8 + (Math.random()-0.5)*0.4;
      pos[i*3]   = Math.cos(angle)*radius;
      pos[i*3+1] = Math.sin(angle)*radius;
      pos[i*3+2] = (Math.random()-0.5)*0.3;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: orbitColors[r], size: 0.05, transparent: true, opacity: 0.7 });
    const ring = new THREE.Points(geo, mat);
    ring.rotation.x = (r * Math.PI) / 3 + 0.4;
    ring.rotation.z = r * 0.8;
    orbits.push(ring);
    scene.add(ring);
  }

  // ── Floating diamonds (octahedrons)
  const diamonds = [];
  const dGeo = new THREE.OctahedronGeometry(0.3, 0);
  const partColors = PARTS.map(p => p.color);
  for (let i = 0; i < 24; i++) {
    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(partColors[i % partColors.length]),
      metalness: 0.95,
      roughness: 0.05,
      emissive: new THREE.Color(partColors[i % partColors.length]),
      emissiveIntensity: 0.4,
      clearcoat: 1,
    });
    const mesh = new THREE.Mesh(dGeo, mat);
    const theta = (i / 24) * Math.PI * 2;
    const radiusBase = 4 + Math.random() * 4;
    mesh.position.set(
      Math.cos(theta) * radiusBase,
      (Math.random()-0.5) * 8,
      (Math.random()-0.5) * 6 - 2
    );
    mesh.userData = {
      orbitRadius: radiusBase,
      orbitSpeed: 0.002 + Math.random() * 0.005,
      orbitTheta: theta,
      floatOffset: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random()-0.5)*0.06,
      baseY: mesh.position.y,
    };
    scene.add(mesh);
    diamonds.push(mesh);
  }

  // ── Shockwave plane (custom shader)
  const shockGeo = new THREE.PlaneGeometry(8, 8, 64, 64);
  const shockMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0xffd700) },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const shockPlane = new THREE.Mesh(shockGeo, shockMat);
  shockPlane.position.z = -1.5;
  shockPlane.visible = false;
  scene.add(shockPlane);

  // ── Energy burst sphere (click feedback)
  const burstGeo = new THREE.SphereGeometry(1, 32, 32);
  const burstMat = new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0, wireframe: true });
  const burstSphere = new THREE.Mesh(burstGeo, burstMat);
  scene.add(burstSphere);

  // ── Lights
  scene.add(new THREE.AmbientLight(0x110008, 2));

  const goldLight = new THREE.PointLight(0xffd700, 6, 18);
  goldLight.position.set(0, 0, 4);
  goldLight.castShadow = true;
  scene.add(goldLight);

  const pinkLight = new THREE.PointLight(0xff1493, 5, 22);
  pinkLight.position.set(-5, 3, -2);
  scene.add(pinkLight);

  const purpleLight = new THREE.PointLight(0x7b00ff, 4, 22);
  purpleLight.position.set(5, -3, -2);
  scene.add(purpleLight);

  const cyanLight = new THREE.PointLight(0x00ffff, 3, 18);
  cyanLight.position.set(0, 5, 2);
  scene.add(cyanLight);

  return { renderer, scene, camera, torus, torus2, wireShell, diamonds, orbits, stars1, stars2, goldLight, pinkLight, purpleLight, cyanLight, shockMat, shockPlane, burstSphere, burstMat };
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const canvasRef   = useRef(null);
  const audioRef    = useRef(null);
  const sceneRef    = useRef(null);
  const mouseRef    = useRef({ x: 0, y: 0 });
  const gyroRef     = useRef({ x: 0, y: 0 });
  const scrollRef   = useRef(0);
  const frameRef    = useRef(null);
  const burstIdRef  = useRef(0);
  const clickCountRef = useRef(0);
  const shockTimeRef  = useRef(-999);

  const [started, setStarted]     = useState(false);
  const [playing, setPlaying]     = useState(false);
  const [bursts, setBursts]       = useState([]);
  const [toast, setToast]         = useState(null);
  const [hasGyro, setHasGyro]     = useState(false);
  const [activePart, setActivePart] = useState(null);
  const [scrollY, setScrollY]     = useState(0);
  const [clickCombo, setClickCombo] = useState(0);
  const [zaWarudo, setZaWarudo]   = useState(false);
  const [cursorTrail, setCursorTrail] = useState([]);
  const trailIdRef = useRef(0);
  const comboTimeoutRef = useRef(null);

  // ── Start
  const handleStart = useCallback(async () => {
    setStarted(true);
    if (audioRef.current) {
      try {
        await audioRef.current.play();
        setPlaying(true);
      } catch (err) {
        console.error('Audio play failed on start:', err);
        setToast('Audio blocked — tap the music button to enable.');
      }
    }
    if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
      try { const p = await DeviceOrientationEvent.requestPermission(); if (p==="granted") setHasGyro(true); } catch(_) {}
    } else if (window.DeviceOrientationEvent) setHasGyro(true);
  }, []);

  // ── Three.js
  useEffect(() => {
    if (!started || !canvasRef.current) return;
    const sc = initScene(canvasRef.current);
    sceneRef.current = sc;
    const { renderer, scene, camera, torus, torus2, wireShell, diamonds, orbits, stars1, stars2, goldLight, pinkLight, purpleLight, cyanLight, shockMat, shockPlane, burstSphere, burstMat } = sc;

    let t = 0;
    let beatPhase = 0;
    let burstT = 0;
    let isBursting = false;

    function animate() {
      frameRef.current = requestAnimationFrame(animate);
      t += 0.008;
      beatPhase += 0.045;

      // Scroll-driven Z pull
      const scroll = scrollRef.current;
      camera.position.z = 6 + scroll * 0.004;

      // Camera parallax
      const mx = mouseRef.current.x + gyroRef.current.x;
      const my = mouseRef.current.y + gyroRef.current.y;
      camera.position.x += (mx * 2.0 - camera.position.x) * 0.04;
      camera.position.y += (-my * 1.5 - camera.position.y) * 0.04;
      camera.lookAt(scene.position);

      // Stars parallax (different speeds)
      stars1.rotation.y = t * 0.015 + mx * 0.01;
      stars2.rotation.y = t * 0.025 + mx * 0.02;
      stars1.rotation.x = my * 0.005;

      // Main torus
      torus.rotation.x += 0.004 + Math.abs(mx) * 0.003;
      torus.rotation.y += 0.008 + Math.abs(my) * 0.003;
      const beat = 1 + Math.sin(beatPhase) * 0.07;
      torus.scale.setScalar(beat);
      torus.material.emissiveIntensity = 0.15 + Math.sin(beatPhase * 1.5) * 0.12;

      // Torus 2 counter
      torus2.rotation.x -= 0.006;
      torus2.rotation.y -= 0.004;
      torus2.rotation.z += 0.008;
      torus2.scale.setScalar(beat * 0.98);

      // Wireframe shell
      wireShell.rotation.x -= 0.002;
      wireShell.rotation.y -= 0.005;
      wireShell.scale.setScalar(beat * 1.03);

      // Orbit rings
      orbits.forEach((r, i) => {
        r.rotation.z += 0.004 + i * 0.002;
        r.rotation.x += 0.001 * (i % 2 === 0 ? 1 : -1);
      });

      // Diamonds orbit
      diamonds.forEach(d => {
        d.userData.orbitTheta += d.userData.orbitSpeed;
        const r = d.userData.orbitRadius;
        d.position.x = Math.cos(d.userData.orbitTheta) * r;
        d.position.y = d.userData.baseY + Math.sin(t + d.userData.floatOffset) * 0.5;
        d.position.z = Math.sin(d.userData.orbitTheta) * (r * 0.3) - 2;
        d.rotation.x += d.userData.rotSpeed;
        d.rotation.y += d.userData.rotSpeed * 0.7;
      });

      // Lights animate
      goldLight.intensity  = 5 + Math.sin(t * 2.3) * 2;
      pinkLight.intensity  = 4 + Math.cos(t * 1.8) * 2;
      pinkLight.position.x = Math.cos(t * 0.5) * 6;
      pinkLight.position.y = Math.sin(t * 0.5) * 4;
      purpleLight.position.x = Math.sin(t * 0.4) * 6;
      purpleLight.position.y = Math.cos(t * 0.6) * 5;
      cyanLight.position.x = Math.sin(t * 0.7) * 3;
      cyanLight.position.z = Math.cos(t * 0.3) * 3;

      // Shockwave pulse shader
      if (Date.now() - shockTimeRef.current < 1500) {
        const elapsed = (Date.now() - shockTimeRef.current) / 1500;
        shockMat.uniforms.uTime.value = elapsed * 8;
        shockPlane.visible = true;
        shockPlane.material.opacity = (1 - elapsed) * 0.6;
        shockPlane.scale.setScalar(1 + elapsed * 3);
      } else {
        shockPlane.visible = false;
      }

      // Energy burst sphere
      if (isBursting) {
        burstT += 0.06;
        burstSphere.scale.setScalar(1 + burstT * 4);
        burstMat.opacity = Math.max(0, 0.6 - burstT * 0.6);
        if (burstT > 1) { isBursting = false; burstT = 0; burstMat.opacity = 0; burstSphere.scale.setScalar(1); }
      }

      renderer.render(scene, camera);
    }

    // Expose trigger for burst
    sc.triggerBurst = () => {
      isBursting = true; burstT = 0;
      shockTimeRef.current = Date.now();
    };

    animate();

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(frameRef.current); window.removeEventListener("resize", onResize); renderer.dispose(); };
  }, [started]);

  // ── Mouse
  useEffect(() => {
    const onMove = (e) => {
      mouseRef.current.x = (e.clientX / window.innerWidth)  * 2 - 1;
      mouseRef.current.y = (e.clientY / window.innerHeight) * 2 - 1;
      // Cursor trail
      const id = ++trailIdRef.current;
      const x = e.clientX, y = e.clientY;
      setCursorTrail(prev => [...prev.slice(-18), { id, x, y }]);
      setTimeout(() => setCursorTrail(prev => prev.filter(t => t.id !== id)), 500);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  // ── Touch
  useEffect(() => {
    const onTouch = (e) => {
      if (!e.touches[0]) return;
      mouseRef.current.x = (e.touches[0].clientX / window.innerWidth)  * 2 - 1;
      mouseRef.current.y = (e.touches[0].clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("touchmove", onTouch, { passive: true });
    return () => window.removeEventListener("touchmove", onTouch);
  }, []);

  // ── Gyro
  useEffect(() => {
    if (!hasGyro) return;
    const onOrient = (e) => {
      gyroRef.current.x =  (e.gamma||0)/45;
      gyroRef.current.y = -(e.beta||0)/45;
    };
    window.addEventListener("deviceorientation", onOrient);
    return () => window.removeEventListener("deviceorientation", onOrient);
  }, [hasGyro]);

  // ── Scroll
  useEffect(() => {
    const el = document.getElementById("scroll-container");
    if (!el) return;
    const onScroll = () => { scrollRef.current = el.scrollTop; setScrollY(el.scrollTop); };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [started]);

  // ── Click burst
  const spawnBurst = useCallback((x, y) => {
    const word = ORA_WORDS[Math.floor(Math.random() * ORA_WORDS.length)];
    const id = ++burstIdRef.current;
    setBursts(prev => [...prev, { id, x, y, word }]);
    setTimeout(() => setBursts(prev => prev.filter(b => b.id !== id)), 800);
  }, []);

  const handleClick = useCallback((e) => {
    if (!started) return;
    const x = e.clientX ?? window.innerWidth/2;
    const y = e.clientY ?? window.innerHeight/2;
    spawnBurst(x, y);

    clickCountRef.current++;
    const combo = clickCountRef.current;
    setClickCombo(combo);
    clearTimeout(comboTimeoutRef.current);
    comboTimeoutRef.current = setTimeout(() => { clickCountRef.current = 0; setClickCombo(0); }, 1200);

    if (sceneRef.current) {
      sceneRef.current.torus.material.emissiveIntensity = 1.0;
      sceneRef.current.triggerBurst?.();
    }

    // ZA WARUDO at 7 clicks
    if (combo >= 7) {
      setZaWarudo(true);
      setTimeout(() => setZaWarudo(false), 2000);
      clickCountRef.current = 0; setClickCombo(0);
    }
  }, [started, spawnBurst]);

  const handlePartClick = useCallback((part, e) => {
    e.stopPropagation();
    setActivePart(part);
    setToast(`⟡ Part ${part.num}: ${part.name} ⟡`);
    if (sceneRef.current) {
      const c = new THREE.Color(part.color);
      sceneRef.current.torus.material.color.set(c);
      sceneRef.current.torus.material.emissive.set(c);
      sceneRef.current.torus2.material.color.set(part.accent);
      sceneRef.current.torus2.material.emissive.set(part.accent);
      sceneRef.current.goldLight.color.set(c);
    }
    setTimeout(() => setToast(null), 3000);
  }, []);

  const toggleMusic = useCallback(async (e) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    try {
      if (playing) {
        audioRef.current.pause();
        setPlaying(false);
      } else {
        await audioRef.current.play();
        setPlaying(true);
      }
    } catch (err) {
      console.error('toggleMusic play error:', err);
      setToast('Unable to play audio. Click to retry.');
    }
  }, [playing]);

  // Expose audio event handlers to surface errors and update UI
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onError = () => {
      console.error('Audio element error', a.error);
      setToast('Audio failed to load or play. Check the file or retry.');
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    a.addEventListener('error', onError);
    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    return () => {
      a.removeEventListener('error', onError);
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onPause);
    };
  }, []);

  return (
    <>
      <audio ref={audioRef} src="/jojo.mp3" loop preload="auto" />

      {/* Canvas always under */}
      <div className="canvas-container" onClick={handleClick}>
        <canvas ref={canvasRef} />
      </div>

      <div className="scanlines" />
      <div className="vignette" />

      {/* Cursor trail */}
      {cursorTrail.map((t, i) => (
        <div key={t.id} className="cursor-trail" style={{
          left: t.x, top: t.y,
          opacity: (i / cursorTrail.length) * 0.7,
          transform: `translate(-50%, -50%) scale(${(i / cursorTrail.length) * 1.2})`,
        }} />
      ))}

      {/* ── Start screen ── */}
      {!started && (
        <div className="start-screen" onClick={handleStart}>
          <div className="start-glitch" data-text="WATCH JOJO">WATCH JOJO</div>
          <div className="start-sub">The Greatest Anime Ever Made</div>
          <div className="start-bars">
            {PARTS.map((p, i) => (
              <div key={p.num} className="start-bar" style={{ backgroundColor: p.color, animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
          <div className="start-tap">[ tap anywhere to awaken your stand ]</div>
          <div className="start-scroll-hint">⟡ 8 parts await ⟡</div>
        </div>
      )}

      {/* ── Main content (scrollable) ── */}
      {started && (
        <div id="scroll-container" className="scroll-container">
          {/* Hero section */}
          <section className="hero-section">
            <div className="hero-content" style={{ opacity: Math.max(0, 1 - scrollY / 400) }}>
              <div className="main-title-glitch" data-text="WATCH JOJO">WATCH JOJO</div>
              <div className="subtitle">NOW</div>
              <div className="tagline">Your stand ability demands it</div>
              <div className="scroll-down-hint">
                <span>scroll to explore all parts</span>
                <div className="scroll-arrow">↓</div>
              </div>
            </div>
          </section>

          {/* Parts gallery */}
          <section className="parts-section">
            <div className="parts-header">
              <div className="parts-title">THE 8 PARTS</div>
              <div className="parts-line" />
            </div>
            <div className="parts-grid">
              {PARTS.map((p, i) => (
                <div
                  key={p.num}
                  className={`part-card-big ${activePart?.num === p.num ? "active" : ""}`}
                  style={{
                    "--part-color": p.color,
                    "--part-accent": p.accent,
                    animationDelay: `${i * 0.08}s`,
                  }}
                  onClick={(e) => handlePartClick(p, e)}
                >
                  <div className="card-glow" />
                  <div className="card-number">{p.num}</div>
                  <div className="card-content">
                    <div className="card-name">{p.name}</div>
                    <div className="card-stand">Stand: {p.stand}</div>
                    <div className="card-desc">{p.desc}</div>
                  </div>
                  <div className="card-corner tl" />
                  <div className="card-corner tr" />
                  <div className="card-corner bl" />
                  <div className="card-corner br" />
                  <div className="card-scanline" />
                </div>
              ))}
            </div>
          </section>

          {/* Interactive section */}
          <section className="interact-section">
            <div className="interact-title">STAND BATTLE</div>
            <div className="interact-sub">Click the canvas. ORA ORA ORA.</div>
            <div className="combo-display">
              {clickCombo > 1 && (
                <div className="combo-counter" style={{ fontSize: `${Math.min(2 + clickCombo * 0.3, 5)}rem` }}>
                  {clickCombo}x COMBO!
                </div>
              )}
            </div>
            <div className="interact-hint">
              <span className="hint-item">🖱 Click anywhere → ORA burst</span>
              <span className="hint-item">🎯 7x combo → ZA WARUDO</span>
              <span className="hint-item">📱 Tilt device → camera moves</span>
              <span className="hint-item">🃏 Click a part → recolor Stand</span>
            </div>
          </section>

          {/* Motto footer */}
          <section className="motto-section">
            <div className="motto-text">「Your next line is:</div>
            <div className="motto-quote">I'll watch JoJo right now」</div>
            <div className="motto-sub">— Everyone, eventually</div>
          </section>
        </div>
      )}

      {/* ZA WARUDO overlay */}
      {zaWarudo && (
        <div className="za-warudo-overlay">
          <div className="za-warudo-text">ZA WARUDO!</div>
          <div className="za-warudo-sub">TIME HAS STOPPED</div>
        </div>
      )}

      {/* Toast */}
      {toast && <div className="part-toast">{toast}</div>}

      {/* Active part info panel */}
      {activePart && (
        <div className="part-panel" style={{ "--panel-color": activePart.color }}>
          <button className="panel-close" onClick={(e) => { e.stopPropagation(); setActivePart(null); }}>✕</button>
          <div className="panel-num">{activePart.num}</div>
          <div className="panel-name">{activePart.name}</div>
          <div className="panel-stand">{activePart.stand}</div>
          <div className="panel-desc">{activePart.desc}</div>
        </div>
      )}

      {/* Bursts */}
      {bursts.map(b => (
        <div key={b.id} className="burst-text" style={{ left: b.x, top: b.y }}>
          {b.word}
        </div>
      ))}

      {/* Music button */}
      {started && (
        <button className="music-btn" onClick={toggleMusic} aria-label="Toggle music">
          <span>{playing ? "🎵" : "🔇"}</span>
        </button>
      )}

      {/* Gyro hint */}
      {started && hasGyro && <div className="gyro-hint">Tilt to move</div>}
    </>
  );
}