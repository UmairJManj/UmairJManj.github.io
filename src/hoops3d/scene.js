/* ---------------------------------------------------------------------------
   Hoops 3D scene: a night arena in Three.js.

   Everything is procedural (no image assets): hardwood and court lines are
   painted into a canvas texture, the ball's pebble grain and seams too, so
   the whole arena ships as code. Lighting is a ring of ceiling spots over the
   key with one shadow caster, cool fill, and neon accent strips in the
   current exam's colour, finished with bloom.
--------------------------------------------------------------------------- */
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { BALL_R, RIM_Y, RIM_R, BOARD_GAP, NET } from "./physics.js";

const COURT_W = 15, COURT_L = 28;
const END_Z = -BOARD_GAP - 1.2;     // baseline sits 1.2 m behind the board

/* --- procedural textures ------------------------------------------------- */

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function courtTexture(accent) {
  const PX = 80; // pixels per metre
  const W = COURT_W + 4, L = COURT_L + 4;
  const c = document.createElement("canvas");
  c.width = Math.round(W * PX); c.height = Math.round(L * PX);
  const g = c.getContext("2d");
  const r = rng(7);
  // Maple planks run the length of the court.
  const plank = 0.075 * PX;
  for (let x = 0; x < c.width; x += plank) {
    let y = -r() * 2 * PX;
    while (y < c.height) {
      const l = (1.4 + r() * 2.2) * PX;
      const t = 0.82 + r() * 0.18;
      g.fillStyle = `rgb(${Math.round(196 * t)},${Math.round(142 * t)},${Math.round(86 * t)})`;
      g.fillRect(x, y, plank - 1, l - 1);
      // grain
      g.strokeStyle = `rgba(90,50,20,${0.05 + r() * 0.08})`;
      g.lineWidth = 1;
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        const gx = x + r() * plank;
        g.moveTo(gx, y);
        g.bezierCurveTo(gx + (r() - 0.5) * 4, y + l / 3, gx + (r() - 0.5) * 4, y + (2 * l) / 3, gx, y + l);
        g.stroke();
      }
      y += l;
    }
  }
  g.fillStyle = "rgba(0,0,0,0.12)";
  for (let x = 0; x < c.width; x += plank) g.fillRect(x + plank - 1, 0, 1, c.height);

  // Court coordinates -> canvas: x in [-W/2, W/2], z from END_Z - 2.
  const cx = (x) => (x + W / 2) * PX;
  const cz = (z) => (z - (END_Z - 2)) * PX;
  const line = (w = 0.05) => { g.lineWidth = w * PX; };

  // Paint (the key) in a dark tint of the accent, plus out-of-bounds apron.
  g.fillStyle = "rgba(10,12,22,0.72)";
  g.fillRect(0, 0, c.width, cz(END_Z));
  g.fillRect(0, 0, cx(-COURT_W / 2), c.height);
  g.fillRect(cx(COURT_W / 2), 0, c.width, c.height);
  const col = new THREE.Color(accent);
  g.fillStyle = `rgba(${col.r * 110 | 0},${col.g * 110 | 0},${col.b * 110 | 0},0.5)`;
  const keyW = 4.9, ftZ = 4.6 - BOARD_GAP;
  g.fillRect(cx(-keyW / 2), cz(END_Z), keyW * PX, (ftZ - END_Z) * PX);

  g.strokeStyle = "rgba(250,248,240,0.92)";
  line();
  g.strokeRect(cx(-COURT_W / 2), cz(END_Z), COURT_W * PX, COURT_L * PX);
  g.strokeRect(cx(-keyW / 2), cz(END_Z), keyW * PX, (ftZ - END_Z) * PX);
  // Free-throw circle.
  g.beginPath(); g.arc(cx(0), cz(ftZ), 1.8 * PX, 0, Math.PI * 2); g.stroke();
  // Restricted area.
  g.beginPath(); g.arc(cx(0), cz(0), 1.25 * PX, 0, Math.PI); g.stroke();
  // Three-point line (FIBA): 6.75 m arc, straight 0.9 m in from the sideline.
  const R3 = 6.75, sx = COURT_W / 2 - 0.9;
  const zj = Math.sqrt(R3 * R3 - sx * sx);
  g.beginPath();
  g.moveTo(cx(-sx), cz(END_Z)); g.lineTo(cx(-sx), cz(zj));
  g.arc(cx(0), cz(0), R3 * PX, Math.PI - Math.atan2(zj, sx), Math.atan2(zj, sx), true);
  g.lineTo(cx(sx), cz(END_Z));
  g.stroke();
  // Half court and centre circle.
  const half = END_Z + COURT_L / 2;
  g.beginPath(); g.moveTo(cx(-COURT_W / 2), cz(half)); g.lineTo(cx(COURT_W / 2), cz(half)); g.stroke();
  g.beginPath(); g.arc(cx(0), cz(half), 1.8 * PX, 0, Math.PI * 2); g.stroke();
  // Centre logo ring in the accent colour.
  g.strokeStyle = accent; line(0.12);
  g.beginPath(); g.arc(cx(0), cz(half), 1.1 * PX, 0, Math.PI * 2); g.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return { tex, W, L, z0: END_Z - 2 };
}

function ballTexture() {
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 512;
  const g = c.getContext("2d");
  g.fillStyle = "#d4621f";
  g.fillRect(0, 0, c.width, c.height);
  // Pebble grain.
  const r = rng(3);
  for (let i = 0; i < 26000; i++) {
    const x = r() * c.width, y = r() * c.height;
    g.fillStyle = r() < 0.5 ? "rgba(120,40,10,0.18)" : "rgba(255,170,110,0.12)";
    g.fillRect(x, y, 1.6, 1.6);
  }
  g.strokeStyle = "#1a0f0a";
  g.lineWidth = 9;
  // Equator and one meridian great circle (two vertical lines in equirect).
  g.beginPath(); g.moveTo(0, 256); g.lineTo(1024, 256); g.stroke();
  for (const u of [256, 768]) { g.beginPath(); g.moveTo(u, 0); g.lineTo(u, 512); g.stroke(); }
  // The two curved seams.
  for (const u0 of [0, 512]) {
    g.beginPath();
    for (let y = 0; y <= 512; y += 4) {
      const v = y / 512;
      const x = u0 + 128 + Math.sin(v * Math.PI) * 0 + Math.cos(v * Math.PI * 2) * 0 + (Math.sin(v * Math.PI) * 120 - 120) * -1;
      if (y === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const bump = new THREE.CanvasTexture(c);
  return { tex, bump };
}

function labelTexture(text, color, sub = "") {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 256;
  const g = c.getContext("2d");
  g.clearRect(0, 0, 512, 256);
  g.fillStyle = "rgba(6,8,14,0.78)";
  g.beginPath(); g.roundRect(8, 8, 496, 240, 28); g.fill();
  g.strokeStyle = color; g.lineWidth = 10;
  g.beginPath(); g.roundRect(8, 8, 496, 240, 28); g.stroke();
  g.fillStyle = "#ffffff";
  g.textAlign = "center"; g.textBaseline = "middle";
  g.font = `bold ${text.length > 2 ? 104 : 150}px system-ui, sans-serif`;
  g.fillText(text, 256, sub ? 108 : 132);
  if (sub) { g.font = "500 40px system-ui, sans-serif"; g.fillStyle = color; g.fillText(sub, 256, 196); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function boardTexture(accent) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 300;
  const g = c.getContext("2d");
  g.clearRect(0, 0, 512, 300);
  g.strokeStyle = "rgba(255,255,255,0.95)";
  g.lineWidth = 10;
  g.strokeRect(6, 6, 500, 288);
  // Shooter's square: 0.59 x 0.45 m above the rim.
  g.strokeStyle = accent;
  g.lineWidth = 8;
  const sw = (0.59 / 1.8) * 512, sh = (0.45 / 1.05) * 300;
  g.strokeRect(256 - sw / 2, 300 - (0.15 / 1.05) * 300 - sh, sw, sh);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* --- scene ------------------------------------------------------------------ */

export function createScene(canvas, { quality = "high" } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality !== "high", powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = quality !== "low";
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05060b);
  scene.fog = new THREE.Fog(0x05060b, 16, 42);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  scene.environmentIntensity = 0.35;

  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 80);
  camera.position.set(0, 1.9, 7);

  /* lights */
  scene.add(new THREE.HemisphereLight(0x6f86c9, 0x140c08, 0.35));
  const key = new THREE.SpotLight(0xfff1dc, 260, 30, Math.PI / 5.2, 0.55, 1.6);
  key.position.set(0.5, 11, 4.2);
  key.target.position.set(0, 0, 2.2);
  key.castShadow = quality !== "low";
  key.shadow.mapSize.set(quality === "high" ? 2048 : 1024, quality === "high" ? 2048 : 1024);
  key.shadow.bias = -0.0004;
  key.shadow.radius = 4;
  scene.add(key, key.target);
  for (const [x, z] of [[-6, 6], [6, 6], [-5, -0.5], [5, -0.5], [0, 12]]) {
    const s = new THREE.SpotLight(0xffe8cc, 120, 30, Math.PI / 5, 0.7, 1.7);
    s.position.set(x, 10.5, z);
    s.target.position.set(x * 0.3, 0, z * 0.6);
    scene.add(s, s.target);
  }

  /* court */
  const accentColor = new THREE.Color("#3b82f6");
  const floorMat = new THREE.MeshStandardMaterial({ roughness: 0.32, metalness: 0.0, envMapIntensity: 0.9 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  function paintCourt(accent) {
    const { tex, W, L, z0 } = courtTexture(accent);
    if (floorMat.map) floorMat.map.dispose();
    floorMat.map = tex;
    floorMat.needsUpdate = true;
    floor.scale.set(W, L, 1);
    floor.position.set(0, 0, z0 + L / 2);
  }
  // Dark surround beyond the court.
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(80, 80),
    new THREE.MeshStandardMaterial({ color: 0x07080d, roughness: 0.9 }));
  apron.rotation.x = -Math.PI / 2; apron.position.y = -0.005;
  apron.receiveShadow = true;
  scene.add(apron);

  /* neon accent strips around the court */
  const neonMat = new THREE.MeshBasicMaterial({ color: accentColor, toneMapped: false });
  const neon = new THREE.Group();
  const strip = (w, d, x, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, d), neonMat);
    m.position.set(x, 0.015, z); neon.add(m);
  };
  strip(COURT_W + 2.4, 0.06, 0, END_Z - 1.2);
  strip(0.06, COURT_L + 2.4, -COURT_W / 2 - 1.2, END_Z + COURT_L / 2);
  strip(0.06, COURT_L + 2.4, COURT_W / 2 + 1.2, END_Z + COURT_L / 2);
  // LED ad boards at the baseline.
  const ledMat = new THREE.MeshBasicMaterial({ color: accentColor.clone().multiplyScalar(0.45), toneMapped: false });
  const led = new THREE.Mesh(new THREE.BoxGeometry(COURT_W, 0.9, 0.1), ledMat);
  led.position.set(0, 0.45, END_Z - 2.6);
  neon.add(led);
  scene.add(neon);

  /* stands + crowd */
  const stands = new THREE.Group();
  const standMat = new THREE.MeshStandardMaterial({ color: 0x0c0e16, roughness: 0.85 });
  const tiers = 9;
  const crowdGeo = new THREE.CapsuleGeometry(0.19, 0.28, 2, 8);
  const headGeo = new THREE.SphereGeometry(0.105, 10, 8);
  const headMat = new THREE.MeshStandardMaterial({ color: 0x3a2a22, roughness: 0.7 });
  const crowdMat = new THREE.MeshStandardMaterial({ roughness: 0.8 });
  const fans = [];
  const sides = [
    { x0: -COURT_W / 2 - 3, z0: END_Z, len: COURT_L, dir: [-1, 0], rot: Math.PI / 2 },
    { x0: COURT_W / 2 + 3, z0: END_Z, len: COURT_L, dir: [1, 0], rot: -Math.PI / 2 },
    { x0: 0, z0: END_Z - 4, len: COURT_W + 6, dir: [0, -1], rot: 0 },
  ];
  const r = rng(11);
  for (const s of sides) {
    for (let t = 0; t < tiers; t++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(s.dir[0] ? 0.85 : s.len, 0.42, s.dir[0] ? s.len : 0.85), standMat);
      const off = t * 0.85;
      step.position.set(s.x0 + s.dir[0] * off, 0.21 + t * 0.42, (s.dir[0] ? s.z0 + s.len / 2 : s.z0) + s.dir[1] * off);
      step.receiveShadow = false;
      stands.add(step);
      const n = Math.floor(s.len / 0.62);
      for (let i = 0; i < n; i++) {
        if (r() < 0.12) continue;
        const along = -s.len / 2 + (i + 0.5) * (s.len / n);
        fans.push({
          x: s.dir[0] ? step.position.x : along, z: s.dir[0] ? step.position.z + along : step.position.z,
          y: step.position.y + 0.21 + 0.42, phase: r() * Math.PI * 2, hype: 0.4 + r() * 0.8,
          color: new THREE.Color().setHSL(r(), 0.12 + r() * 0.2, 0.05 + r() * 0.1),
        });
      }
    }
  }
  const crowd = new THREE.InstancedMesh(crowdGeo, crowdMat, fans.length);
  const heads = new THREE.InstancedMesh(headGeo, headMat, fans.length);
  const skin = [0x2b1a12, 0x4a2e20, 0x6b4630, 0x8d5f43, 0xb98a6a, 0xd9b08f];
  fans.forEach((f, i) => {
    crowd.setColorAt(i, f.color);
    heads.setColorAt(i, new THREE.Color(skin[Math.floor(r() * skin.length)]).multiplyScalar(0.55));
  });
  scene.add(stands, crowd, heads);

  /* jumbotron */
  const jumboCanvas = document.createElement("canvas");
  jumboCanvas.width = 1024; jumboCanvas.height = 512;
  const jumboTex = new THREE.CanvasTexture(jumboCanvas);
  jumboTex.colorSpace = THREE.SRGBColorSpace;
  const jumbo = new THREE.Mesh(new THREE.BoxGeometry(5.2, 2.6, 0.3), [
    standMat, standMat, standMat, standMat,
    new THREE.MeshBasicMaterial({ map: jumboTex, toneMapped: false }), standMat,
  ]);
  jumbo.position.set(0, 9.2, END_Z - 3.2);
  scene.add(jumbo);
  function drawJumbo({ title = "", score = 0, streak = 0, accent = "#3b82f6", flash = "" }) {
    const g = jumboCanvas.getContext("2d");
    g.fillStyle = "#04050a"; g.fillRect(0, 0, 1024, 512);
    g.strokeStyle = accent; g.lineWidth = 14; g.strokeRect(10, 10, 1004, 492);
    g.fillStyle = accent; g.textAlign = "center";
    let fs = 64;
    do { g.font = `600 ${fs}px system-ui, sans-serif`; fs -= 4; } while (g.measureText(title).width > 940 && fs > 24);
    g.fillText(title, 512, 110);
    g.fillStyle = "#fff"; g.font = "bold 200px ui-monospace, monospace";
    g.fillText(String(score).padStart(3, "0"), 512, 320);
    g.font = "500 54px system-ui, sans-serif"; g.fillStyle = "#cbd5e1";
    g.fillText(flash || (streak > 1 ? `Streak ${streak}` : "Shoot to learn"), 512, 440);
    jumboTex.needsUpdate = true;
  }

  /* ball */
  const bt = ballTexture();
  const ballMat = new THREE.MeshStandardMaterial({ map: bt.tex, bumpMap: bt.bump, bumpScale: 0.6, roughness: 0.72 });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 48, 32), ballMat);
  ball.castShadow = true;
  scene.add(ball);

  /* hoops */
  const hoopGroup = new THREE.Group();
  scene.add(hoopGroup);
  let hoopViews = [];
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xff4d12, roughness: 0.35, metalness: 0.6, emissive: 0x220500 });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.02, metalness: 0, transparent: true, opacity: 0.07,
    envMapIntensity: 1.2, clearcoat: 1, depthWrite: false,
  });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x1b1e26, roughness: 0.5, metalness: 0.7 });
  const padMat = new THREE.MeshStandardMaterial({ color: 0x0d1018, roughness: 0.8 });
  const netMat = new THREE.LineBasicMaterial({ color: 0xf4f4f4, transparent: true, opacity: 0.9 });

  function buildHoops(hoops, accent) {
    for (const v of hoopViews) {
      v.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.map) o.material.map.dispose(); });
      hoopGroup.remove(v.group);
    }
    hoopViews = hoops.map((h) => {
      const group = new THREE.Group();
      const rim = new THREE.Mesh(new THREE.TorusGeometry(RIM_R, 0.009, 12, 48), rimMat);
      rim.rotation.x = Math.PI / 2;
      rim.castShadow = true;
      group.add(rim);
      // Neck from rim to board.
      const neck = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, BOARD_GAP - RIM_R), rimMat);
      neck.position.set(0, -0.01, -(BOARD_GAP + RIM_R) / 2);
      group.add(neck);
      const board = new THREE.Group();
      const glass = new THREE.Mesh(new THREE.BoxGeometry(h.boardW, 1.05, 0.03), glassMat);
      glass.position.set(0, 3.425 - RIM_Y, -BOARD_GAP - 0.015);
      const lines = new THREE.Mesh(new THREE.PlaneGeometry(h.boardW, 1.05),
        new THREE.MeshBasicMaterial({ map: boardTexture(accent), transparent: true, depthWrite: false }));
      lines.position.set(0, 3.425 - RIM_Y, -BOARD_GAP + 0.002);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(h.boardW + 0.06, 0.05, 0.06), frameMat);
      frame.position.set(0, 3.95 - RIM_Y + 0.02, -BOARD_GAP - 0.03);
      const frameB = frame.clone(); frameB.position.y = 2.9 - RIM_Y - 0.02;
      board.add(glass, lines, frame, frameB);
      group.add(board);
      // Stanchion: arm + pole + padded base, behind the baseline.
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.3), frameMat);
      arm.position.set(0, 3.2 - RIM_Y, -BOARD_GAP - 0.7);
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.3, 0.2), padMat);
      pole.position.set(0, 1.65 - RIM_Y, -BOARD_GAP - 1.4);
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 1.6), padMat);
      base.position.set(0, 0.35 - RIM_Y, -BOARD_GAP - 2.0);
      for (const m of [arm, pole, base]) { m.castShadow = true; group.add(m); }
      // Net.
      const segs = new Float32Array(h.links.length * 6);
      const netGeo = new THREE.BufferGeometry();
      netGeo.setAttribute("position", new THREE.BufferAttribute(segs, 3));
      const net = new THREE.LineSegments(netGeo, netMat);
      net.frustumCulled = false;
      scene.add(net); // net lives in world space
      // Answer label above the board.
      let label = null;
      if (h.label) {
        label = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45),
          new THREE.MeshBasicMaterial({ map: labelTexture(h.label.text, h.label.color || accent, h.label.sub || ""), transparent: true, toneMapped: false }));
        label.position.set(0, 4.32 - RIM_Y, -BOARD_GAP);
        group.add(label);
      }
      group.position.set(h.x, RIM_Y, h.z);
      hoopGroup.add(group);
      return { group, rim, board, net, label, h };
    });
  }

  /* trajectory guide (dotted arc while aiming) */
  const guideGeo = new THREE.BufferGeometry();
  guideGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(3 * 40), 3));
  const guide = new THREE.Points(guideGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.05, transparent: true, opacity: 0.7, toneMapped: false }));
  guide.visible = false;
  guide.frustumCulled = false;
  scene.add(guide);

  /* post */
  let composer = null, bloom = null;
  if (quality !== "low") {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.6, 0.82);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  function setAccent(accent) {
    accentColor.set(accent);
    neonMat.color.set(accent);
    ledMat.color.set(accent).multiplyScalar(0.45);
    paintCourt(accent);
  }
  setAccent("#3b82f6");

  function resize(w, h, dpr) {
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (composer) { composer.setPixelRatio(dpr); composer.setSize(w, h); }
  }

  const q = new THREE.Quaternion(), axis = new THREE.Vector3(), mtx = new THREE.Matrix4();
  function sync(world, dt, hype) {
    const b = world.ball;
    ball.position.set(b.p.x, b.p.y, b.p.z);
    const wl = Math.hypot(b.w.x, b.w.y, b.w.z);
    if (wl > 1e-4 && b.live) {
      axis.set(b.w.x / wl, b.w.y / wl, b.w.z / wl);
      q.setFromAxisAngle(axis, wl * dt);
      ball.quaternion.premultiply(q);
    }
    hoopViews.forEach((v) => {
      const h = v.h;
      v.group.position.set(h.x, RIM_Y, h.z);
      v.rim.position.y = h.rimDy;
      v.board.position.z = h.boardDz;
      const arr = v.net.geometry.attributes.position.array;
      let o = 0;
      for (const [a, c] of h.links) {
        const A = h.knots[a], C = h.knots[c];
        arr[o++] = A.x; arr[o++] = A.y; arr[o++] = A.z;
        arr[o++] = C.x; arr[o++] = C.y; arr[o++] = C.z;
      }
      v.net.geometry.attributes.position.needsUpdate = true;
    });
    // Crowd: idle sway, jump with hype.
    const t = world.t;
    for (let i = 0; i < fans.length; i++) {
      const f = fans[i];
      const j = Math.max(0, Math.sin(t * (4 + f.hype * 3) + f.phase)) * 0.22 * hype * f.hype;
      const y = f.y + j + Math.sin(t * 0.8 + f.phase) * 0.01;
      mtx.makeTranslation(f.x, y, f.z);
      crowd.setMatrixAt(i, mtx);
      mtx.makeTranslation(f.x, y + 0.36, f.z);
      heads.setMatrixAt(i, mtx);
    }
    crowd.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
  }

  function setGuide(points) {
    if (!points) { guide.visible = false; return; }
    const arr = guide.geometry.attributes.position.array;
    for (let i = 0; i < 40; i++) {
      const p = points[Math.min(i, points.length - 1)];
      arr[i * 3] = p.x; arr[i * 3 + 1] = p.y; arr[i * 3 + 2] = p.z;
    }
    guide.geometry.attributes.position.needsUpdate = true;
    guide.visible = true;
  }

  let useComposer = !!composer;
  function render() {
    if (useComposer) composer.render(); else renderer.render(scene, camera);
  }
  // Step down one quality notch: 0 -> no bloom, 1 -> no shadows, 2 -> lower resolution.
  function degrade(level) {
    if (level === 0 && useComposer) { useComposer = false; return 1; }
    if (level <= 1 && renderer.shadowMap.enabled) {
      renderer.shadowMap.enabled = false;
      scene.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; }); });
      return 2;
    }
    if (level <= 2 && renderer.getPixelRatio() > 1) { renderer.setPixelRatio(1); return 3; }
    return level;
  }

  function dispose() {
    renderer.dispose();
    pmrem.dispose();
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const m = o.material;
      if (m) (Array.isArray(m) ? m : [m]).forEach((mm) => { if (mm.map) mm.map.dispose(); mm.dispose(); });
    });
  }

  return { renderer, scene, camera, resize, sync, render, degrade, buildHoops, setAccent, drawJumbo, setGuide, dispose, ballMesh: ball };
}
