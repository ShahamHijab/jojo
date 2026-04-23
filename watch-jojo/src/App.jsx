import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import "./App.css";

// ─── JoJo parts data ─────────────────────────────────────────────────────────
const PARTS = [
  { num: "I",   name: "Phantom Blood",      color: "#ff6b35" },
  { num: "II",  name: "Battle Tendency",    color: "#ffd700" },
  { num: "III", name: "Stardust Crusaders", color: "#00cfff" },
  { num: "IV",  name: "Diamond is Unbreak.", color: "#ff69b4" },
  { num: "V",   name: "Golden Wind",        color: "#c0a060" },
  { num: "VI",  name: "Stone Ocean",        color: "#7fff00" },
  { num: "VII", name: "Steel Ball Run",     color: "#dda0dd" },
  { num: "VIII","name": "JoJolion",          color: "#20b2aa" },
];

const ORA_WORDS = ["ORA!", "MUDA!", "WRYYY!", "STAR PLATINUM!", "YARE YARE...", "ORA ORA ORA!", "KONO DIO DA!", "NIGERUNDAYO!"];

// ─── Three.js scene setup ─────────────────────────────────────────────────────
function initScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x0a0005, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 5;

  // ── Fog
  scene.fog = new THREE.FogExp2(0x0a0005, 0.04);

  // ── Stars
  const starGeo = new THREE.BufferGeometry();
  const starCount = 3000;
  const positions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount * 3; i++) {
    positions[i] = (Math.random() - 0.5) * 200;
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.12, sizeAttenuation: true });
  scene.add(new THREE.Points(starGeo, starMat));

  // ── Golden floating diamonds (Star Platinum stands as diamonds)
  const diamonds = [];
  const diamondGeo = new THREE.OctahedronGeometry(0.35, 0);
  for (let i = 0; i < 18; i++) {
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(Math.random() * 0.15 + 0.12, 1, 0.6),
      metalness: 0.9,
      roughness: 0.1,
      emissive: new THREE.Color(0xffd700),
      emissiveIntensity: 0.3,
    });
    const mesh = new THREE.Mesh(diamondGeo, mat);
    mesh.position.set(
      (Math.random() - 0.5) * 16,
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 8 - 2
    );
    mesh.userData = {
      speed: Math.random() * 0.012 + 0.004,
      rotSpeed: (Math.random() - 0.5) * 0.04,
      offset: Math.random() * Math.PI * 2,
      baseY: mesh.position.y,
    };
    scene.add(mesh);
    diamonds.push(mesh);
  }

  // ── Central golden torus knot (Stand energy)
  const torusGeo = new THREE.TorusKnotGeometry(1.4, 0.32, 180, 20, 2, 3);
  const torusMat = new THREE.MeshStandardMaterial({
    color: 0xffd700,
    metalness: 1,
    roughness: 0.05,
    emissive: 0xff1493,
    emissiveIntensity: 0.15,
    wireframe: false,
  });
  const torus = new THREE.Mesh(torusGeo, torusMat);
  scene.add(torus);

  // ── Outer wireframe ring
  const wireGeo = new THREE.TorusKnotGeometry(1.65, 0.04, 120, 12, 2, 3);
  const wireMat = new THREE.MeshBasicMaterial({ color: 0x7b00ff, wireframe: true, transparent: true, opacity: 0.5 });
  const wireRing = new THREE.Mesh(wireGeo, wireMat);
  scene.add(wireRing);

  // ── Particle ring
  const ringGeo = new THREE.BufferGeometry();
  const ringCount = 800;
  const ringPos = new Float32Array(ringCount * 3);
  for (let i = 0; i < ringCount; i++) {
    const angle = (i / ringCount) * Math.PI * 2;
    const radius = 2.6 + (Math.random() - 0.5) * 0.6;
    ringPos[i * 3]     = Math.cos(angle) * radius;
    ringPos[i * 3 + 1] = Math.sin(angle) * radius;
    ringPos[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
  }
  ringGeo.setAttribute("position", new THREE.BufferAttribute(ringPos, 3));
  const ringMat = new THREE.PointsMaterial({ color: 0x00ffff, size: 0.045, transparent: true, opacity: 0.8 });
  const particleRing = new THREE.Points(ringGeo, ringMat);
  scene.add(particleRing);

  // ── Lights
  const ambient = new THREE.AmbientLight(0x220011, 1.5);
  scene.add(ambient);

  const goldLight = new THREE.PointLight(0xffd700, 4, 15);
  goldLight.position.set(0, 0, 3);
  scene.add(goldLight);

  const pinkLight = new THREE.PointLight(0xff1493, 3, 20);
  pinkLight.position.set(-4, 3, -2);
  scene.add(pinkLight);

  const purpleLight = new THREE.PointLight(0x7b00ff, 3, 20);
  purpleLight.position.set(4, -3, -2);
  scene.add(purpleLight);

  return { renderer, scene, camera, torus, wireRing, diamonds, particleRing, goldLight, pinkLight };
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const canvasRef = useRef(null);
  const audioRef  = useRef(null);
  const sceneRef  = useRef(null);
  const mouseRef  = useRef({ x: 0, y: 0 });
  const gyroRef   = useRef({ x: 0, y: 0 });
  const frameRef  = useRef(null);
  const burstIdRef = useRef(0);

  const [started, setStarted]       = useState(false);
  const [playing, setPlaying]       = useState(false);
  const [bursts, setBursts]         = useState([]);
  const [toast, setToast]           = useState(null);
  const [hasGyro, setHasGyro]       = useState(false);

  // ── Start handler
  const handleStart = useCallback(async () => {
    setStarted(true);
    // Try to play audio
    if (audioRef.current) {
      try {
        await audioRef.current.play();
        setPlaying(true);
      } catch (e) {
        // Autoplay blocked; user can toggle manually
      }
    }
    // Request gyro on iOS
    if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
      try {
        const perm = await DeviceOrientationEvent.requestPermission();
        if (perm === "granted") setHasGyro(true);
      } catch (_) {}
    } else if (window.DeviceOrientationEvent) {
      setHasGyro(true);
    }
  }, []);

  // ── Three.js init
  useEffect(() => {
    if (!started || !canvasRef.current) return;
    const sc = initScene(canvasRef.current);
    sceneRef.current = sc;

    const { renderer, scene, camera, torus, wireRing, diamonds, particleRing, goldLight, pinkLight } = sc;
    let t = 0;
    let beatPhase = 0;

    function animate() {
      frameRef.current = requestAnimationFrame(animate);
      t += 0.008;
      beatPhase += 0.04;

      // Camera parallax
      const mx = mouseRef.current.x + gyroRef.current.x;
      const my = mouseRef.current.y + gyroRef.current.y;
      camera.position.x += (mx * 1.5 - camera.position.x) * 0.05;
      camera.position.y += (-my * 1.2 - camera.position.y) * 0.05;
      camera.lookAt(scene.position);

      // Torus rotation
      torus.rotation.x += 0.004;
      torus.rotation.y += 0.007;
      torus.rotation.z += 0.002;
      wireRing.rotation.x -= 0.003;
      wireRing.rotation.y -= 0.006;

      // Beat pulse on torus
      const pulse = 1 + Math.sin(beatPhase) * 0.05;
      torus.scale.setScalar(pulse);
      wireRing.scale.setScalar(pulse * 1.02);

      // Torus emissive flicker
      torus.material.emissiveIntensity = 0.1 + Math.sin(beatPhase * 1.5) * 0.1;

      // Particle ring rotation
      particleRing.rotation.z += 0.003;
      particleRing.rotation.x = Math.sin(t * 0.4) * 0.3;

      // Diamond floats
      diamonds.forEach((d) => {
        d.rotation.x += d.userData.rotSpeed;
        d.rotation.y += d.userData.rotSpeed * 0.7;
        d.position.y = d.userData.baseY + Math.sin(t + d.userData.offset) * 0.6;
        d.position.x += Math.sin(t * d.userData.speed * 10 + d.userData.offset) * 0.002;
      });

      // Lights pulsing
      goldLight.intensity  = 3 + Math.sin(t * 2.1) * 1.5;
      pinkLight.intensity  = 2 + Math.cos(t * 1.7) * 1.2;
      pinkLight.position.x = Math.cos(t * 0.4) * 4;
      pinkLight.position.y = Math.sin(t * 0.4) * 3;

      renderer.render(scene, camera);
    }

    animate();

    // Resize handler
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
    };
  }, [started]);

  // ── Mouse movement
  useEffect(() => {
    const onMove = (e) => {
      mouseRef.current.x = (e.clientX / window.innerWidth)  * 2 - 1;
      mouseRef.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  // ── Touch movement
  useEffect(() => {
    const onTouch = (e) => {
      if (!e.touches[0]) return;
      mouseRef.current.x = (e.touches[0].clientX / window.innerWidth)  * 2 - 1;
      mouseRef.current.y = (e.touches[0].clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("touchmove", onTouch, { passive: true });
    return () => window.removeEventListener("touchmove", onTouch);
  }, []);

  // ── Gyroscope
  useEffect(() => {
    if (!hasGyro) return;
    const onOrient = (e) => {
      gyroRef.current.x =  (e.gamma || 0) / 45;
      gyroRef.current.y = -(e.beta  || 0) / 45;
    };
    window.addEventListener("deviceorientation", onOrient);
    return () => window.removeEventListener("deviceorientation", onOrient);
  }, [hasGyro]);

  // ── Tap/click burst
  const spawnBurst = useCallback((x, y) => {
    const word = ORA_WORDS[Math.floor(Math.random() * ORA_WORDS.length)];
    const id   = ++burstIdRef.current;
    setBursts(prev => [...prev, { id, x, y, word }]);
    setTimeout(() => setBursts(prev => prev.filter(b => b.id !== id)), 700);
  }, []);

  const handleClick = useCallback((e) => {
    if (!started) return;
    const x = e.clientX || (e.touches && e.touches[0]?.clientX) || window.innerWidth / 2;
    const y = e.clientY || (e.touches && e.touches[0]?.clientY) || window.innerHeight / 2;
    spawnBurst(x, y);
    // Briefly boost torus spin
    if (sceneRef.current) {
      sceneRef.current.torus.material.emissiveIntensity = 0.8;
    }
  }, [started, spawnBurst]);

  // ── Part card click
  const handlePartClick = useCallback((part, e) => {
    e.stopPropagation();
    setToast(`Part ${part.num}: ${part.name}`);
    if (sceneRef.current) {
      sceneRef.current.torus.material.color.set(part.color);
      sceneRef.current.torus.material.emissive.set(part.color);
    }
    setTimeout(() => setToast(null), 2500);
  }, []);

  // ── Music toggle
  const toggleMusic = useCallback(async (e) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      await audioRef.current.play();
      setPlaying(true);
    }
  }, [playing]);

  return (
    <>
      {/* Hidden audio — add your jojo.mp3 to /public */}
      <audio ref={audioRef} src="/jojo.mp3" loop preload="auto" />

      {/* THREE.JS canvas */}
      <div className="canvas-container" onClick={handleClick}>
        <canvas ref={canvasRef} />
      </div>

      {/* Atmosphere */}
      <div className="scanlines" />
      <div className="vignette" />

      {/* ── Start screen ── */}
      {!started && (
        <div className="start-screen" onClick={handleStart}>
          <div className="start-logo">WATCH<br />JOJO</div>
          <div className="start-sub">The greatest anime ever made</div>
          <div className="start-tap">[ tap to enter ]</div>
        </div>
      )}

      {/* ── Main overlay ── */}
      {started && (
        <div className="overlay">
          <div className="main-title">WATCH JOJO</div>
          <div className="subtitle">NOW.</div>
          <div className="tagline">Your stand ability demands it</div>

          <div className="parts-row">
            {PARTS.map((p) => (
              <div
                key={p.num}
                className="part-card"
                style={{ borderColor: p.color + "55" }}
                onClick={(e) => handlePartClick(p, e)}
              >
                <div className="part-number" style={{ color: p.color }}>
                  {p.num}
                </div>
                <div className="part-name">{p.name}</div>
              </div>
            ))}
          </div>

          <div className="motto">「Your next line is: I'll watch JoJo right now」</div>
        </div>
      )}

      {/* Toast notification */}
      {toast && <div className="part-toast">{toast}</div>}

      {/* Burst texts */}
      {bursts.map(b => (
        <div
          key={b.id}
          className="burst-text"
          style={{ left: b.x, top: b.y }}
        >
          {b.word}
        </div>
      ))}

      {/* Music button */}
      {started && (
        <button className="music-btn" onClick={toggleMusic} aria-label="Toggle music">
          <span>{playing ? "🎵" : "🔇"}</span>
        </button>
      )}

      {/* Gyro hint on mobile */}
      {started && hasGyro && (
        <div className="gyro-hint">Tilt to move</div>
      )}
    </>
  );
}