import "./darts.css";
import { useEffect, useRef, useState } from "react";
import { createGame } from "./game.js";
import { loadContent, loadSettings, saveSettings } from "./learn.js";
import { LessonCard, QuizCard, Settings } from "./ui.jsx";

/* ---------------------------------------------------------------------------
   Darts: throw to master AI security.

   Every throw ends with a card. Cards alternate: a lesson, then a quick check
   on that lesson after the next throw. The ring the dart hit sets how hard the
   check is. A wrong answer sends the lesson back three lessons later.
--------------------------------------------------------------------------- */

const ACCENT = "#3b82f6";
// Keys keep their hoops3d names so progress made in the basketball version carries over.
const CARD_KEY = "hoops3d:card";
const LEARN_KEY = "hoops3d:learn";
const SCORE_KEY = "hoops3d:score";
const QUIZ_TYPES = ["single", "multi", "yesno"];
const QUIZ_PTS = 10;
const DIFFICULTY = { miss: 1, single: 1, outer: 2, double: 2, treble: 3, bull: 3 };

const readNum = (k) => { try { return Number(localStorage.getItem(k)) || 0; } catch { return 0; } };
const writeNum = (k, v) => { try { localStorage.setItem(k, String(v)); } catch { /* private mode */ } };

// The lesson sequence: AI security first, then the wider security path.
const ORDER = ["thm-ai1", "secai-plus", "ai-901", "governance", "sc-900", "sc-300", "sc-200", "sc-500", "sc-100"];

// Lesson counts per track, so lesson n maps to a track file without loading all of them.
let countsP = null;
const counts = () => (countsP ||= fetch("/hoops/content/index.json").then((r) => r.json())
  .then((rows) => ORDER.map((id) => rows.find((r) => r.id === id)?.lessons || 0)));

async function lessonAt(n) {
  const c = await counts();
  const total = c.reduce((a, b) => a + b, 0);
  let i = ((n % total) + total) % total;
  const no = i + 1;
  let t = 0;
  while (i >= c[t]) { i -= c[t]; t++; }
  const content = await loadContent(ORDER[t]);
  const lesson = content.lessons[i];
  const qs = content.questions.filter((q) => q.lesson === lesson.id && QUIZ_TYPES.includes(q.type));
  return { lesson, qs, n: no, total };
}

// Learning state: next new lesson, lessons taught, lessons due again, and the lesson awaiting its check.
// A check left pending from an earlier visit is dropped, so a returning visitor starts on a new lesson.
function loadLearn() {
  try {
    const s = JSON.parse(localStorage.getItem(LEARN_KEY));
    if (s && Array.isArray(s.review)) return { ...s, check: null };
  } catch { /* fresh */ }
  return { next: readNum(CARD_KEY), taught: 0, review: [], check: null };
}
const saveLearn = (s) => { try { localStorage.setItem(LEARN_KEY, JSON.stringify(s)); } catch { /* private mode */ } };

// The card after a throw: the check on the last lesson if one is waiting, otherwise the next lesson (reviews first).
async function nextCard(L, difficulty) {
  if (L.check != null) {
    const i = L.check;
    L.check = null;
    const { lesson, qs } = await lessonAt(i);
    const pool = qs.filter((q) => q.difficulty === difficulty);
    const from = pool.length ? pool : qs;
    if (from.length) return { kind: "quiz", i, q: from[Math.floor(Math.random() * from.length)], title: lesson.title };
  }
  const r = L.review.findIndex((x) => x.due <= L.taught);
  const review = r >= 0;
  const i = review ? L.review.splice(r, 1)[0].i : L.next++;
  L.taught++;
  L.check = i;
  return { kind: "lesson", i, review, ...(await lessonAt(i)) };
}

export default function DartsArena() {
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const [settings, setSettingsState] = useState(loadSettings);
  const [err, setErr] = useState(null);
  const [card, setCard] = useState(null);
  const [deep, setDeep] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [score, setScore] = useState(() => readNum(SCORE_KEY));
  const [callout, setCallout] = useState(null);
  const learn = useRef(loadLearn());
  const throws = useRef(0);

  const setSettings = (patch) => setSettingsState((s) => { const n = { ...s, ...patch }; saveSettings(n); return n; });
  const addScore = (d) => setScore((s) => { writeNum(SCORE_KEY, s + d); return s + d; });

  /* --- game lifecycle ------------------------------------------------------- */
  const handlers = useRef({});
  useEffect(() => {
    const game = createGame(canvasRef.current, { onResult: (r) => handlers.current.onResult?.(r) });
    gameRef.current = game;
    game.setAccent(ACCENT);
    const ro = new ResizeObserver(() => game.resize());
    ro.observe(stageRef.current);
    game.resize();
    return () => { ro.disconnect(); game.destroy(); gameRef.current = null; };
  }, []);

  useEffect(() => { gameRef.current?.audio.setEnabled(settings.sound); }, [settings.sound]);
  useEffect(() => { counts().catch(() => setErr("The lessons could not load. Refresh to try again.")); }, []);
  useEffect(() => { if (!callout) return undefined; const t = setTimeout(() => setCallout(null), 1300); return () => clearTimeout(t); }, [callout]);

  /* --- throw results: every throw ends with a card ---------------------------- */
  handlers.current.onResult = (hit) => {
    addScore(hit.pts);
    setCallout({ text: hit.pts ? `${hit.label} +${hit.pts}` : hit.label, good: hit.pts >= 25, k: Math.random() });
    throws.current += 1;
    gameRef.current?.setLevel(Math.floor(throws.current / 4));
    nextCard(learn.current, DIFFICULTY[hit.ring]).then((c) => { saveLearn(learn.current); setDeep(false); setCard({ ...c, k: Math.random() }); })
      .catch(() => { setErr("The lessons could not load. Refresh to try again."); gameRef.current?.next(); });
  };

  // Retrieval practice: a right answer earns points, a wrong one re-queues the lesson.
  function onAnswer(ok) {
    const L = learn.current;
    if (ok) addScore(QUIZ_PTS);
    else L.review.push({ i: card.i, due: L.taught + 3 });
    saveLearn(L);
  }

  function nextThrow() {
    setCard(null);
    gameRef.current?.next();
    canvasRef.current?.focus();
  }

  /* --- full screen: the real Fullscreen API puts the game above the whole page -- */
  useEffect(() => {
    const onFs = () => setExpanded(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);
  useEffect(() => {
    // Fallback (iPhone Safari has no element full screen): a fixed overlay.
    if (!expanded || document.fullscreenElement) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") setExpanded(false); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [expanded]);
  const toggleFull = () => {
    if (document.fullscreenElement) { document.exitFullscreen(); return; }
    if (expanded) { setExpanded(false); return; }
    const el = rootRef.current;
    if (el?.requestFullscreen) el.requestFullscreen().catch(() => setExpanded(true));
    else setExpanded(true);
  };

  /* --- render ----------------------------------------------------------------- */
  let overlay = null;
  if (showSettings) overlay = (
    <Settings s={settings} set={setSettings} onClose={() => setShowSettings(false)}
      onReset={() => {
        learn.current = { next: 0, taught: 0, review: [], check: null }; saveLearn(learn.current);
        writeNum(SCORE_KEY, 0); setScore(0); setShowSettings(false);
      }} />
  );
  else if (err) overlay = <div className="dt-card"><p className="dt-short">{err}</p></div>;
  else if (card?.kind === "quiz") overlay = <QuizCard key={card.k} q={card.q} title={card.title} pts={QUIZ_PTS} onAnswer={onAnswer} onDone={nextThrow} />;
  else if (card) overlay = (
    <LessonCard lesson={card.lesson} review={card.review} domain="Lesson" deep={deep} setDeep={setDeep}
      n={card.n} total={card.total} onDone={nextThrow} doneLabel="Next throw" />
  );

  return (
    <div ref={rootRef} className={`dt ${expanded ? "dt--full" : ""}`} style={{ "--arena": ACCENT }}>
      <div className="dt-head">
        <h3 className="dt-name">Throw darts to master AI security</h3>
        <span className="dt-score" aria-live="polite"><b>{score}</b> pts</span>
        <div className="dt-tools">
          <button onClick={() => setShowSettings(!showSettings)} aria-label="Settings" title="Settings">⚙</button>
          <button onClick={toggleFull} aria-label={expanded ? "Exit full screen" : "Full screen"} title={expanded ? "Exit full screen" : "Full screen"}>{expanded ? "✕" : "⤢"}</button>
        </div>
      </div>
      <div className="dt-stage" ref={stageRef}>
        <canvas ref={canvasRef} className="dt-canvas" tabIndex={0}
          aria-label="Dartboard. Aim with the pointer or arrow keys, release or press space to throw." />
        {!overlay && <p className="dt-tip">Aim, then let go to throw. Trebles and the bull earn harder questions.</p>}
        {callout && <div key={callout.k} className={`dt-callout ${callout.good ? "is-good" : ""}`}>{callout.text}</div>}
        {overlay && <div className="dt-overlay" aria-live="polite"><div className="dt-flash">{overlay}</div></div>}
      </div>
    </div>
  );
}
