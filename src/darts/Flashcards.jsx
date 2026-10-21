import "./darts.css";
import { useEffect, useRef, useState } from "react";
import { COURSES, loadCourse } from "./courses.js";
import { Contents, CourseCard, QuizCard, Tabs } from "./ui.jsx";

/* ---------------------------------------------------------------------------
   Flashcards: security courses taught one card at a time.

   Book style tabs down the side pick a subject. Picking one opens its
   contents (one module per exam domain); from there each Next shows the next
   card: a module intro, a lesson taught step by step, then a question on it.
   A wrong answer brings a recap and the same question back a few cards
   later. Each subject keeps its own place.
--------------------------------------------------------------------------- */

const TAB_KEY = "darts:tab";
const SCORE_KEY = "cards:score";
const QUIZ_PTS = 10;
const RETRY_AFTER = 4;   // cards before a missed question comes back

const readNum = (k) => { try { return Number(localStorage.getItem(k)) || 0; } catch { return 0; } };
const writeNum = (k, v) => { try { localStorage.setItem(k, String(v)); } catch { /* private mode */ } };
const readTab = () => {
  try { const t = localStorage.getItem(TAB_KEY); return COURSES.some((c) => c.id === t && !c.soon) ? t : "ai-security"; } catch { return "ai-security"; }
};

// Each subject's place: the next card in its sequence, plus missed lessons waiting for a recap and a second try.
const placeKey = (id) => `darts:course:${id}`;
function loadPlace(id) {
  try {
    const s = JSON.parse(localStorage.getItem(placeKey(id)));
    if (s && Array.isArray(s.retry)) return s;
  } catch { /* fresh */ }
  return { pos: 0, retry: [] };
}
const savePlace = (id, s) => { try { localStorage.setItem(placeKey(id), JSON.stringify(s)); } catch { /* private mode */ } };

// The next card. A retry that is due comes as a recap card, then its question on the card after.
function nextCard(C, course) {
  const r = C.retry.findIndex((x) => x.due <= C.pos && !x.recapped);
  if (r >= 0) { C.retry[r].recapped = true; return { kind: "recap", li: C.retry[r].li }; }
  const q = C.retry.findIndex((x) => x.recapped);
  if (q >= 0) return { kind: "check", li: C.retry.splice(q, 1)[0].li, review: true };
  const card = course.seq[Math.min(C.pos, course.seq.length - 1)];
  C.pos = card.kind === "done" ? 0 : C.pos + 1;
  return card;
}

export default function Flashcards() {
  const [tab, setTab] = useState(readTab);
  const [course, setCourse] = useState(null);
  const [failed, setFailed] = useState(false);
  const [card, setCard] = useState(null);
  const [score, setScore] = useState(() => readNum(SCORE_KEY));
  const place = useRef({ pos: 0, retry: [] });
  const bodyRef = useRef(null);
  const meta = COURSES.find((c) => c.id === tab);

  useEffect(() => {
    try { localStorage.setItem(TAB_KEY, tab); } catch { /* private mode */ }
    setCourse(null); setFailed(false); setCard({ kind: "contents" });
    let live = true;
    place.current = loadPlace(tab);
    loadCourse(tab).then((c) => { if (live) setCourse(c); }).catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [tab]);

  function next() {
    const C = place.current, c = nextCard(C, course);
    // Furthest card seen in each module, so jumping ahead doesn't mark skipped modules as done.
    const mi = c.mi ?? course.lessons[c.li]?.mi;
    if (mi != null) C.best = { ...C.best, [mi]: Math.max(C.best?.[mi] || 0, C.pos) };
    savePlace(tab, C);
    setCard({ ...c, k: Math.random() });
    bodyRef.current?.scrollTo({ top: 0 });
  }

  // A chosen module comes first; any questions waiting for a second try follow a few cards in.
  function startAt(pos) {
    place.current = { ...place.current, pos, retry: place.current.retry.map((r) => ({ ...r, due: pos + RETRY_AFTER, recapped: false })) };
    next();
  }

  // Retrieval practice: a right answer earns points, a wrong one re-queues the lesson.
  function onAnswer(ok) {
    const C = place.current;
    if (ok) setScore((s) => { writeNum(SCORE_KEY, s + QUIZ_PTS); return s + QUIZ_PTS; });
    else C.retry.push({ li: card.li, due: C.pos + RETRY_AFTER });
    savePlace(tab, C);
  }

  const pos = place.current.pos;
  let body;
  if (failed) body = <div className="dt-card"><p className="dt-short">This subject could not load. Check your connection, or pick another tab.</p></div>;
  else if (!course) body = <div className="dt-card"><p className="dt-hint">Loading…</p></div>;
  else if (card.kind === "contents") body = <Contents course={course} pos={pos} best={place.current.best || {}} onStart={startAt} onResume={next} />;
  else if (card.kind === "check") body = <QuizCard key={card.k} course={course} li={card.li} review={card.review} pts={QUIZ_PTS} pos={pos} onAnswer={onAnswer} onDone={next} />;
  else body = <CourseCard key={card.k} course={course} card={card} pos={pos} onDone={next} />;

  return (
    <section className="fc" style={{ "--arena": meta.accent }} aria-label="Security flashcards">
      <div className="dt-head">
        <h3 className="dt-name">Learn security, one card at a time</h3>
        <span className="dt-score" aria-live="polite"><b>{score}</b> pts</span>
        <div className="dt-tools">
          {course && card.kind !== "contents" && <button onClick={() => setCard({ kind: "contents" })} aria-label="Contents" title="Contents">☰</button>}
        </div>
      </div>
      <div className="fc-main">
        <Tabs tab={tab} onPick={setTab} />
        <div className="fc-body" ref={bodyRef} aria-live="polite">{body}</div>
      </div>
    </section>
  );
}
