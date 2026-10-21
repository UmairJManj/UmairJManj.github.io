import "./darts.css";
import { useEffect, useRef, useState } from "react";
import { createGame } from "./game.js";
import { loadSettings, saveSettings } from "./learn.js";
import { SEQUENCE } from "./curriculum.js";
import { CourseCard, QuizCard, Settings } from "./ui.jsx";

/* ---------------------------------------------------------------------------
   Darts: throw to master AI security.

   Every throw shows the next card of a short AI security course: a module
   intro, a lesson taught step by step, then a question on it. A wrong answer
   brings a recap and the same question back a few cards later.
--------------------------------------------------------------------------- */

const ACCENT = "#3b82f6";
const COURSE_KEY = "darts:course";
const SCORE_KEY = "darts:score";
const QUIZ_PTS = 10;
const RETRY_AFTER = 4;   // cards before a missed question comes back

const readNum = (k) => { try { return Number(localStorage.getItem(k)) || 0; } catch { return 0; } };
const writeNum = (k, v) => { try { localStorage.setItem(k, String(v)); } catch { /* private mode */ } };

// Course state: the next card in SEQUENCE, plus missed lessons waiting for a recap and a second try.
const fresh = () => ({ pos: 0, retry: [] });
function loadCourse() {
  try { const s = JSON.parse(localStorage.getItem(COURSE_KEY)); if (s && Array.isArray(s.retry)) return s; } catch { /* fresh */ }
  return fresh();
}
const saveCourse = (s) => { try { localStorage.setItem(COURSE_KEY, JSON.stringify(s)); } catch { /* private mode */ } };

// The card after a throw. A retry that is due comes as a recap card, then its question on the next throw.
function nextCard(C) {
  const r = C.retry.findIndex((x) => x.due <= C.pos && !x.recapped);
  if (r >= 0) { C.retry[r].recapped = true; return { kind: "recap", li: C.retry[r].li }; }
  const q = C.retry.findIndex((x) => x.recapped);
  if (q >= 0) return { kind: "check", li: C.retry.splice(q, 1)[0].li, review: true };
  const card = SEQUENCE[C.pos];
  C.pos = card.kind === "done" ? 0 : C.pos + 1;
  return card;
}

// Wind: calm for the first few throws, then stronger and from either side.
const windFor = (n) => (n < 3 ? 0 : (Math.random() < 0.5 ? -1 : 1) * Math.min(4, 0.8 + n * 0.12) * (0.5 + Math.random() * 0.5));

export default function DartsArena() {
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const [settings, setSettingsState] = useState(loadSettings);
  const [card, setCard] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [score, setScore] = useState(() => readNum(SCORE_KEY));
  const [callout, setCallout] = useState(null);
  const course = useRef(loadCourse());
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
  useEffect(() => { if (!callout) return undefined; const t = setTimeout(() => setCallout(null), 1300); return () => clearTimeout(t); }, [callout]);

  /* --- throw results: every throw ends with a card ---------------------------- */
  handlers.current.onResult = (hit) => {
    addScore(hit.pts);
    setCallout({ text: hit.pts ? `${hit.label} +${hit.pts}` : hit.label, good: hit.pts >= 25, k: Math.random() });
    throws.current += 1;
    gameRef.current?.setLevel(Math.floor(throws.current / 4));
    const c = nextCard(course.current);
    saveCourse(course.current);
    setCard({ ...c, k: Math.random() });
  };

  // Retrieval practice: a right answer earns points, a wrong one re-queues the lesson.
  function onAnswer(ok) {
    const C = course.current;
    if (ok) addScore(QUIZ_PTS);
    else C.retry.push({ li: card.li, due: C.pos + RETRY_AFTER });
    saveCourse(C);
  }

  function nextThrow() {
    setCard(null);
    const w = windFor(throws.current);
    gameRef.current?.setWind(w);
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
        course.current = fresh(); saveCourse(course.current);
        writeNum(SCORE_KEY, 0); setScore(0); setShowSettings(false);
      }} />
  );
  else if (card?.kind === "check") overlay = (
    <QuizCard key={card.k} li={card.li} review={card.review} pts={QUIZ_PTS} pos={course.current.pos} total={SEQUENCE.length}
      onAnswer={onAnswer} onDone={nextThrow} />
  );
  else if (card) overlay = <CourseCard card={card} pos={course.current.pos} total={SEQUENCE.length} onDone={nextThrow} />;

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
        {!overlay && <p className="dt-tip">Aim, then let go to throw. Each throw teaches the next card.</p>}
        {callout && <div key={callout.k} className={`dt-callout ${callout.good ? "is-good" : ""}`}>{callout.text}</div>}
        {overlay && <div className="dt-overlay" aria-live="polite"><div className="dt-flash">{overlay}</div></div>}
      </div>
    </div>
  );
}
