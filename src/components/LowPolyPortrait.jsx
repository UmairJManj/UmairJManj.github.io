import { useEffect, useRef } from "react";
import { delaunay } from "../lib/delaunay.js";

/* ---------------------------------------------------------------------------
   The portrait as low poly triangles.

   Points are scattered over the photo, denser where it has edges (eyes, jaw,
   hair line), and Delaunay triangulated; each triangle takes the photo's
   colour under it. The triangles fly in and assemble on load. Moving the
   mouse over it sends a ripple out from the pointer that knocks triangles
   loose, and springs pull every one back into the picture.
--------------------------------------------------------------------------- */

const EDGE_POINTS = 1500, FILL_POINTS = 220, MIN_GAP = 2.6;
const FACE_POINTS = 650, FACE = { x0: 0.35, x1: 0.65, y0: 0.04, y1: 0.40 };
const SPRING = 60, DAMP = 9;            // per second; under damped, so pieces wobble home
const WAVE_SPEED = 420, WAVE_KICK = 26; // px per second, px per second of push

function buildMesh(img, W, H) {
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d", { willReadFrequently: true });
  // The photo is a halftone; blur the dots into tones so edges and colours come from the face, not the screen.
  g.filter = `blur(${Math.max(1.2, W / 200)}px)`;
  g.drawImage(img, 0, 0, W, H);
  g.filter = "none";
  const px = g.getImageData(0, 0, W, H).data;
  const at = (x, y) => { x = Math.max(0, Math.min(W - 1, x | 0)); y = Math.max(0, Math.min(H - 1, y | 0)); return ((y * W) + x) * 4; };
  const lum = (x, y) => { const i = at(x, y); return (px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11) * px[i + 3] / 255; };

  // Gradient magnitude, so points cluster on the features that make the face.
  const grad = new Float32Array(W * H);
  let gMax = 1;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const gx = lum(x + 1, y) - lum(x - 1, y), gy = lum(x, y + 1) - lum(x, y - 1);
    const m = Math.hypot(gx, gy);
    grad[y * W + x] = m; if (m > gMax) gMax = m;
  }

  const pts = [[0, 0], [W, 0], [0, H], [W, H], [W / 2, 0], [W / 2, H], [0, H / 2], [W, H / 2]];
  const cell = MIN_GAP, gw = Math.ceil(W / cell) + 1;
  const taken = new Set();
  const free = (x, y) => {
    const cx = (x / cell) | 0, cy = (y / cell) | 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (taken.has((cy + j) * gw + cx + i)) return false;
    taken.add(cy * gw + cx); return true;
  };
  // The face gets its own budget first, so glasses, eyes and smile keep their shape.
  // ponytail: face box is fixed to portrait.png; re-measure it if the photo changes.
  for (let tries = 0, got = 0; got < FACE_POINTS && tries < FACE_POINTS * 40; tries++) {
    const x = (FACE.x0 + Math.random() * (FACE.x1 - FACE.x0)) * W, y = (FACE.y0 + Math.random() * (FACE.y1 - FACE.y0)) * H;
    if (Math.random() < 0.15 + Math.sqrt(grad[(y | 0) * W + (x | 0)] / gMax) && free(x, y)) { pts.push([x, y]); got++; }
  }
  for (let tries = 0, got = 0; got < EDGE_POINTS && tries < EDGE_POINTS * 40; tries++) {
    const x = Math.random() * W, y = Math.random() * H;
    if (Math.random() < Math.sqrt(grad[(y | 0) * W + (x | 0)] / gMax) && free(x, y)) { pts.push([x, y]); got++; }
  }
  for (let tries = 0, got = 0; got < FILL_POINTS && tries < FILL_POINTS * 20; tries++) {
    const x = Math.random() * W, y = Math.random() * H;
    if (px[at(x, y) + 3] > 0 && free(x, y)) { pts.push([x, y]); got++; }
  }

  const tris = [];
  for (const [a, b, c2] of delaunay(pts)) {
    const A = pts[a], B = pts[b], C = pts[c2];
    const cx = (A[0] + B[0] + C[0]) / 3, cy = (A[1] + B[1] + C[1]) / 3;
    // Colour: the average of the centroid and the points halfway to each corner.
    let r = 0, gg = 0, bb = 0, al = 0;
    for (const [sx, sy] of [[cx, cy], [(cx + A[0]) / 2, (cy + A[1]) / 2], [(cx + B[0]) / 2, (cy + B[1]) / 2], [(cx + C[0]) / 2, (cy + C[1]) / 2]]) {
      const i = at(sx, sy); r += px[i]; gg += px[i + 1]; bb += px[i + 2]; al += px[i + 3];
    }
    if (al / 4 < 110) continue;   // background: the photo is a cut out
    tris.push({
      v: [A[0] - cx, A[1] - cy, B[0] - cx, B[1] - cy, C[0] - cx, C[1] - cy], cx, cy,
      fill: `rgb(${(r / 4) | 0},${(gg / 4) | 0},${(bb / 4) | 0})`,
      ox: 0, oy: 0, rot: 0, vx: 0, vy: 0, vr: 0,
    });
  }
  return tris;
}

export default function LowPolyPortrait({ src, alt, ratio = 819 / 717 }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let tris = [], W = 0, H = 0, raf = 0, last = 0, waves = [], alive = true, lastWave = 0;
    const img = new Image();

    function draw() {
      ctx.clearRect(0, 0, W, H);
      for (const t of tris) {
        const c = Math.cos(t.rot), s = Math.sin(t.rot), x = t.cx + t.ox, y = t.cy + t.oy, v = t.v;
        ctx.beginPath();
        ctx.moveTo(x + v[0] * c - v[1] * s, y + v[0] * s + v[1] * c);
        ctx.lineTo(x + v[2] * c - v[3] * s, y + v[2] * s + v[3] * c);
        ctx.lineTo(x + v[4] * c - v[5] * s, y + v[4] * s + v[5] * c);
        ctx.closePath();
        ctx.fillStyle = t.fill; ctx.strokeStyle = t.fill;
        ctx.fill(); ctx.stroke();   // the hairline stroke hides seams between neighbours
      }
    }

    function tick(now) {
      const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
      last = now;
      for (const w of waves) {
        const r0 = w.r, r1 = (w.r += WAVE_SPEED * dt), k = WAVE_KICK * w.power * Math.max(0, 1 - r1 / w.max);
        for (const t of tris) {
          const dx = t.cx - w.x, dy = t.cy - w.y, d = Math.hypot(dx, dy) || 1;
          if (d >= r0 && d < r1) {
            t.vx += (dx / d) * k * 8; t.vy += (dy / d) * k * 8 - k * 2;
            t.vr += (Math.random() - 0.5) * k * 0.35;
          }
        }
      }
      waves = waves.filter((w) => w.r < w.max);
      let energy = 0;
      const damp = Math.exp(-DAMP * dt);
      for (const t of tris) {
        t.vx = (t.vx - t.ox * SPRING * dt) * damp; t.vy = (t.vy - t.oy * SPRING * dt) * damp; t.vr = (t.vr - t.rot * SPRING * dt) * damp;
        t.ox += t.vx * dt; t.oy += t.vy * dt; t.rot += t.vr * dt;
        energy += Math.abs(t.ox) + Math.abs(t.oy) + Math.abs(t.vx) * 0.05 + Math.abs(t.vy) * 0.05;
      }
      draw();
      // Sleep once everything is home; the next ripple wakes it.
      if (energy / Math.max(1, tris.length) < 0.01 && !waves.length) {
        for (const t of tris) { t.ox = t.oy = t.rot = t.vx = t.vy = t.vr = 0; }
        draw(); raf = 0; return;
      }
      raf = requestAnimationFrame(tick);
    }
    const wake = () => { if (!raf && !still) { last = performance.now(); raf = requestAnimationFrame(tick); } };

    function layout(scatter) {
      const w = canvas.parentElement.clientWidth;
      if (!w || !img.naturalWidth) return;
      W = Math.round(Math.min(w, 320)); H = Math.round(W * ratio);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineJoin = "round"; ctx.lineWidth = 0.6;
      tris = buildMesh(img, W, H);
      if (scatter && !still) {
        // Fly in from all round and assemble.
        for (const t of tris) {
          const a = Math.random() * Math.PI * 2, d = 80 + Math.random() * 220;
          t.ox = Math.cos(a) * d; t.oy = Math.sin(a) * d; t.rot = (Math.random() - 0.5) * 6;
        }
      }
      draw(); wake();
    }

    const pos = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const onMove = (e) => {
      if (still) return;
      const now = performance.now();
      if (now - lastWave < 140) return;   // a new ring every 140 ms while the pointer moves
      lastWave = now;
      const p = pos(e);
      waves.push({ ...p, r: 0, max: Math.hypot(W, H) * 0.55, power: e.type === "pointerenter" ? 1.4 : 0.55 });
      wake();
    };
    canvas.addEventListener("pointerenter", onMove);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerdown", onMove);

    let ro;
    img.onload = () => {
      if (!alive) return;
      layout(true);
      let lastW = canvas.parentElement.clientWidth;
      ro = new ResizeObserver(() => { const w = canvas.parentElement.clientWidth; if (Math.abs(w - lastW) > 4) { lastW = w; layout(false); } });
      ro.observe(canvas.parentElement);
    };
    img.src = src;

    return () => {
      alive = false; cancelAnimationFrame(raf); ro?.disconnect();
      canvas.removeEventListener("pointerenter", onMove);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onMove);
    };
  }, [src, ratio]);

  return <canvas ref={ref} className="lowpoly" role="img" aria-label={alt} />;
}
