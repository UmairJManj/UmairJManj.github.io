/* ---------------------------------------------------------------------------
   Learning engine.

   Lessons are taught in the official outline's order. Questions are reviewed
   with Leitner boxes: a right answer moves a question up a box and pushes its
   next review further out; a wrong answer drops it to box 0, brings it back
   within minutes, and queues its lesson to be re-taught on the next basket.

   Mastery of a domain = average of min(box, 3) / 3 over its questions, so a
   domain reads 100% only after every question has been answered right at
   least three times across spaced reviews.
--------------------------------------------------------------------------- */

const MIN = 60 * 1000, DAY = 24 * 60 * MIN;
const INTERVALS = [2 * MIN, 10 * MIN, 1 * DAY, 3 * DAY, 7 * DAY, 21 * DAY];
const KEY = (id) => `hoops3d:v1:${id}`;

export function loadProgress(id) {
  try {
    const p = JSON.parse(localStorage.getItem(KEY(id)) || "null");
    if (p && p.v === 1) return p;
  } catch { /* storage blocked */ }
  return { v: 1, seen: {}, q: {}, relearn: [], recent: [], score: 0, best: 0, made: 0 };
}

export function saveProgress(id, p) {
  try { localStorage.setItem(KEY(id), JSON.stringify(p)); } catch { /* private mode */ }
}

export function resetProgress(id) {
  try { localStorage.removeItem(KEY(id)); } catch { /* ignore */ }
}

export function loadSettings() {
  try { return { control: "flick", sound: true, unlockAll: false, drill: false, ...JSON.parse(localStorage.getItem("hoops3d:settings") || "{}") }; }
  catch { return { control: "flick", sound: true, unlockAll: false, drill: false }; }
}
export function saveSettings(s) {
  try { localStorage.setItem("hoops3d:settings", JSON.stringify(s)); } catch { /* ignore */ }
}

const cache = {};
export async function loadContent(id) {
  if (cache[id]) return cache[id];
  const res = await fetch(`/hoops/content/${id}.json`);
  if (!res.ok) throw new Error(`content ${id}: ${res.status}`);
  const c = await res.json();
  c.lessonById = Object.fromEntries(c.lessons.map((l, i) => [l.id, { ...l, index: i }]));
  c.domainOf = {};
  for (const d of c.domains) for (const o of d.objectives) c.domainOf[o.id] = d.id;
  c.qByLesson = {};
  for (const q of c.questions) (c.qByLesson[q.lesson] ||= []).push(q);
  cache[id] = c;
  return c;
}

/** The next lesson card: a lesson to re-teach, else the next new one, else the weakest. */
export function nextLesson(c, p) {
  while (p.relearn.length) {
    const id = p.relearn.shift();
    if (c.lessonById[id]) return { lesson: c.lessonById[id], review: true };
  }
  const fresh = c.lessons.find((l) => !p.seen[l.id]);
  if (fresh) return { lesson: c.lessonById[fresh.id], review: false };
  // Everything seen: revisit the lesson whose questions are weakest.
  let worst = null, worstScore = Infinity;
  for (const l of c.lessons) {
    const qs = c.qByLesson[l.id] || [];
    if (!qs.length) continue;
    const s = qs.reduce((a, q) => a + (p.q[q.id]?.box ?? 0), 0) / qs.length + ((p.seen[l.id] || 0) / 1e15);
    if (s < worstScore) { worstScore = s; worst = l; }
  }
  return { lesson: c.lessonById[(worst || c.lessons[0]).id], review: true };
}

export function markSeen(p, lessonId) {
  p.seen[lessonId] = Date.now();
  p.recent = [lessonId, ...p.recent.filter((x) => x !== lessonId)].slice(0, 6);
}

/** Pick the next question: due reviews first, then fresh questions on what was just taught. */
export function nextQuestion(c, p, { anyLesson = false } = {}) {
  const now = Date.now();
  const learned = (q) => anyLesson || p.seen[q.lesson];
  const due = c.questions.filter((q) => p.q[q.id] && p.q[q.id].due <= now && learned(q));
  if (due.length) {
    due.sort((a, b) => p.q[a.id].due - p.q[b.id].due);
    return due[0];
  }
  for (const lid of p.recent) {
    const fresh = (c.qByLesson[lid] || []).filter((q) => !p.q[q.id]);
    if (fresh.length) return fresh[Math.floor(Math.random() * fresh.length)];
  }
  const fresh = c.questions.filter((q) => !p.q[q.id] && learned(q));
  if (fresh.length) {
    // In order of the outline, so drills follow the teaching sequence.
    fresh.sort((a, b) => (c.lessonById[a.lesson]?.index ?? 0) - (c.lessonById[b.lesson]?.index ?? 0));
    return fresh[0];
  }
  const any = c.questions.filter((q) => learned(q));
  if (!any.length) return null;
  any.sort((a, b) => (p.q[a.id]?.due ?? 0) - (p.q[b.id]?.due ?? 0));
  return any[0];
}

export function record(c, p, q, correct) {
  const s = p.q[q.id] || { box: 0, right: 0, wrong: 0, due: 0 };
  if (correct) { s.box = Math.min(5, s.box + 1); s.right++; }
  else {
    s.box = 0; s.wrong++;
    if (!p.relearn.includes(q.lesson)) p.relearn.push(q.lesson);
  }
  s.due = Date.now() + INTERVALS[s.box];
  p.q[q.id] = s;
}

export function mastery(c, p) {
  const by = {};
  for (const d of c.domains) by[d.id] = { sum: 0, n: 0, answered: 0, lessons: 0, seen: 0 };
  for (const q of c.questions) {
    const d = by[c.domainOf[q.objective]];
    if (!d) continue;
    d.n++;
    const s = p.q[q.id];
    if (s) { d.answered++; d.sum += Math.min(3, s.box) / 3; }
  }
  for (const l of c.lessons) {
    const d = by[c.domainOf[l.objective]];
    if (!d) continue;
    d.lessons++;
    if (p.seen[l.id]) d.seen++;
  }
  let wsum = 0, wtot = 0;
  const domains = c.domains.map((d) => {
    const m = by[d.id];
    const pct = m.n ? m.sum / m.n : 0;
    const nums = String(d.weight || "").match(/\d+(\.\d+)?/g);
    const w = nums ? nums.map(Number).reduce((a, b) => a + b, 0) / nums.length : 1;
    wsum += pct * w; wtot += w;
    return { id: d.id, name: d.name, weight: d.weight, pct, answered: m.answered, total: m.n, seen: m.seen, lessons: m.lessons };
  });
  return { overall: wtot ? wsum / wtot : 0, domains };
}

/** Is an answer right? `given` is an array of option indices or yes/no booleans. */
export function isCorrect(q, given) {
  if (q.type === "yesno") return q.statements.every((s, i) => given[i] === s.a);
  if (q.type === "order") return given.every((g, i) => g === i);
  const a = [...q.answer].sort((x, y) => x - y);
  const g = [...given].sort((x, y) => x - y);
  return a.length === g.length && a.every((x, i) => x === g[i]);
}
