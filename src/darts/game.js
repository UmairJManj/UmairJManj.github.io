import { createAudio } from "./audio.js";

/* ---------------------------------------------------------------------------
   Darts on a 2D canvas.

   A regulation board hangs on a dark wall. The aim reticle follows the
   pointer (or the arrow keys) and sways like a real hand, so the skill is
   releasing as the sway passes over the target. Release throws; the dart
   flies in, sticks, and the hit is scored the way a real board scores it.
--------------------------------------------------------------------------- */

// Clockwise from the top, and ring radii as fractions of the double's outer edge (170 mm).
const NUMBERS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
const BULL = 6.35 / 170, OUTER_BULL = 15.9 / 170, T_IN = 99 / 170, T_OUT = 107 / 170, D_IN = 162 / 170;
const FLIGHT = 0.32;          // seconds from hand to board
const KEEP = 3;               // darts left in the board

/** Score a hit at (x, y) in board units: radius 1 is the outside of the double ring, y points down. */
export function scoreAt(x, y) {
  const r = Math.hypot(x, y);
  if (r <= BULL) return { pts: 50, ring: "bull", label: "Bullseye" };
  if (r <= OUTER_BULL) return { pts: 25, ring: "outer", label: "Outer bull" };
  if (r > 1) return { pts: 0, ring: "miss", label: "Off the board" };
  const deg = ((Math.atan2(x, -y) * 180) / Math.PI + 369) % 360;
  const n = NUMBERS[Math.floor(deg / 18)];
  if (r >= D_IN) return { pts: n * 2, ring: "double", label: `Double ${n}` };
  if (r >= T_IN && r <= T_OUT) return { pts: n * 3, ring: "treble", label: `Treble ${n}` };
  return { pts: n, ring: "single", label: String(n) };
}

function drawBoard(g, cx, cy, R) {
  const seg = (r0, r1, i, fill) => {
    const a0 = ((i * 18 - 9 - 90) * Math.PI) / 180, a1 = a0 + Math.PI / 10;
    g.beginPath(); g.arc(cx, cy, r1 * R, a0, a1); g.arc(cx, cy, r0 * R, a1, a0, true); g.closePath();
    g.fillStyle = fill; g.fill();
  };
  // Surround with the numbers.
  g.beginPath(); g.arc(cx, cy, R * 1.28, 0, Math.PI * 2); g.fillStyle = "#141416"; g.fill();
  g.fillStyle = "#e8e2d0"; g.font = `700 ${Math.round(R * 0.13)}px Calibri, Carlito, system-ui, sans-serif`;
  g.textAlign = "center"; g.textBaseline = "middle";
  NUMBERS.forEach((n, i) => {
    const a = ((i * 18 - 90) * Math.PI) / 180;
    g.fillText(n, cx + Math.cos(a) * R * 1.14, cy + Math.sin(a) * R * 1.14);
  });
  for (let i = 0; i < 20; i++) {
    const dark = i % 2 === 0;
    const single = dark ? "#1d1d1f" : "#eadfbf", ring = dark ? "#c8102e" : "#0b7a3c";
    seg(D_IN, 1, i, ring);
    seg(T_OUT, D_IN, i, single);
    seg(T_IN, T_OUT, i, ring);
    seg(OUTER_BULL, T_IN, i, single);
  }
  g.beginPath(); g.arc(cx, cy, OUTER_BULL * R, 0, Math.PI * 2); g.fillStyle = "#0b7a3c"; g.fill();
  g.beginPath(); g.arc(cx, cy, BULL * R, 0, Math.PI * 2); g.fillStyle = "#c8102e"; g.fill();
  // Wires.
  g.strokeStyle = "rgba(210, 214, 220, 0.55)"; g.lineWidth = Math.max(0.6, R * 0.006);
  for (const r of [OUTER_BULL, T_IN, T_OUT, D_IN, 1]) { g.beginPath(); g.arc(cx, cy, r * R, 0, Math.PI * 2); g.stroke(); }
  for (let i = 0; i < 20; i++) {
    const a = ((i * 18 - 9 - 90) * Math.PI) / 180;
    g.beginPath(); g.moveTo(cx + Math.cos(a) * OUTER_BULL * R, cy + Math.sin(a) * OUTER_BULL * R);
    g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); g.stroke();
  }
}

// A dart seen from the oche: the tip in the board, barrel and flights angled back toward the player.
function drawDart(g, x, y, s, accent, flying) {
  const bx = x + 10 * s, by = y + 26 * s;           // the back of the barrel
  if (!flying) {
    g.fillStyle = "rgba(0, 0, 0, 0.35)";
    g.beginPath(); g.ellipse(x + 14 * s, y + 6 * s, 10 * s, 3 * s, 0.3, 0, Math.PI * 2); g.fill();
  }
  g.lineCap = "round";
  g.strokeStyle = "#9aa3ad"; g.lineWidth = 1.6 * s;
  g.beginPath(); g.moveTo(x, y); g.lineTo(x + 3 * s, y + 8 * s); g.stroke();          // steel point
  g.strokeStyle = "#cfd5db"; g.lineWidth = 4 * s;
  g.beginPath(); g.moveTo(x + 3 * s, y + 8 * s); g.lineTo(bx, by); g.stroke();          // barrel
  g.fillStyle = accent; g.globalAlpha = 0.92;
  for (const [dx, dy] of [[-9, 4], [9, 4], [0, 10]]) {                                   // flights
    g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + dx * s, by + (dy + 6) * s); g.lineTo(bx + dx * 0.4 * s, by + (dy + 13) * s); g.closePath(); g.fill();
  }
  g.globalAlpha = 1;
}

export function createGame(canvas, cb = {}) {
  const ctx = canvas.getContext("2d");
  const audio = createAudio();
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let W = 0, H = 0, dpr = 1, R = 0, cx = 0, cy = 0, bg = null;
  let aim = { x: 0, y: 0 }, aimSet = false, ready = true, pressing = false, touchLift = 0;
  let level = 0, accent = "#3b82f6", fly = null, raf = 0, visible = true, last = performance.now(), t = 0;
  const stuck = [];

  function sway() {
    // A hand never holds still: a slow Lissajous wobble that grows with the level.
    const amp = still ? 0 : R * Math.min(0.16, 0.05 + level * 0.012);
    return { x: amp * (Math.sin(t * 1.7) + 0.5 * Math.sin(t * 3.1 + 1)), y: amp * (Math.cos(t * 1.3) + 0.5 * Math.sin(t * 2.3 + 2)) };
  }

  function throwDart() {
    if (!ready) return;
    audio.unlock();
    const s = sway();
    const scatter = R * 0.012;
    const to = { x: aim.x + s.x + (Math.random() - 0.5) * scatter, y: aim.y + s.y + (Math.random() - 0.5) * scatter };
    ready = false;
    fly = { from: { x: W / 2 + W * 0.12, y: H * 1.08 }, to, t: 0 };
  }

  function land() {
    const { to } = fly;
    fly = null;
    const hit = scoreAt((to.x - cx) / R, (to.y - cy) / R);
    stuck.push(to);
    if (stuck.length > KEEP) stuck.shift();
    audio.board(hit.ring === "miss" ? 1.5 : 4);
    if (hit.ring === "bull" || hit.ring === "treble") audio.cheer(2);
    setTimeout(() => cb.onResult?.(hit), 350);
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!visible || !bg) return;
    t += dt;
    if (fly && (fly.t += dt / FLIGHT) >= 1) land();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(bg, 0, 0, W, H);
    for (const p of stuck) drawDart(ctx, p.x, p.y, R / 150, accent, false);
    if (fly) {
      const k = fly.t, e = 1 - (1 - k) ** 2;
      const x = fly.from.x + (fly.to.x - fly.from.x) * e;
      const y = fly.from.y + (fly.to.y - fly.from.y) * e - Math.sin(Math.PI * k) * H * 0.06;
      drawDart(ctx, x, y, (R / 150) * (1 + (1 - k) * 2.2), accent, true);
    } else if (ready) {
      const s = sway(), x = aim.x + s.x, y = aim.y + s.y, r = R * 0.07;
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.shadowColor = accent; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.moveTo(x - r * 1.5, y); ctx.lineTo(x - r * 0.5, y); ctx.moveTo(x + r * 0.5, y); ctx.lineTo(x + r * 1.5, y);
      ctx.moveTo(x, y - r * 1.5); ctx.lineTo(x, y - r * 0.5); ctx.moveTo(x, y + r * 0.5); ctx.lineTo(x, y + r * 1.5);
      ctx.stroke(); ctx.shadowBlur = 0;
    }
  }

  function resize() {
    const r = canvas.parentElement.getBoundingClientRect();
    W = Math.max(200, Math.floor(r.width)); H = Math.max(240, Math.floor(r.height));
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr; canvas.height = H * dpr;
    R = Math.min(W, H) * 0.33; cx = W / 2; cy = H * 0.44;
    if (!aimSet) aim = { x: cx, y: cy };
    // The wall and the board never change between throws, so they are drawn once per size.
    bg = document.createElement("canvas");
    bg.width = W * dpr; bg.height = H * dpr;
    const g = bg.getContext("2d");
    g.scale(dpr, dpr);
    const wall = g.createRadialGradient(cx, cy, R * 0.5, cx, cy, Math.max(W, H) * 0.8);
    wall.addColorStop(0, "#2a2f3a"); wall.addColorStop(1, "#07080c");
    g.fillStyle = wall; g.fillRect(0, 0, W, H);
    g.shadowColor = "rgba(0, 0, 0, 0.7)"; g.shadowBlur = R * 0.18; g.shadowOffsetY = R * 0.05;
    g.beginPath(); g.arc(cx, cy, R * 1.28, 0, Math.PI * 2); g.fillStyle = "#141416"; g.fill();
    g.shadowColor = "transparent";
    drawBoard(g, cx, cy, R);
  }

  /* --- input: aim follows the pointer, release throws ----------------------- */
  const local = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const setAim = (p) => { aim = { x: p.x, y: p.y - touchLift }; aimSet = true; };
  function onDown(e) {
    if (!ready) return;
    canvas.setPointerCapture?.(e.pointerId);
    pressing = true;
    touchLift = e.pointerType === "touch" ? R * 0.35 : 0;   // keep the reticle above the finger
    setAim(local(e));
  }
  function onMove(e) { if (pressing || e.pointerType === "mouse") { if (!pressing) touchLift = 0; setAim(local(e)); } }
  function onUp() { if (!pressing) return; pressing = false; throwDart(); }
  function onKey(e) {
    const step = R * 0.04;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (d) { e.preventDefault(); aim = { x: aim.x + d[0], y: aim.y + d[1] }; aimSet = true; }
    else if (e.key === " " || e.key === "Enter") { e.preventDefault(); throwDart(); }
  }
  const onCancel = () => { pressing = false; };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onCancel);
  canvas.addEventListener("keydown", onKey);

  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.05 });
  io.observe(canvas);
  raf = requestAnimationFrame(frame);

  return {
    audio, resize,
    next() { ready = true; },
    setLevel(n) { level = n; },
    setAccent(a) { accent = a; },
    destroy() {
      cancelAnimationFrame(raf); io.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onCancel);
      canvas.removeEventListener("keydown", onKey);
    },
  };
}

if (typeof process !== "undefined" && process.argv?.[1]?.endsWith("game.js")) {
  const s = (x, y) => scoreAt(x, y).label;
  console.assert(s(0, 0) === "Bullseye", s(0, 0));
  console.assert(s(0.05, 0.05) === "Outer bull", s(0.05, 0.05));
  console.assert(s(0, -0.61) === "Treble 20", s(0, -0.61));
  console.assert(s(0.61, 0) === "Treble 6", s(0.61, 0));
  console.assert(s(0, 0.98) === "Double 3", s(0, 0.98));
  console.assert(s(-0.98, 0) === "Double 11", s(-0.98, 0));
  console.assert(s(0, -0.3) === "20", s(0, -0.3));
  console.assert(s(0, -1.1) === "Off the board", s(0, -1.1));
  console.log("darts scoring ok");
}
