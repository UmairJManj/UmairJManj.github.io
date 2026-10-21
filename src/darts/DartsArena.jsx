import "./darts.css";
import { useEffect, useRef, useState } from "react";
import { createGame } from "./game.js";
import { loadSettings, saveSettings } from "./learn.js";
import { COURSES, loadCourse } from "./courses.js";
import { Contents, CourseCard, QuizCard, Settings, Tabs } from "./ui.jsx";

/* ---------------------------------------------------------------------------
   Darts: throw to learn.

   Book style tabs down the side pick what to learn: free play, the AI
   security course, or a certification taught from zero. Picking a course
   opens its contents (one module per exam domain); after that every throw
   shows the next card: a module intro, a lesson taught step by step, then a
   question on it. A wrong answer brings a recap and the same question back a
   few cards later. Each course keeps its own place.
--------------------------------------------------------------------------- */

const TAB_KEY = "darts:tab";
const SCORE_KEY = "darts:score";
const QUIZ_PTS = 10;
const RETRY_AFTER = 4;   // cards before a missed question comes back
const PLAY = { accent: "#64748b" };

const readNum = (k) => { try { return Number(localStorage.getItem(k)) || 0; } catch { return 0; } };
const writeNum = (k, v) => { try { localStorage.setItem(k, String(v)); } catch { /* private mode */ } };
const readTab = () => {
  try { const t = localStorage.getItem(TAB_KEY); return t && !COURSES.find((c) => c.id === t)?.soon ? t : "ai-security"; } catch { return "ai-security"; }
};

// Each course's place: the next card in its sequence, plus missed lessons waiting for a recap and a second try.
const placeKey = (id) => `darts:course:${id}`;
function loadPlace(id) {
  try {
    // The AI security course was the only one before tabs, saved under "darts:course".
    const raw = localStorage.getItem(placeKey(id)) ?? (id === "ai-security" ? localStorage.getItem("darts:course") : null);
    const s = JSON.parse(raw);
    if (s && Array.isArray(s.retry)) return s;
  } catch { /* fresh */ }
  return { pos: 0, retry: [] };
}
const savePlace = (id, s) => { try { localStorage.setItem(placeKey(id), JSON.stringify(s)); } catch { /* private mode */ } };

// The card after a throw. A retry that is due comes as a recap card, then its question on the next throw.
function nextCard(C, course) {
  const r = C.retry.findIndex((x) => x.due <= C.pos && !x.recapped);
  if (r >= 0) { C.retry[r].recapped = true; return { kind: "recap", li: C.retry[r].li }; }
  const q = C.retry.findIndex((x) => x.recapped);
  if (q >= 0) return { kind: "check", li: C.retry.splice(q, 1)[0].li, review: true };
  const card = course.seq[Math.min(C.pos, course.seq.length - 1)];
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
  const [tab, setTab] = useState(readTab);
  const [course, setCourse] = useState(null);       // the loaded course for the tab, null in free play
  const [failed, setFailed] = useState(false);
  const [card, setCard] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [score, setScore] = useState(() => readNum(SCORE_KEY));
  const [callout, setCallout] = useState(null);
  const place = useRef(null);
  const throws = useRef(0);
  const meta = COURSES.find((c) => c.id === tab) || PLAY;

  const setSettings = (patch) => setSettingsState((s) => { const n = { ...s, ...patch }; saveSettings(n); return n; });
  const addScore = (d) => setScore((s) => { writeNum(SCORE_KEY, s + d); return s + d; });

  /* --- game lifecycle ------------------------------------------------------- */
  const handlers = useRef({});
  useEffect(() => {
    const game = createGame(canvasRef.current, { onResult: (r) => handlers.current.onResult?.(r) });
    gameRef.current = game;
    const ro = new ResizeObserver(() => game.resize());
    ro.observe(stageRef.current);
    game.resize();
    return () => { ro.disconnect(); game.destroy(); gameRef.current = null; };
  }, []);

  useEffect(() => { gameRef.current?.audio.setEnabled(settings.sound); }, [settings.sound]);
  useEffect(() => { gameRef.current?.setAccent(meta.accent); }, [meta.accent]);
  useEffect(() => { if (!callout) return undefined; const t = setTimeout(() => setCallout(null), 1300); return () => clearTimeout(t); }, [callout]);

  /* --- tabs: load the course and open its contents ---------------------------- */
  useEffect(() => {
    try { localStorage.setItem(TAB_KEY, tab); } catch { /* private mode */ }
    setCourse(null); setFailed(false); setCard(null);
    if (tab === "play") return undefined;
    let live = true;
    place.current = loadPlace(tab);
    loadCourse(tab).then((c) => { if (live) { setCourse(c); setCard({ kind: "contents", k: Math.random() }); } })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [tab]);

  /* --- throw results: in a course every throw ends with a card ------------------ */
  handlers.current.onResult = (hit) => {
    addScore(hit.pts);
    setCallout({ text: hit.pts ? `${hit.label} +${hit.pts}` : hit.label, good: hit.pts >= 25, k: Math.random() });
    throws.current += 1;
    gameRef.current?.setLevel(Math.floor(throws.current / 4));
    if (!course) { setTimeout(nextThrow, 900); return; }   // free play: straight to the next dart
    const c = nextCard(place.current, course);
    savePlace(tab, place.current);
    setCard({ ...c, k: Math.random() });
  };

  // Retrieval practice: a right answer earns points, a wrong one re-queues the lesson.
  function onAnswer(ok) {
    const C = place.current;
    if (ok) addScore(QUIZ_PTS);
    else C.retry.push({ li: card.li, due: C.pos + RETRY_AFTER });
    savePlace(tab, C);
  }

  function nextThrow() {
    setCard(null);
    gameRef.current?.setWind(windFor(throws.current));
    gameRef.current?.next();
    canvasRef.current?.focus();
  }

  function startAt(pos) {
    // A chosen module comes first; any questions waiting for a second try follow a few cards in.
    place.current = { pos, retry: place.current.retry.map((r) => ({ ...r, due: pos + RETRY_AFTER, recapped: false })) };
    savePlace(tab, place.current);
    nextThrow();
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
  const pos = place.current?.pos ?? 0;
  let overlay = null;
  if (showSettings) overlay = (
    <Settings s={settings} set={setSettings} course={course} onClose={() => setShowSettings(false)}
      onReset={() => { place.current = { pos: 0, retry: [] }; savePlace(tab, place.current); setShowSettings(false); setCard({ kind: "contents", k: Math.random() }); }} />
  );
  else if (failed) overlay = <div className="dt-card"><p className="dt-short">This course could not load. Check your connection, or pick another tab.</p></div>;
  else if (!course || !card) overlay = null;
  else if (card.kind === "contents") overlay = <Contents course={course} pos={pos} onStart={startAt} onResume={nextThrow} />;
  else if (card.kind === "check") overlay = (
    <QuizCard key={card.k} course={course} li={card.li} review={card.review} pts={QUIZ_PTS} pos={pos} onAnswer={onAnswer} onDone={nextThrow} />
  );
  else overlay = <CourseCard course={course} card={card} pos={pos} onDone={nextThrow} />;

  const heading = course ? `Throw darts to learn ${course.code}` : tab === "play" ? "Darts" : "Throw darts to learn";
  return (
    <div ref={rootRef} className={`dt-book ${expanded ? "dt--full" : ""}`} style={{ "--arena": meta.accent }}>
      <Tabs tab={tab} onPick={(id) => { setShowSettings(false); setTab(id); }} />
      <div className="dt">
        <div className="dt-head">
          <h3 className="dt-name">{heading}</h3>
          <span className="dt-score" aria-live="polite"><b>{score}</b> pts</span>
          <div className="dt-tools">
            {course && <button onClick={() => { setShowSettings(false); setCard({ kind: "contents", k: Math.random() }); }} aria-label="Contents" title="Contents">☰</button>}
            <button onClick={() => setShowSettings(!showSettings)} aria-label="Settings" title="Settings">⚙</button>
            <button onClick={toggleFull} aria-label={expanded ? "Exit full screen" : "Full screen"} title={expanded ? "Exit full screen" : "Full screen"}>{expanded ? "✕" : "⤢"}</button>
          </div>
        </div>
        <div className="dt-stage" ref={stageRef}>
          <canvas ref={canvasRef} className="dt-canvas" tabIndex={0}
            aria-label="Dartboard. Aim with the pointer or arrow keys, release or press space to throw." />
          {!overlay && <p className="dt-tip">{course ? "Aim, then let go to throw. Each throw teaches the next card." : "Aim, then let go to throw. Pick a tab to learn while you play."}</p>}
          {callout && <div key={callout.k} className={`dt-callout ${callout.good ? "is-good" : ""}`}>{callout.text}</div>}
          {overlay && <div className="dt-overlay" aria-live="polite"><div className="dt-flash">{overlay}</div></div>}
        </div>
      </div>
    </div>
  );
}
