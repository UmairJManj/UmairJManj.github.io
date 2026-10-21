import { createAudio } from "./audio.js";

/* ---------------------------------------------------------------------------
   Darts on a 2D canvas, played like the real thing.

   A sisal board with metal wires hangs in a wooden cabinet under a spotlight.
   Hold to aim (the hand sways), then flick up and let go. The flick is the
   throw: its speed sets the height (too soft drops low, too hard flies high)
   and its sideways lean pulls the dart left or right. Wind pushes it in
   flight. The dart arcs in, sticks at an angle and quivers; one that clips
   a wire can bounce out. Three darts make a visit, then the board clears.
--------------------------------------------------------------------------- */

// Clockwise from the top, and ring radii as fractions of the double's outer edge (170 mm).
const NUMBERS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
const BULL = 6.35 / 170, OUTER_BULL = 15.9 / 170, T_IN = 99 / 170, T_OUT = 107 / 170, D_IN = 162 / 170;
const RINGS = [BULL, OUTER_BULL, T_IN, T_OUT, D_IN, 1];
const DRIFT = 0.05;           // sideways drift per m/s of wind, in board radii (4 m/s is about one segment)
const IDEAL = 2.4;            // ideal flick speed, in stage heights per second
const HEIGHT_ERR = 0.3;       // board radii of height error per 100 percent of flick speed error
const LEAN_ERR = 0.35;        // board radii of sideways error per radian of flick lean
const BOUNCE = 0.3;           // chance a dart that lands on a wire bounces out
const WIRE = 0.006;           // how close to a wire counts as on it, in board radii

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

/** True when (x, y) sits on a ring wire or a segment wire. */
function onWire(x, y) {
  const r = Math.hypot(x, y);
  if (r > 1 + WIRE) return false;
  if (RINGS.some((w) => Math.abs(r - w) < WIRE)) return true;
  if (r < OUTER_BULL) return false;
  const deg = ((Math.atan2(x, -y) * 180) / Math.PI + 369) % 18;   // 0 at a segment wire
  return Math.min(deg, 18 - deg) * (Math.PI / 180) * r < WIRE;
}

/* --- 501: bust rules and checkouts ------------------------------------------- */

/** One dart in a game of 501: the new total, or a bust (score back to the start of the visit). */
export function x01(remaining, hit) {
  const r = remaining - hit.pts;
  const double = hit.ring === "double" || hit.ring === "bull";
  if (r < 0 || r === 1 || (r === 0 && !double)) return { bust: true, remaining };
  return { bust: false, remaining: r, won: r === 0 };
}

// Every throw worth aiming at, biggest first, so checkouts come out the way players call them.
const THROWS = [
  ...NUMBERS.slice().sort((a, b) => b - a).map((n) => ({ name: `T${n}`, pts: n * 3 })),
  { name: "Bull", pts: 50, double: true },
  ...NUMBERS.slice().sort((a, b) => b - a).map((n) => ({ name: `D${n}`, pts: n * 2, double: true })),
  { name: "25", pts: 25 },
  ...NUMBERS.slice().sort((a, b) => b - a).map((n) => ({ name: String(n), pts: n })),
];
const DOUBLES = THROWS.filter((t) => t.double).sort((a, b) => (a.name === "Bull") - (b.name === "Bull") || b.pts - a.pts);

/** The fewest darts that finish `rem` on a double, using at most `darts` darts, or null. */
export function checkout(rem, darts = 3) {
  if (rem > 170 || rem < 2) return null;
  for (let n = 1; n <= darts; n++) {
    const find = (left, k) => {
      if (k === 1) { const d = DOUBLES.find((t) => t.pts === left); return d ? [d.name] : null; }
      for (const t of THROWS) {
        if (t.pts >= left) continue;
        const rest = find(left - t.pts, k - 1);
        if (rest) return [t.name, ...rest];
      }
      return null;
    };
    const path = find(rem, n);
    if (path) return path;
  }
  return null;
}

/* --- drawing --------------------------------------------------------------- */

// Small seeded random, so the board's fibres and the cabinet's grain look the same every resize.
function rng(seed) { return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646; }

function drawCabinet(g, cx, cy, R, W, H) {
  // Wall: dark plaster lit by a spotlight above the board.
  g.fillStyle = "#0b0c10"; g.fillRect(0, 0, W, H);
  const spot = g.createRadialGradient(cx, cy - R * 0.9, R * 0.2, cx, cy, Math.max(W, H) * 0.75);
  spot.addColorStop(0, "rgba(255, 236, 200, 0.22)"); spot.addColorStop(0.45, "rgba(255, 236, 200, 0.07)"); spot.addColorStop(1, "rgba(0, 0, 0, 0)");
  g.fillStyle = spot; g.fillRect(0, 0, W, H);
  // Cabinet back: walnut with grain.
  const s = R * 1.62, x0 = cx - s, y0 = cy - s, w = s * 2;
  g.save();
  g.shadowColor = "rgba(0, 0, 0, 0.6)"; g.shadowBlur = R * 0.2; g.shadowOffsetY = R * 0.06;
  const wood = g.createLinearGradient(x0, 0, x0 + w, 0);
  wood.addColorStop(0, "#3b2414"); wood.addColorStop(0.5, "#5a3820"); wood.addColorStop(1, "#3a2313");
  g.fillStyle = wood; g.beginPath(); g.roundRect(x0, y0, w, w, R * 0.06); g.fill();
  g.restore();
  g.save(); g.beginPath(); g.roundRect(x0, y0, w, w, R * 0.06); g.clip();
  const rnd = rng(7);
  for (let i = 0; i < 70; i++) {
    const x = x0 + rnd() * w;
    g.strokeStyle = `rgba(${rnd() < 0.5 ? "20, 10, 4" : "120, 80, 45"}, ${0.08 + rnd() * 0.12})`;
    g.lineWidth = 0.5 + rnd() * 1.5;
    g.beginPath(); g.moveTo(x, y0);
    g.bezierCurveTo(x + (rnd() - 0.5) * R * 0.2, y0 + w * 0.33, x + (rnd() - 0.5) * R * 0.2, y0 + w * 0.66, x + (rnd() - 0.5) * R * 0.1, y0 + w);
    g.stroke();
  }
  // Inner frame and a soft shadow where the board sits.
  g.strokeStyle = "rgba(0, 0, 0, 0.35)"; g.lineWidth = R * 0.03; g.strokeRect(x0 + R * 0.05, y0 + R * 0.05, w - R * 0.1, w - R * 0.1);
  g.restore();
}

function drawBoard(g, cx, cy, R) {
  const seg = (r0, r1, i, fill) => {
    const a0 = ((i * 18 - 9 - 90) * Math.PI) / 180, a1 = a0 + Math.PI / 10;
    g.beginPath(); g.arc(cx, cy, r1 * R, a0, a1); g.arc(cx, cy, r0 * R, a1, a0, true); g.closePath();
    g.fillStyle = fill; g.fill();
  };
  // The board body and its shadow on the cabinet.
  g.save();
  g.shadowColor = "rgba(0, 0, 0, 0.75)"; g.shadowBlur = R * 0.14; g.shadowOffsetX = R * 0.03; g.shadowOffsetY = R * 0.07;
  g.beginPath(); g.arc(cx, cy, R * 1.3, 0, Math.PI * 2); g.fillStyle = "#151515"; g.fill();
  g.restore();
  for (let i = 0; i < 20; i++) {
    const dark = i % 2 === 0;
    const single = dark ? "#161616" : "#e4d6ad", ring = dark ? "#c8162f" : "#127f3b";
    seg(D_IN, 1, i, ring);
    seg(T_OUT, D_IN, i, single);
    seg(T_IN, T_OUT, i, ring);
    seg(OUTER_BULL, T_IN, i, single);
  }
  g.beginPath(); g.arc(cx, cy, OUTER_BULL * R, 0, Math.PI * 2); g.fillStyle = "#127f3b"; g.fill();
  g.beginPath(); g.arc(cx, cy, BULL * R, 0, Math.PI * 2); g.fillStyle = "#c8162f"; g.fill();
  // Sisal: short fibres in every direction, lighter and darker than the paint.
  g.save(); g.beginPath(); g.arc(cx, cy, R * 1.3, 0, Math.PI * 2); g.clip();
  const rnd = rng(42), n = Math.round(R * R * 0.9);
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * R * 1.3, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    const d = rnd() * Math.PI, l = 0.6 + rnd() * 1.6;
    g.strokeStyle = rnd() < 0.5 ? "rgba(255, 255, 255, 0.07)" : "rgba(0, 0, 0, 0.12)";
    g.lineWidth = 0.5;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(d) * l, y + Math.sin(d) * l); g.stroke();
  }
  // Light from the spotlight above: brighter at the top, falling off below.
  const shade = g.createLinearGradient(cx, cy - R * 1.3, cx, cy + R * 1.3);
  shade.addColorStop(0, "rgba(255, 245, 225, 0.10)"); shade.addColorStop(0.5, "rgba(0, 0, 0, 0)"); shade.addColorStop(1, "rgba(0, 0, 0, 0.28)");
  g.fillStyle = shade; g.fillRect(cx - R * 1.3, cy - R * 1.3, R * 2.6, R * 2.6);
  g.restore();
  // Metal spider: a dark core with a bright edge facing the light.
  const wire = (path) => {
    g.strokeStyle = "rgba(40, 42, 46, 0.9)"; g.lineWidth = Math.max(1, R * 0.011); path(); g.stroke();
    g.strokeStyle = "rgba(235, 238, 242, 0.85)"; g.lineWidth = Math.max(0.5, R * 0.0045); path(0.6); g.stroke();
  };
  for (const r of RINGS.slice(1)) wire((o = 0) => { g.beginPath(); g.arc(cx, cy - o, r * R, 0, Math.PI * 2); });
  for (let i = 0; i < 20; i++) {
    const a = ((i * 18 - 9 - 90) * Math.PI) / 180;
    wire((o = 0) => { g.beginPath(); g.moveTo(cx + Math.cos(a) * OUTER_BULL * R, cy + Math.sin(a) * OUTER_BULL * R - o); g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R - o); });
  }
  wire((o = 0) => { g.beginPath(); g.arc(cx, cy - o, BULL * R, 0, Math.PI * 2); });
  // Number ring: wire numbers on the black surround, and a metal rim.
  g.font = `700 ${Math.round(R * 0.13)}px Calibri, Carlito, system-ui, sans-serif`;
  g.textAlign = "center"; g.textBaseline = "middle";
  NUMBERS.forEach((n, i) => {
    const a = ((i * 18 - 90) * Math.PI) / 180, x = cx + Math.cos(a) * R * 1.15, y = cy + Math.sin(a) * R * 1.15;
    g.fillStyle = "rgba(0, 0, 0, 0.6)"; g.fillText(n, x + 1, y + 1.5);
    const metal = g.createLinearGradient(x, y - R * 0.06, x, y + R * 0.06);
    metal.addColorStop(0, "#f4f5f7"); metal.addColorStop(1, "#9aa1a9");
    g.fillStyle = metal; g.fillText(n, x, y);
  });
  const rim = g.createLinearGradient(cx, cy - R * 1.3, cx, cy + R * 1.3);
  rim.addColorStop(0, "#c9ced4"); rim.addColorStop(1, "#4b5057");
  g.strokeStyle = rim; g.lineWidth = Math.max(1.5, R * 0.018);
  g.beginPath(); g.arc(cx, cy, R * 1.29, 0, Math.PI * 2); g.stroke();
}

/* A dart: tip at (x, y); the body runs back toward the player along `ang` for `len` px.
   `spin` turns the flights; `alpha` fades a falling dart. */
function drawDart(g, x, y, ang, len, s, spin, accent, alpha = 1) {
  const ux = Math.cos(ang), uy = Math.sin(ang), px = -uy, py = ux;
  const at = (k, w = 0) => [x + ux * len * k + px * w, y + uy * len * k + py * w];
  g.save(); g.globalAlpha = alpha; g.lineCap = "round";
  // Steel point.
  g.strokeStyle = "#aeb5bd"; g.lineWidth = 1.3 * s;
  g.beginPath(); g.moveTo(x, y); g.lineTo(...at(0.22)); g.stroke();
  // Tungsten barrel with knurled rings.
  const [bx0, by0] = at(0.22), [bx1, by1] = at(0.55);
  const barrel = g.createLinearGradient(bx0 + px * 3 * s, by0 + py * 3 * s, bx0 - px * 3 * s, by0 - py * 3 * s);
  barrel.addColorStop(0, "#5b6068"); barrel.addColorStop(0.45, "#e3e6ea"); barrel.addColorStop(1, "#3c4046");
  g.strokeStyle = barrel; g.lineWidth = 4.2 * s;
  g.beginPath(); g.moveTo(bx0, by0); g.lineTo(bx1, by1); g.stroke();
  g.strokeStyle = "rgba(20, 22, 26, 0.55)"; g.lineWidth = 0.6 * s;
  for (let k = 0.27; k < 0.53; k += 0.05) { const [a, b] = at(k, 2.1 * s), [c, d] = at(k, -2.1 * s); g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); }
  // Shaft.
  g.strokeStyle = "#1c1d21"; g.lineWidth = 2.2 * s;
  g.beginPath(); g.moveTo(bx1, by1); g.lineTo(...at(0.82)); g.stroke();
  // Flights: four vanes; each shows its width by how square it sits to the view.
  for (let v = 0; v < 4; v++) {
    const w = Math.cos(spin + (v * Math.PI) / 2) * 7 * s;
    if (Math.abs(w) < 0.4) continue;
    const [a, b] = at(0.66), [c, d] = at(0.8, w), [e, f] = at(1, w * 0.95), [h, i] = at(1.02);
    g.fillStyle = accent; g.globalAlpha = alpha * (0.55 + 0.4 * Math.abs(w) / (7 * s));
    g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.lineTo(e, f); g.lineTo(h, i); g.closePath(); g.fill();
  }
  g.restore();
}

/* --- the game ---------------------------------------------------------------- */

export function createGame(canvas, cb = {}) {
  const ctx = canvas.getContext("2d");
  const audio = createAudio();
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let W = 0, H = 0, dpr = 1, R = 0, cx = 0, cy = 0, bg = null;
  // Aim and stuck darts live in board units (radius 1 = outside of the doubles), so a resize keeps them on the board.
  let aim = { x: 0, y: -0.61 }, ready = true, pressing = false, touchLift = 0, hist = [];
  let wind = 0, gusts = [], level = 0, accent = "#3b82f6", raf = 0, visible = true, last = performance.now(), t = 0;
  let fly = null, hint = null;
  const stuck = [], falling = [];
  const toPx = (p) => ({ x: cx + p.x * R, y: cy + p.y * R });
  const toBoard = (p) => ({ x: (p.x - cx) / R, y: (p.y - cy) / R });

  function sway() {
    // A hand never holds still: a slow Lissajous wobble that grows with the level.
    const amp = still ? 0 : R * Math.min(0.15, 0.04 + level * 0.01);
    return { x: amp * (Math.sin(t * 1.7) + 0.5 * Math.sin(t * 3.1 + 1)), y: amp * (Math.cos(t * 1.3) + 0.5 * Math.sin(t * 2.3 + 2)) };
  }

  /** Throw with a flick of `power` (1 is ideal) leaning `lean` radians sideways. */
  function throwDart(power, lean) {
    if (!ready) return;
    audio.unlock();
    const s = sway(), a = toPx(aim), scatter = R * 0.014;
    const p = Math.max(0.3, Math.min(1.8, power));
    const to = {
      x: a.x + s.x + lean * LEAN_ERR * R + (Math.random() - 0.5) * scatter,
      y: a.y + s.y - (p - 1) * HEIGHT_ERR * R + (Math.random() - 0.5) * scatter,
    };
    const short = p < 0.55;   // a limp throw never reaches the board
    if (short) to.y = H * 1.15;
    hint = Math.abs(p - 1) < 0.12 ? null : p < 1 ? (short ? "Too soft: it dropped short" : "A little soft: it landed low") : "A little hard: it flew high";
    ready = false;
    const dur = Math.min(0.75, 0.36 / Math.sqrt(p));
    fly = { from: { x: W * 0.62, y: H * 1.05 }, to, drift: wind * DRIFT * R, t: 0, dur, arc: H * 0.07 / p, short };
  }

  function land() {
    const f = fly;
    fly = null;
    if (f.short) {
      audio.bounce(2);
      return report({ pts: 0, ring: "miss", label: "Dropped short" });
    }
    const b = toBoard({ x: f.to.x + f.drift, y: f.to.y });
    if (Math.hypot(b.x, b.y) <= 1.3 && onWire(b.x, b.y) && Math.random() < BOUNCE) {
      audio.rim(3);
      falling.push({ ...toPx(b), vx: (Math.random() - 0.5) * 60, vy: -80, ang: 1.2, va: 6 + Math.random() * 6, life: 1.2 });
      return report({ pts: 0, ring: "miss", label: "Bounce out" });
    }
    const hit = scoreAt(b.x, b.y);
    if (Math.hypot(b.x, b.y) > 1.3) {
      // Off the board entirely: into the cabinet, or onto the floor if it missed that too.
      if (Math.abs(b.x) > 1.62 || Math.abs(b.y) > 1.62) { audio.bounce(1.5); falling.push({ ...toPx(b), vx: 0, vy: 0, ang: 1.4, va: 3, life: 1.2 }); return report(hit); }
    }
    // Sticks, tail tilted the way it was travelling, and quivers.
    stuck.push({ ...b, ang: 1.05 + (Math.random() - 0.5) * 0.35 + (b.x * 0.1), wob: 1, born: t });
    audio.board(4);
    report(hit);
  }
  function report(hit) { setTimeout(() => cb.onResult?.({ ...hit, hint }), 350); }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!visible || !bg) return;
    t += dt;
    if (fly && (fly.t += dt / fly.dur) >= 1) land();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(bg, 0, 0, W, H);
    const s = R / 150;

    // Wind streaks drift across at the wind's speed.
    if (wind) {
      while (gusts.length < 18) gusts.push({ x: Math.random() * W, y: Math.random() * H, len: 20 + Math.random() * 40 });
      ctx.strokeStyle = "rgba(255, 255, 255, 0.1)"; ctx.lineWidth = 1;
      ctx.beginPath();
      for (const g of gusts) {
        g.x += wind * dt * W * 0.09;
        if (g.x > W + 60) g.x = -60; else if (g.x < -60) g.x = W + 60;
        ctx.moveTo(g.x, g.y); ctx.lineTo(g.x - Math.sign(wind) * g.len, g.y);
      }
      ctx.stroke();
    }
    ctx.font = `600 ${Math.max(11, Math.round(R * 0.075))}px Calibri, Carlito, system-ui, sans-serif`;
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillStyle = wind ? "#fde68a" : "rgba(229, 231, 235, 0.7)";
    ctx.fillText(wind ? `WIND ${wind < 0 ? "←" : "→"} ${Math.abs(wind).toFixed(1)} m/s` : "NO WIND", 12, 12);

    // Darts in the board, each quivering for a moment after it lands.
    for (const d of stuck) {
      const q = toPx(d), age = t - d.born;
      const wob = still ? 0 : 0.12 * Math.exp(-age * 7) * Math.sin(age * 55);
      ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
      ctx.beginPath(); ctx.ellipse(q.x + 9 * s, q.y + 14 * s, 3.5 * s, 9 * s, -0.5, 0, Math.PI * 2); ctx.fill();
      drawDart(ctx, q.x, q.y, d.ang + wob, 46 * s, s, 0.7, accent);
    }
    // Bounce outs and wild throws fall to the floor.
    for (const f of falling) {
      f.vy += 900 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.ang += f.va * dt; f.life -= dt;
      drawDart(ctx, f.x, f.y, f.ang, 46 * s, s, t * 9, accent, Math.max(0, Math.min(1, f.life * 2)));
    }
    for (let i = falling.length - 1; i >= 0; i--) if (falling[i].life <= 0 || falling[i].y > H + 80) falling.splice(i, 1);

    // The dart in flight: big and close at the hand, shrinking as it arcs in, flights spinning.
    if (fly) {
      const k = fly.t, e = 1 - (1 - k) ** 1.6;
      const x = fly.from.x + (fly.to.x - fly.from.x) * e + fly.drift * k * k;
      const y = fly.from.y + (fly.to.y - fly.from.y) * e - Math.sin(Math.PI * k) * fly.arc;
      const scale = 1 + (1 - k) * 2.4;
      const ang = Math.PI / 2 + (fly.from.x - fly.to.x) / W * 0.6 - (0.5 - k) * 0.5;   // tail back toward the hand
      drawDart(ctx, x, y, ang, 46 * s * scale * (0.55 + 0.45 * k), s * scale, k * 30, accent);
    } else if (ready) {
      const sw = sway(), a = toPx(aim), x = a.x + sw.x, y = a.y + sw.y, r = R * 0.06;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.9)"; ctx.lineWidth = 1.3; ctx.shadowColor = "rgba(0, 0, 0, 0.8)"; ctx.shadowBlur = 4;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.moveTo(x - r * 1.6, y); ctx.lineTo(x - r * 0.45, y); ctx.moveTo(x + r * 0.45, y); ctx.lineTo(x + r * 1.6, y);
      ctx.moveTo(x, y - r * 1.6); ctx.lineTo(x, y - r * 0.45); ctx.moveTo(x, y + r * 0.45); ctx.lineTo(x, y + r * 1.6);
      ctx.stroke(); ctx.shadowBlur = 0;
      // The next dart, held at the bottom of the view.
      if (!pressing) drawDart(ctx, W * 0.8, H * 0.8, Math.PI / 2 + 0.25, 46 * s * 1.9, s * 2, 0.5 + t * 0.4, accent);
    }
  }

  function resize() {
    const r = canvas.parentElement.getBoundingClientRect();
    W = Math.max(200, Math.floor(r.width)); H = Math.max(240, Math.floor(r.height));
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr; canvas.height = H * dpr;
    R = Math.min(W, H) * 0.3; cx = W / 2; cy = H * 0.45;
    // The wall, cabinet and board never change between throws, so they are drawn once per size.
    bg = document.createElement("canvas");
    bg.width = W * dpr; bg.height = H * dpr;
    const g = bg.getContext("2d");
    g.scale(dpr, dpr);
    drawCabinet(g, cx, cy, R, W, H);
    drawBoard(g, cx, cy, R);
  }

  /* --- input: hold to aim, flick up to throw ---------------------------------- */
  const local = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() }; };
  const setAim = (p) => { aim = toBoard({ x: p.x, y: p.y - touchLift }); };
  const speedUp = (from, to) => (from.y - to.y) / Math.max(10, to.t - from.t) * 1000;   // px per second, upward positive
  function onDown(e) {
    if (!ready) return;
    canvas.setPointerCapture?.(e.pointerId);
    pressing = true;
    touchLift = e.pointerType === "touch" ? R * 0.35 : 0;   // keep the crosshair above the finger
    const p = local(e);
    hist = [p];
    setAim(p);
  }
  function onMove(e) {
    const p = local(e);
    if (!pressing) { if (e.pointerType === "mouse") { touchLift = 0; setAim(p); } return; }
    const prev = hist[hist.length - 1];
    hist.push(p);
    while (hist.length > 2 && p.t - hist[0].t > 400) hist.shift();
    // Moving sideways or down aims; once the hand moves up into the flick, the aim holds.
    if (p.y >= prev.y - 0.5) setAim(p);
  }
  function onUp(e) {
    if (!pressing) return;
    pressing = false;
    const end = local(e);
    hist.push(end);
    // The flick is the last unbroken upward stroke. It aims from where it began;
    // its speed over the final 120 ms (or all of it, if shorter) is the power.
    let i = hist.length - 1;
    while (i > 0 && hist[i - 1].y > hist[i].y - 0.5) i--;
    const start = hist[i];
    if (start.y - end.y < H * 0.04) { cb.onHint?.("Flick up and let go to throw"); return; }   // a click or a drag down is not a throw
    setAim(start);
    const from = hist.slice(i).find((h) => end.t - h.t <= 120) || start;
    const vy = speedUp(from, end), vx = (end.x - from.x) / Math.max(10, end.t - from.t) * 1000;
    throwDart(vy / (H * IDEAL), Math.atan2(vx, Math.max(1, vy)));
  }
  function onKey(e) {
    const step = 0.04;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (d) { e.preventDefault(); aim = { x: aim.x + d[0], y: aim.y + d[1] }; }
    else if (e.key === " " || e.key === "Enter") { e.preventDefault(); throwDart(1, 0); }   // keyboard throws are always clean
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
    clearBoard() { stuck.length = 0; },   // collect the darts after a visit
    setLevel(n) { level = n; },
    setWind(v) { wind = v; gusts = []; },
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
  console.assert(onWire(0, -T_IN) && onWire(0, -1) && !onWire(0, -0.3), "ring wires");
  console.assert(onWire(Math.sin(Math.PI / 20) * 0.5, -Math.cos(Math.PI / 20) * 0.5), "segment wire between 20 and 1");
  // 501 rules.
  const D20 = { pts: 40, ring: "double" }, T20 = { pts: 60, ring: "treble" }, S20 = { pts: 20, ring: "single" };
  console.assert(x01(40, D20).won, "double out wins");
  console.assert(x01(20, S20).bust, "finishing on a single busts");
  console.assert(x01(41, D20).bust, "leaving 1 busts");
  console.assert(x01(50, T20).bust, "going below zero busts");
  console.assert(x01(50, { pts: 50, ring: "bull" }).won, "bull is a double out");
  console.assert(x01(501, T20).remaining === 441);
  // Checkouts players would call.
  console.assert(checkout(170).join(" ") === "T20 T20 Bull", checkout(170));
  console.assert(checkout(40).join(" ") === "D20", checkout(40));
  console.assert(checkout(100, 2).join(" ") === "T20 D20", checkout(100, 2));
  console.assert(checkout(169) === null && checkout(171) === null, "169 and 171 have no checkout");
  console.assert(checkout(3).join(" ") === "1 D1", checkout(3));
  console.log("darts ok: scoring, wires, 501 rules, checkouts");
}
