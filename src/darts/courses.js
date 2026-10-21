/* ---------------------------------------------------------------------------
   The courses behind the side tabs, and the card sequence built from each.

   A course is public/courses/<id>.json:
   { id, code, title, modules: [{ title, intro, lessons: [{ title,
     steps: [[heading, body], ...], check: { q, options, answer, why }, key }] }] }

   Modules follow the exam's domains in study order; lessons build from zero,
   each taught in a few step cards and closed by one question. `answer` is the
   index of the right option (options are shuffled when shown); `key` is the
   one line recap shown before a missed question comes back.

   Check every course file: node src/darts/courses.js
--------------------------------------------------------------------------- */

// Tab order: the AI security course first, then the certifications in study order.
// soon: the course file is still being written; its tab shows but can't be picked.
export const COURSES = [
  { id: "ai-security", tab: "AI security", accent: "#3b82f6" },
  { id: "sc-900", tab: "SC-900", accent: "#0ea5e9" },
  { id: "thm-ai1", tab: "AI1", accent: "#22c55e", soon: true },
  { id: "secai-plus", tab: "SecAI+", accent: "#ef4444", soon: true },
  { id: "ai-901", tab: "AI-901", accent: "#8b5cf6" },
  { id: "governance", tab: "Governance", accent: "#f59e0b" },
  { id: "sc-300", tab: "SC-300", accent: "#06b6d4" },
  { id: "sc-200", tab: "SC-200", accent: "#f97316", soon: true },
  { id: "sc-500", tab: "SC-500", accent: "#ec4899", soon: true },
  { id: "sc-100", tab: "SC-100", accent: "#14b8a6", soon: true },
];

const cache = {};
export function loadCourse(id) {
  return (cache[id] ||= fetch(`/courses/${id}.json`).then((r) => {
    if (!r.ok) throw new Error(`course ${id}: ${r.status}`);
    return r.json();
  }).then(withSequence).catch((e) => { delete cache[id]; throw e; }));
}

/* Flattens a course into its cards: module intro, each lesson's steps, then its check, then the finish. */
export function withSequence(course) {
  const lessons = course.modules.flatMap((m, mi) => m.lessons.map((l, i) => ({ ...l, mi, no: i + 1 })));
  const seq = [], starts = [];
  lessons.forEach((l, li) => {
    if (l.no === 1) { starts[l.mi] = seq.length; seq.push({ kind: "intro", mi: l.mi }); }
    l.steps.forEach((_, si) => seq.push({ kind: "step", li, si }));
    seq.push({ kind: "check", li });
  });
  seq.push({ kind: "done" });
  return { ...course, lessons, seq, starts };
}

/** Problems with a course file, as a list of strings (empty when it is fine). */
export function lint(course) {
  const errs = [];
  const text = JSON.stringify(course);
  if (/[–—]/.test(text)) errs.push("contains an en or em dash");
  if (!course.id || !course.title || !course.code) errs.push("missing id, code or title");
  if (!course.modules?.length) errs.push("no modules");
  course.modules?.forEach((m, mi) => {
    const at = `module ${mi + 1}`;
    if (!m.title || !m.intro || m.intro.length < 120) errs.push(`${at}: title or intro missing or too short`);
    if (!m.lessons?.length) errs.push(`${at}: no lessons`);
    m.lessons?.forEach((l, li) => {
      const where = `${at} lesson ${li + 1} (${l.title})`;
      if (!Array.isArray(l.steps) || l.steps.length < 2 || l.steps.length > 5) errs.push(`${where}: needs 2 to 5 steps`);
      l.steps?.forEach((s, si) => {
        if (!Array.isArray(s) || s.length !== 2 || !s[0]) errs.push(`${where} step ${si + 1}: must be [heading, body]`);
        else if (s[1].length < 120 || s[1].length > 700) errs.push(`${where} step ${si + 1}: body is ${s[1].length} chars, keep 120 to 700`);
      });
      const c = l.check;
      if (!c?.q || !Array.isArray(c.options) || c.options.length < 3 || c.options.length > 5) errs.push(`${where}: check needs q and 3 to 5 options`);
      else if (!(Number.isInteger(c.answer) && c.answer >= 0 && c.answer < c.options.length)) errs.push(`${where}: answer index out of range`);
      if (!c?.why || c.why.length < 60) errs.push(`${where}: check needs a why of at least 60 chars`);
      if (!l.key || l.key.length < 30) errs.push(`${where}: key recap missing or too short`);
    });
  });
  return errs;
}

if (typeof process !== "undefined" && process.argv?.[1]?.endsWith("courses.js")) {
  import("node:fs").then(({ readFileSync, existsSync }) => {
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : COURSES.map((c) => c.id);
  let bad = 0;
  for (const id of ids) {
    const f = new URL(`../../public/courses/${id}.json`, import.meta.url);
    if (!existsSync(f)) { console.log(`${id}: not written yet`); continue; }
    const c = JSON.parse(readFileSync(f, "utf8"));
    const errs = lint(c);
    const s = withSequence(c);
    if (errs.length) { bad++; console.log(`${id}: ${errs.length} problems\n  ${errs.slice(0, 20).join("\n  ")}`); }
    else console.log(`${id}: ok, ${c.modules.length} modules, ${s.lessons.length} lessons, ${s.seq.length} cards`);
  }
  process.exitCode = bad ? 1 : 0;
  });
}
