/* ---------------------------------------------------------------------------
   Hoops game controller: ties physics, the 3D scene, sound and input.

   Modes
     lesson: one hoop, the shooter moves around the court (free throw, elbows,
             wings, threes). Every make unlocks the next lesson card.
     quiz:   2 to 5 hoops in a row, each labelled with an answer. The basket
             you sink is the answer you give.

   Controls
     flick: swipe up from the ball. Length = power, direction = aim, a curve
            at the end adds side spin.
     meter: press and hold; a power meter pulses; aim by moving the pointer;
            release to shoot.
--------------------------------------------------------------------------- */
import * as THREE from "three";
import {
  createWorld, setHoops, placeBall, shoot, step, idealShot, velocityFrom, spinFor, RIM_Y,
} from "./physics.js";
import { createScene } from "./scene.js";
import { createAudio } from "./audio.js";

export const SPOTS = [
  { name: "Free throw", x: 0, z: 4.22, pts: 1 },
  { name: "Left elbow", x: -2.0, z: 4.4, pts: 2 },
  { name: "Right elbow", x: 2.0, z: 4.4, pts: 2 },
  { name: "Left block", x: -2.4, z: 1.6, pts: 2 },
  { name: "Right wing", x: 3.6, z: 3.4, pts: 2 },
  { name: "Top of the key", x: 0, z: 7.0, pts: 3 },
  { name: "Left wing three", x: -4.8, z: 5.0, pts: 3 },
  { name: "Right corner three", x: 6.7, z: 0.9, pts: 3 },
];

const RELEASE_Y = 2.05;
const SWEET_FRAC = 0.27;   // a flick this share of the canvas height is perfect power
const STEP = 1 / 240;

export function createGame(canvas, opts = {}) {
  const forced = new URLSearchParams(location.search).get("h3dq");
  const quality = forced || opts.quality || (matchMedia("(pointer: coarse)").matches ? "medium" : "high");
  const view = createScene(canvas, { quality });
  const audio = createAudio();
  const world = createWorld();
  const cb = { onResult: () => {}, onMeter: () => {}, onShot: () => {}, ...opts };

  let mode = { kind: "lesson" };
  let spot = SPOTS[0];
  let control = "flick";
  let diff = { assist: 1, wind: 0, sway: 0 };
  let accent = "#3b82f6";
  let jumbo = { title: "", score: 0, streak: 0 };
  let hype = 0.15;
  let running = true, visible = true, raf = 0;
  let target = 0;               // hoop index the current shot is aimed at
  let crossing = null;          // where the ball crossed rim height near the target
  let swished = false;
  let flashText = "", flashUntil = 0;
  const cam = { pos: new THREE.Vector3(), look: new THREE.Vector3(), goalPos: new THREE.Vector3(), goalLook: new THREE.Vector3() };

  /* --- layout ------------------------------------------------------------- */

  function hoopsFor(m) {
    if (m.kind !== "quiz") return [{ x: 0, z: 0, boardW: 1.8 }];
    const n = m.labels.length;
    const s = n <= 2 ? 2.6 : n === 3 ? 2.1 : n === 4 ? 1.75 : 1.5;
    const bw = Math.min(1.8, s - 0.22);
    return m.labels.map((l, i) => ({ x: (i - (n - 1) / 2) * s, z: 0, boardW: bw, label: l }));
  }

  function forward() {
    // Look from the shooter towards the middle of the hoop line.
    const cx = world.hoops.reduce((a, h) => a + h.baseX, 0) / world.hoops.length;
    const d = new THREE.Vector3(cx - spot.x, 0, 0 - spot.z);
    return d.normalize();
  }

  function camGoals() {
    const f = forward();
    // Framed from the shooting spot, not the ball, so the camera holds still in flight.
    const b = { x: spot.x, z: spot.z };
    const back = mode.kind === "quiz" ? 2.6 : 1.9;
    cam.goalPos.set(b.x - f.x * back, 2.75, b.z - f.z * back);
    // Look at a point a little below the rim line, so floor, ball and hoop all sit in frame.
    const cx = world.hoops.reduce((a, h) => a + h.baseX, 0) / world.hoops.length;
    cam.goalLook.set(cx * 0.9 + b.x * 0.1, 2.35, 0.6 + b.z * 0.08);
    // Fit the field of view to the hoops in view.
    const aspect = view.camera.aspect || 0.75;
    let half = 0.32;
    for (const h of world.hoops) {
      const dx = h.baseX - cam.goalPos.x, dz = h.z - cam.goalPos.z;
      const fwd = dx * f.x + dz * f.z;
      const lat = Math.abs(-dx * f.z + dz * f.x) + h.boardW / 2 + 0.25;
      half = Math.max(half, Math.atan2(lat, fwd));
    }
    const vf = 2 * Math.atan(Math.tan(half) / aspect) * (180 / Math.PI);
    // At least 50 degrees tall, so the ball stays in frame on wide (full screen) views.
    view.camera.fov = Math.max(50, Math.min(80, vf));
    view.camera.updateProjectionMatrix();
  }

  function resetBall(snap = false) {
    const f = forward();
    placeBall(world, { x: spot.x - f.x * 0.0, y: RELEASE_Y, z: spot.z });
    crossing = null; swished = false;
    camGoals();
    if (snap) { cam.pos.copy(cam.goalPos); cam.look.copy(cam.goalLook); }
  }

  function applyMode(m, nextSpot) {
    mode = m;
    setHoops(world, hoopsFor(m));
    world.sway.amp = diff.sway;
    view.buildHoops(world.hoops, accent);
    if (nextSpot) spot = nextSpot;
    else if (m.kind === "quiz") spot = { name: m.three ? "Three" : "Quiz line", x: 0, z: m.three ? 6.9 : 5.2, pts: m.three ? 3 : 2 };
    resetBall(true);
  }

  /* --- aiming ---------------------------------------------------------------- */

  const tmpV = new THREE.Vector3();
  function toScreen(x, y, z) {
    tmpV.set(x, y, z).project(view.camera);
    const r = canvas.getBoundingClientRect();
    return { x: (tmpV.x * 0.5 + 0.5) * r.width, y: (-tmpV.y * 0.5 + 0.5) * r.height };
  }

  function pickTarget(alpha) {
    const b = world.ball.p;
    const bs = toScreen(b.x, b.y, b.z);
    let best = 0, bestErr = Infinity, bestGamma = 0;
    world.hoops.forEach((h, i) => {
      const hs = toScreen(h.x, RIM_Y, h.z);
      const g = Math.atan2(hs.x - bs.x, bs.y - hs.y);
      const e = Math.abs(alpha - g);
      if (e < bestErr) { bestErr = e; best = i; bestGamma = g; }
    });
    return { index: best, err: alpha - bestGamma };
  }

  function fire(power, alpha, sideRps = 0) {
    if (!world.ball.held) return;
    audio.unlock();
    const { index, err } = pickTarget(alpha);
    target = index;
    const h = world.hoops[index];
    const dist = Math.hypot(h.x - spot.x, h.z - spot.z);
    const angle = dist > 6 ? 50 : dist < 3.5 ? 60 : 53;
    const back = 2.2 + Math.min(1.4, power) * 0.7;
    const ideal = idealShot(world, world.ball.p, h, angle, back);
    // Assist: a near-perfect flick snaps to perfect; errors are scaled down.
    const a = diff.assist;
    let pErr = power - 1;
    if (Math.abs(pErr) < 0.05 * a) pErr = 0;
    const kS = 0.1 + (1 - a) * 0.16;
    const kH = 0.12 + (1 - a) * 0.22;
    let hErr = err;
    if (Math.abs(hErr) < 0.05 * a) hErr = 0;
    const speed = ideal.speed * (1 + pErr * kS);
    const heading = ideal.heading + hErr * kH;
    const v = velocityFrom(speed, heading, ideal.angle);
    const w = spinFor(v, back, sideRps);
    shoot(world, v, w);
    cb.onShot({ target, spot: spot.name });
    view.setGuide(null);
  }

  /* --- input ----------------------------------------------------------------- */

  let pts = [], pressing = false, meterT0 = 0, meterVal = 0, aimAlpha = 0;
  function local(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() };
  }
  function aimFromPointer(p) {
    const b = world.ball.p;
    const bs = toScreen(b.x, b.y, b.z);
    return Math.atan2(p.x - bs.x, Math.max(20, bs.y - p.y));
  }
  function onDown(e) {
    if (!world.ball.held) return;
    audio.unlock();
    canvas.setPointerCapture?.(e.pointerId);
    pressing = true;
    pts = [local(e)];
    if (control === "meter") { meterT0 = performance.now(); aimAlpha = aimFromPointer(pts[0]); }
  }
  function onMove(e) {
    if (!pressing) return;
    const p = local(e);
    pts.push(p);
    if (pts.length > 40) pts.shift();
    if (control === "meter") aimAlpha = aimFromPointer(p);
  }
  function onUp(e) {
    if (!pressing) return;
    pressing = false;
    const end = local(e);
    pts.push(end);
    const H = canvas.getBoundingClientRect().height;
    if (control === "meter") {
      cb.onMeter(null);
      fire(0.6 + meterVal * 0.8, aimAlpha);
      return;
    }
    // Flick: the stroke from its lowest point to the release.
    let start = pts[0];
    for (const p of pts) if (p.y > start.y && end.t - p.t < 450) start = p;
    const up = start.y - end.y;
    const dx = end.x - start.x;
    if (up < H * 0.05) return; // a tap or a downward drag is not a shot
    const alpha = Math.atan2(dx, up);
    const power = up / (H * SWEET_FRAC);
    // Side spin from the curl of the last third of the stroke.
    const mid = pts[Math.max(0, Math.floor(pts.length * 0.66) - 1)];
    const a1 = Math.atan2(mid.x - start.x, start.y - mid.y || 1);
    const a2 = Math.atan2(end.x - mid.x, mid.y - end.y || 1);
    const side = Math.max(-1.5, Math.min(1.5, (a2 - a1) * 2));
    fire(power, alpha, side);
  }
  function onKey(e) {
    // Keyboard: arrows aim, space shoots at perfect power (accessibility).
    if (!world.ball.held) return;
    if (e.key === "ArrowLeft") { aimAlpha -= 0.05; e.preventDefault(); }
    else if (e.key === "ArrowRight") { aimAlpha += 0.05; e.preventDefault(); }
    else if (e.key === " " || e.key === "Enter") { e.preventDefault(); fire(1, aimAlpha); }
  }
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", () => { pressing = false; cb.onMeter(null); });
  canvas.addEventListener("keydown", onKey);

  /* --- loop ------------------------------------------------------------------ */

  let last = performance.now(), acc = 0;
  const previewCache = {};
  const perf = { n: 0, sum: 0, level: 0 };
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!running || !visible) { last = now; return; }
    let dt = Math.min(1 / 20, (now - last) / 1000);
    last = now;
    if (pressing && control === "meter") {
      const t = ((now - meterT0) / 1100) % 2;
      meterVal = t < 1 ? t : 2 - t;
      cb.onMeter(meterVal);
    }
    acc += dt;
    while (acc >= STEP) {
      const prevY = world.ball.p.y;
      step(world, STEP);
      acc -= STEP;
      const b = world.ball;
      if (b.live && !crossing && prevY > RIM_Y && b.p.y <= RIM_Y && b.v.y < 0) {
        const h = world.hoops[target];
        const hx = h.x - world.shot.start.x, hz = h.z - world.shot.start.z;
        const D = Math.hypot(hx, hz);
        const ox = b.p.x - h.x, oz = b.p.z - h.z;
        crossing = { along: (ox * hx + oz * hz) / D, lateral: (-ox * hz + oz * hx) / D };
      }
    }
    // Sound and crowd from physics events.
    for (const ev of world.events) {
      if (ev.type === "rim") audio.rim(ev.strength);
      else if (ev.type === "board") audio.board(ev.strength);
      else if (ev.type === "floor") audio.bounce(ev.strength);
      else if (ev.type === "net" && !swished) { swished = true; audio.swish(); }
    }
    world.events.length = 0;
    const sh = world.shot;
    if (sh && sh.done && !sh.reported) {
      sh.reported = true;
      const made = sh.scored >= 0;
      let kind;
      if (made) kind = !sh.touchedRim && !sh.touchedBoard ? "swish" : sh.touchedBoard && !sh.touchedRim ? "glass" : "rim";
      else if (!crossing) kind = "short";
      else if (Math.abs(crossing.lateral) > Math.abs(crossing.along)) kind = "wide";
      else kind = crossing.along > 0 ? (sh.touchedRim ? "rimout" : "long") : (sh.touchedRim ? "rimout" : "short");
      if (made) { hype = 1; audio.cheer(jumbo.streak + 1); } else if (sh.touchedRim) audio.groan();
      setTimeout(() => cb.onResult({ made, hoop: sh.scored, target, kind, pts: spot.pts, spot: spot.name }), 350);
    }
    hype = Math.max(0.15, hype - dt * 0.35);
    // Camera: a fixed broadcast view behind the shooter; it only glides when the spot changes.
    camGoals();
    const k = 1 - Math.exp(-dt * 2.5);
    cam.pos.lerp(cam.goalPos, k);
    cam.look.lerp(cam.goalLook, k);
    view.camera.position.copy(cam.pos);
    view.camera.lookAt(cam.look);
    // Meter mode: show where the shot is pointing.
    if (pressing && control === "meter") {
      const { index, err } = pickTarget(aimAlpha);
      const h = world.hoops[index];
      const key = `${index}|${spot.x}|${spot.z}|${world.hoops.length}`;
      if (!previewCache[key]) previewCache[key] = idealShot(world, world.ball.p, { x: h.baseX, z: h.z }, 53);
      const ideal = previewCache[key];
      const v = velocityFrom(ideal.speed * (1 + (0.6 + meterVal * 0.8 - 1) * 0.1), ideal.heading + err * 0.15, ideal.angle);
      const p = [];
      const q = { ...world.ball.p };
      for (let i = 0; i < 14; i++) { const t = i * 0.045; p.push({ x: q.x + v.x * t, y: q.y + v.y * t - 4.9 * t * t, z: q.z + v.z * t }); }
      view.setGuide(p);
    }
    if (flashText && now > flashUntil) { flashText = ""; drawJumbo(); }
    view.sync(world, dt, hype);
    const r0 = performance.now();
    view.render();
    // Adaptive quality: if frames stay slow, drop bloom, then shadows.
    perf.n++; perf.sum += dt;
    if (perf.n >= 90) {
      const avg = perf.sum / perf.n;
      if (avg > 1 / 32 && !forced) perf.level = view.degrade(perf.level);
      perf.n = 0; perf.sum = 0;
    }
    void r0;
  }
  raf = requestAnimationFrame(frame);

  function drawJumbo() { view.drawJumbo({ ...jumbo, accent, flash: flashText }); }

  const io = typeof IntersectionObserver !== "undefined"
    ? new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.05 }) : null;
  io?.observe(canvas);
  const onVis = () => { running = !document.hidden; };
  document.addEventListener("visibilitychange", onVis);

  function resize() {
    const r = canvas.parentElement.getBoundingClientRect();
    const w = Math.max(200, Math.floor(r.width)), h = Math.max(240, Math.floor(r.height));
    const dpr = Math.min(window.devicePixelRatio || 1, quality === "high" ? 2 : 1.5);
    view.resize(w, h, dpr);
    camGoals();
  }

  applyMode(mode, SPOTS[0]);
  drawJumbo();

  return {
    world, audio,
    resize,
    setMode(m, nextSpot) { applyMode(m, nextSpot); },
    setSpot(s) { spot = s; resetBall(); },
    next() { resetBall(); },
    setControl(c) { control = c; },
    setDifficulty(d) {
      diff = { ...diff, ...d };
      world.wind.x = diff.wind; world.wind.z = 0;
      world.sway.amp = diff.sway;
    },
    setTrack({ accent: a, title }) {
      accent = a; view.setAccent(a); jumbo.title = title; view.buildHoops(world.hoops, accent); drawJumbo();
    },
    setScore(score, streak) { jumbo.score = score; jumbo.streak = streak; drawJumbo(); },
    flash(text, ms = 1600) { flashText = text; flashUntil = performance.now() + ms; drawJumbo(); },
    get ready() { return world.ball.held; },
    get spot() { return spot; },
    destroy() {
      cancelAnimationFrame(raf);
      io?.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("keydown", onKey);
      view.dispose();
    },
  };
}
