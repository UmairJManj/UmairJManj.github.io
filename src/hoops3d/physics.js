/* ---------------------------------------------------------------------------
   Hoops physics. Pure math, no rendering. Units are SI: metres, seconds,
   kilograms. y is up; the shooter faces -z, hoops sit near z = 0.

   Ball: FIBA size 7 (r = 0.12 m, m = 0.62 kg), treated as a thin-walled
   sphere (I = 2/3 m r^2). Forces: gravity, quadratic air drag, Magnus lift
   from spin (F = 1/2 rho A r (w x v)), and wind. Contacts use impulses with
   restitution and Coulomb friction, so backspin really kills a rim bounce
   and a bank shot really grips the glass.

   Rim: a steel torus on a spring (it dips when hit and wobbles back).
   Backboard: a glass slab on a spring (it shakes on hard bank shots).
   Net: a verlet cloth of knots hanging from the rim that the ball pushes
   through, and that pulls a little energy out of the ball when it does.
--------------------------------------------------------------------------- */

export const G = 9.81;
export const BALL_R = 0.12;
export const BALL_M = 0.62;
const BALL_I = (2 / 3) * BALL_M * BALL_R * BALL_R;
const RHO = 1.2;
const AREA = Math.PI * BALL_R * BALL_R;
const CD = 0.47;
const DRAG_K = (0.5 * RHO * CD * AREA) / BALL_M;      // a = -k |v| v
const MAGNUS_K = (0.5 * RHO * AREA * BALL_R) / BALL_M; // a = k (w x v)
const SPIN_DECAY = 0.12;                                // 1/s, air torque

export const RIM_Y = 3.05;
export const RIM_R = 0.2286 + 0.008;  // centre of the steel tube
const RIM_TUBE = 0.009;
export const BOARD_GAP = 0.38;          // rim centre to board face, metres
const BOARD_T = 0.03;

const E_RIM = 0.62, MU_RIM = 0.35;
const E_BOARD = 0.68, MU_BOARD = 0.4;
const E_FLOOR = 0.78, MU_FLOOR = 0.55;

const NET_RINGS = 5;     // rings of knots below the rim
const NET_COLS = 12;
const NET_LEN = 0.42;
const NET_BOTTOM_R = 0.15;

/* --- tiny vector helpers on {x,y,z} -------------------------------------- */
const v3 = (x = 0, y = 0, z = 0) => ({ x, y, z });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
const len = (a) => Math.hypot(a.x, a.y, a.z);
const addS = (a, b, s) => { a.x += b.x * s; a.y += b.y * s; a.z += b.z * s; };

/* --- hoops ----------------------------------------------------------------- */

export function makeHoop({ x = 0, z = 0, boardW = 1.8, label = null } = {}) {
  const h = {
    baseX: x, x, z, boardW, label,
    rimDy: 0, rimVy: 0,          // rim spring (vertical dip)
    boardDz: 0, boardVz: 0,      // board spring (shake)
    knots: [], prev: [], links: [],
  };
  // Net knots: ring 0 is pinned to the rim.
  for (let i = 0; i <= NET_RINGS; i++) {
    const t = i / NET_RINGS;
    const r = RIM_R + (NET_BOTTOM_R - RIM_R) * t;
    for (let j = 0; j < NET_COLS; j++) {
      // Alternate rings are rotated half a column, which gives the diamond mesh.
      const a = ((j + (i % 2) * 0.5) / NET_COLS) * Math.PI * 2;
      const k = v3(x + Math.cos(a) * r, RIM_Y - NET_LEN * t, z + Math.sin(a) * r);
      h.knots.push(k);
      h.prev.push({ ...k });
    }
  }
  const id = (i, j) => i * NET_COLS + ((j + NET_COLS) % NET_COLS);
  for (let i = 0; i < NET_RINGS; i++) {
    for (let j = 0; j < NET_COLS; j++) {
      const a = id(i, j);
      // Diamond: each knot ties to two knots on the next ring.
      const b1 = i % 2 === 0 ? id(i + 1, j - 1) : id(i + 1, j);
      const b2 = i % 2 === 0 ? id(i + 1, j) : id(i + 1, j + 1);
      for (const b of [b1, b2]) {
        h.links.push([a, b, Math.hypot(
          h.knots[a].x - h.knots[b].x, h.knots[a].y - h.knots[b].y, h.knots[a].z - h.knots[b].z)]);
      }
    }
  }
  return h;
}
export const NET = { RINGS: NET_RINGS, COLS: NET_COLS };

function rimPinned(h, j) {
  const a = (j / NET_COLS) * Math.PI * 2;
  return v3(h.x + Math.cos(a) * RIM_R, RIM_Y + h.rimDy, h.z + Math.sin(a) * RIM_R);
}

/* --- world ----------------------------------------------------------------- */

export function createWorld() {
  return {
    t: 0,
    ball: { p: v3(0, 1.9, 4.2), v: v3(), w: v3(), live: false, held: true },
    hoops: [makeHoop()],
    wind: v3(),
    sway: { amp: 0, freq: 0.35 },
    shot: null,      // per-shot bookkeeping
    events: [],      // {type: 'rim'|'board'|'floor'|'net'|'score', strength, hoop}
  };
}

export function setHoops(world, list) {
  world.hoops = list.map((o) => makeHoop(o));
}

/* --- shooting -------------------------------------------------------------- */

export function placeBall(world, p) {
  const b = world.ball;
  b.p = v3(p.x, p.y, p.z);
  b.v = v3(); b.w = v3();
  b.live = false; b.held = true;
  world.shot = null;
}

export function shoot(world, v, w) {
  const b = world.ball;
  b.v = v3(v.x, v.y, v.z);
  b.w = v3(w.x, w.y, w.z);
  b.live = true; b.held = false;
  world.shot = {
    t0: world.t, touchedRim: false, touchedBoard: false, scored: -1,
    above: world.hoops.map(() => b.p.y > RIM_Y), done: false, resting: 0,
    start: { ...b.p },
  };
}

/** Backspin about the axis perpendicular to the throw, in rad/s, plus side spin. */
export function spinFor(v, backspinRps = 2.6, sideRps = 0) {
  const hz = Math.hypot(v.x, v.z) || 1;
  // Axis pointing to the shooter's left; spinning "backwards" for a forward throw.
  const ax = v3(-v.z / hz, 0, v.x / hz);
  const s = backspinRps * Math.PI * 2;
  return v3(-ax.x * s, sideRps * Math.PI * 2, -ax.z * s);
}

/* --- integration ----------------------------------------------------------- */

function accel(world, p, v, w, out) {
  const rel = v3(v.x - world.wind.x, v.y - world.wind.y, v.z - world.wind.z);
  const s = len(rel);
  const m = cross(w, rel);
  out.x = -DRAG_K * s * rel.x + MAGNUS_K * m.x;
  out.y = -G - DRAG_K * s * rel.y + MAGNUS_K * m.y;
  out.z = -DRAG_K * s * rel.z + MAGNUS_K * m.z;
  return out;
}

function contact(ball, n, e, mu, world, type, hoop) {
  const vn = dot(ball.v, n);
  if (vn >= 0) return 0;
  const jn = -(1 + e) * vn * BALL_M;
  // Velocity of the contact point (centre to contact is -r n).
  const rc = v3(-n.x * BALL_R, -n.y * BALL_R, -n.z * BALL_R);
  const wr = cross(ball.w, rc);
  const vc = v3(ball.v.x + wr.x, ball.v.y + wr.y, ball.v.z + wr.z);
  const vcn = dot(vc, n);
  const vt = v3(vc.x - vcn * n.x, vc.y - vcn * n.y, vc.z - vcn * n.z);
  const vtl = len(vt);
  // Impulse that would stop sliding: m_eff = 1 / (1/m + r^2/I).
  const mEff = 1 / (1 / BALL_M + (BALL_R * BALL_R) / BALL_I);
  let jt = Math.min(vtl * mEff, mu * jn);
  const J = v3(n.x * jn, n.y * jn, n.z * jn);
  if (vtl > 1e-6) addS(J, vt, -jt / vtl);
  addS(ball.v, J, 1 / BALL_M);
  const dw = cross(rc, J);
  addS(ball.w, dw, 1 / BALL_I);
  const strength = jn / BALL_M;
  if (strength > 0.25) world.events.push({ type, strength, hoop });
  return jn;
}

function collideHoop(world, h, hi) {
  const b = world.ball;
  const sh = world.shot;
  // Rim: nearest point on the ring circle.
  const cy = RIM_Y + h.rimDy;
  let dx = b.p.x - h.x, dz = b.p.z - h.z;
  const hd = Math.hypot(dx, dz);
  const ux = hd > 1e-6 ? dx / hd : 1, uz = hd > 1e-6 ? dz / hd : 0;
  const q = v3(h.x + ux * RIM_R, cy, h.z + uz * RIM_R);
  const d = v3(b.p.x - q.x, b.p.y - q.y, b.p.z - q.z);
  const dl = len(d);
  const minD = BALL_R + RIM_TUBE;
  if (dl < minD && dl > 1e-6) {
    const n = v3(d.x / dl, d.y / dl, d.z / dl);
    addS(b.p, n, minD - dl);
    const jn = contact(b, n, E_RIM, MU_RIM, world, "rim", hi);
    if (jn > 0) {
      h.rimVy -= jn * 0.9 * Math.max(0.2, -n.y + 0.3);
      if (sh) sh.touchedRim = true;
    }
  }
  // Rim neck: the bracket between rim and board, a short rod.
  // Board: a slab facing +z.
  const fz = h.z - BOARD_GAP + h.boardDz;
  const hw = h.boardW / 2;
  const by0 = 2.9, by1 = 3.95;
  const cx = Math.max(h.x - hw, Math.min(b.p.x, h.x + hw));
  const cyy = Math.max(by0, Math.min(b.p.y, by1));
  const czz = Math.max(fz - BOARD_T, Math.min(b.p.z, fz));
  const bd = v3(b.p.x - cx, b.p.y - cyy, b.p.z - czz);
  const bl = len(bd);
  if (bl < BALL_R) {
    const n = bl > 1e-6 ? v3(bd.x / bl, bd.y / bl, bd.z / bl) : v3(0, 0, 1);
    addS(b.p, n, BALL_R - bl);
    const jn = contact(b, n, E_BOARD, MU_BOARD, world, "board", hi);
    if (jn > 0) {
      h.boardVz -= jn * 0.25;
      if (sh) sh.touchedBoard = true;
    }
  }
}

function stepNet(world, h, dt) {
  const b = world.ball;
  const K = h.knots, P = h.prev;
  // Verlet with damping.
  for (let i = 0; i < K.length; i++) {
    if (i < NET_COLS) continue;
    const k = K[i], p = P[i];
    const vx = (k.x - p.x) * 0.96, vy = (k.y - p.y) * 0.96, vz = (k.z - p.z) * 0.96;
    p.x = k.x; p.y = k.y; p.z = k.z;
    k.x += vx + world.wind.x * 0.02 * dt * dt * 60;
    k.y += vy - G * 0.35 * dt * dt;
    k.z += vz + world.wind.z * 0.02 * dt * dt * 60;
  }
  for (let j = 0; j < NET_COLS; j++) {
    const pin = rimPinned(h, j);
    K[j].x = pin.x; K[j].y = pin.y; K[j].z = pin.z;
    P[j].x = pin.x; P[j].y = pin.y; P[j].z = pin.z;
  }
  let push = 0;
  for (let it = 0; it < 4; it++) {
    for (const [a, c, rest] of h.links) {
      const A = K[a], C = K[c];
      const dx = C.x - A.x, dy = C.y - A.y, dz = C.z - A.z;
      const d = Math.hypot(dx, dy, dz) || 1e-6;
      // Nylon stretches a little, never compresses into a rod.
      if (d < rest) continue;
      const diff = (d - rest) / d;
      const pinA = a < NET_COLS;
      const sa = pinA ? 0 : 0.5, sc = pinA ? 1 : 0.5;
      A.x += dx * diff * sa; A.y += dy * diff * sa; A.z += dz * diff * sa;
      C.x -= dx * diff * sc; C.y -= dy * diff * sc; C.z -= dz * diff * sc;
    }
    if (b.live) {
      const R = BALL_R + 0.006;
      for (let i = NET_COLS; i < K.length; i++) {
        const k = K[i];
        const dx = k.x - b.p.x, dy = k.y - b.p.y, dz = k.z - b.p.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < R * R) {
          const d = Math.sqrt(d2) || 1e-6;
          const s = (R - d) / d;
          k.x += dx * s; k.y += dy * s; k.z += dz * s;
          push += R - d;
        }
      }
    }
  }
  if (push > 0) {
    // The net drags the ball: mostly horizontal, a little vertical.
    const f = Math.min(0.5, push * 3.2);
    b.v.x *= 1 - f; b.v.z *= 1 - f; b.v.y *= 1 - f * 0.35;
    if (push > 0.02) world.events.push({ type: "net", strength: push * 40, hoop: world.hoops.indexOf(h) });
  }
}

/** Advance the world by dt seconds (call with a fixed step, e.g. 1/240). */
export function step(world, dt) {
  world.t += dt;
  const b = world.ball;
  // Hoop motion: sway, rim spring, board spring.
  for (const h of world.hoops) {
    h.x = h.baseX + Math.sin(world.t * Math.PI * 2 * world.sway.freq) * world.sway.amp;
    h.rimVy += (-h.rimDy * 2600 - h.rimVy * 22) * dt;
    h.rimDy += h.rimVy * dt;
    h.boardVz += (-h.boardDz * 1500 - h.boardVz * 14) * dt;
    h.boardDz += h.boardVz * dt;
  }
  if (b.live) {
    const a = accel(world, b.p, b.v, b.w, v3());
    // Semi-implicit Euler is plenty at 240 Hz.
    addS(b.v, a, dt);
    addS(b.p, b.v, dt);
    const decay = Math.exp(-SPIN_DECAY * dt);
    b.w.x *= decay; b.w.y *= decay; b.w.z *= decay;

    world.hoops.forEach((h, i) => collideHoop(world, h, i));

    // Floor.
    if (b.p.y < BALL_R) {
      b.p.y = BALL_R;
      const jn = contact(b, v3(0, 1, 0), E_FLOOR, MU_FLOOR, world, "floor", -1);
      if (jn > 0 && world.shot) world.shot.bounces = (world.shot.bounces || 0) + 1;
    }
    // Score test: centre crosses the rim plane going down, inside the ring.
    const sh = world.shot;
    if (sh) {
      world.hoops.forEach((h, i) => {
        const above = b.p.y > RIM_Y + h.rimDy;
        const hd = Math.hypot(b.p.x - h.x, b.p.z - h.z);
        if (sh.above[i] && !above && b.v.y < 0 && hd < RIM_R - BALL_R * 0.35 && sh.scored < 0) {
          sh.scored = i;
          world.events.push({ type: "score", strength: 1, hoop: i });
        }
        // Only a ball that was above the rim and inside its cylinder counts later.
        if (above) sh.above[i] = true;
        else if (hd > RIM_R + BALL_R) sh.above[i] = false;
      });
      const speed = len(b.v);
      if (b.p.y < 0.2 && speed < 0.6) sh.resting += dt; else sh.resting = 0;
      const tooFar = Math.abs(b.p.x) > 16 || b.p.z > 30 || b.p.z < -3;
      if (!sh.done && (sh.resting > 0.25 || world.t - sh.t0 > 6 || tooFar ||
          (sh.scored >= 0 && b.p.y < 1.2) || ((sh.bounces || 0) >= 2 && sh.scored < 0))) {
        sh.done = true;
      }
    }
  }
  for (const h of world.hoops) stepNet(world, h, dt);
}

/* --- aim assist ------------------------------------------------------------ */

/**
 * Speed that drops the ball through the centre of hoop h from p at the given
 * elevation angle and heading, found by simulating the real flight (drag and
 * spin included) and bisecting on speed.
 */
export function idealShot(world, p, h, angleDeg = 52, backspinRps = 2.6) {
  const tx = h.x, tz = h.z;
  const dx = tx - p.x, dz = tz - p.z;
  const D = Math.hypot(dx, dz);
  const hx = dx / D, hz = dz / D;
  const th = (angleDeg * Math.PI) / 180;
  const sim = (s) => {
    const v = v3(hx * Math.cos(th) * s, Math.sin(th) * s, hz * Math.cos(th) * s);
    const w = spinFor(v, backspinRps);
    const q = { ...p };
    const tmp = { p: q, v: { ...v }, w };
    const fake = { wind: v3() };
    const a = v3();
    const dt = 1 / 240;
    let wasAbove = q.y > RIM_Y;
    for (let i = 0; i < 2000; i++) {
      accel(fake, tmp.p, tmp.v, tmp.w, a);
      addS(tmp.v, a, dt);
      addS(tmp.p, tmp.v, dt);
      if (tmp.p.y > RIM_Y) wasAbove = true;
      if (wasAbove && tmp.p.y <= RIM_Y && tmp.v.y < 0) {
        // Signed horizontal distance along the heading: + is long.
        return (tmp.p.x - p.x) * hx + (tmp.p.z - p.z) * hz - D;
      }
      if (tmp.p.y < 0) return -D;
    }
    return -D;
  };
  let lo = 3, hi = 16;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (sim(mid) > 0) hi = mid; else lo = mid;
  }
  const s = (lo + hi) / 2;
  return { speed: s, heading: Math.atan2(hz, hx), angle: th, dist: D };
}

export function velocityFrom(speed, heading, angle) {
  return v3(Math.cos(heading) * Math.cos(angle) * speed, Math.sin(angle) * speed,
    Math.sin(heading) * Math.cos(angle) * speed);
}
