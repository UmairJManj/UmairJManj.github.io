import "./hoops3d.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { createGame, SPOTS } from "./game.js";
import { TRACKS } from "./tracks.js";
import { loadContent, loadSettings, saveSettings } from "./learn.js";
import { LessonCard, QuizCard, Settings } from "./ui.jsx";

/* ---------------------------------------------------------------------------
   Hoops 3D: shoot hoops to master AI security.

   Every shot, made or missed, ends with a card. Cards alternate: a lesson,
   then a quick check on that lesson after the next shot. A wrong answer sends
   the lesson back into the deck three lessons later, so gaps get re-taught.
--------------------------------------------------------------------------- */

const ACCENT = "#3b82f6";
const CARD_KEY = "hoops3d:card";   // older saves: only the next lesson number
const LEARN_KEY = "hoops3d:learn";
const QUIZ_TYPES = ["single", "multi", "yesno"];
const SCORE_KEY = "hoops3d:score";
const CALLOUT = {
  swish: "Swish", glass: "Off the glass", rim: "In off the rim",
  short: "Short", long: "Long", wide: "Wide", rimout: "Rimmed out",
};
const LEVELS = [
  { sway: 0, wind: 0, assist: 1 },
  { sway: 0.2, wind: 0, assist: 0.95 },
  { sway: 0.3, wind: 0.8, assist: 0.88 },
  { sway: 0.45, wind: 1.2, assist: 0.8 },
  { sway: 0.6, wind: 1.6, assist: 0.72 },
  { sway: 0.8, wind: 2.1, assist: 0.65 },
];

const readNum = (k) => { try { return Number(localStorage.getItem(k)) || 0; } catch { return 0; } };
const writeNum = (k, v) => { try { localStorage.setItem(k, String(v)); } catch { /* private mode */ } };

// The flashcard sequence: AI security first, then the wider security path.
const ORDER = ["thm-ai1", "secai-plus", "ai-901", "governance", "sc-900", "sc-300", "sc-200", "sc-500", "sc-100"]
  .map((id) => TRACKS.find((t) => t.id === id));

// Lesson counts per track, so card n maps to a track file without loading all of them.
let countsP = null;
const counts = () => (countsP ||= fetch("/hoops/content/index.json").then((r) => r.json())
  .then((rows) => ORDER.map((t) => rows.find((r) => r.id === t.id)?.lessons || 0)));

async function lessonAt(n) {
  const c = await counts();
  const total = c.reduce((a, b) => a + b, 0);
  let i = ((n % total) + total) % total;
  const no = i + 1;
  let t = 0;
  while (i >= c[t]) { i -= c[t]; t++; }
  const content = await loadContent(ORDER[t].id);
  const lesson = content.lessons[i];
  const qs = content.questions.filter((q) => q.lesson === lesson.id && QUIZ_TYPES.includes(q.type));
  return { lesson, qs, n: no, total };
}

// Learning state: next new lesson, lessons taught, lessons due again, and the lesson awaiting its check.
function loadLearn() {
  try { const s = JSON.parse(localStorage.getItem(LEARN_KEY)); if (s && Array.isArray(s.review)) return s; } catch { /* fresh */ }
  return { next: readNum(CARD_KEY), taught: 0, review: [], check: null };
}
const saveLearn = (s) => { try { localStorage.setItem(LEARN_KEY, JSON.stringify(s)); } catch { /* private mode */ } };

// The card after a shot: the check on the last lesson if one is waiting, otherwise the next lesson (reviews first).
async function nextCard(L) {
  if (L.check != null) {
    const i = L.check;
    L.check = null;
    const { lesson, qs } = await lessonAt(i);
    if (qs.length) return { kind: "quiz", i, q: qs[Math.floor(Math.random() * qs.length)], title: lesson.title };
  }
  const r = L.review.findIndex((x) => x.due <= L.taught);
  const review = r >= 0;
  const i = review ? L.review.splice(r, 1)[0].i : L.next++;
  L.taught++;
  L.check = i;
  return { kind: "lesson", i, review, ...(await lessonAt(i)) };
}

export default function HoopsArena() {
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const [settings, setSettingsState] = useState(loadSettings);
  const [err, setErr] = useState(null);
  const [card, setCard] = useState(null);           // { lesson, n, total }
  const [deep, setDeep] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [score, setScore] = useState(() => readNum(SCORE_KEY));
  const [streak, setStreak] = useState(0);
  const [callout, setCallout] = useState(null);
  const [meter, setMeter] = useState(null);
  const [spotName, setSpotName] = useState(SPOTS[0].name);
  const [wind, setWind] = useState(0);
  const learn = useRef(loadLearn());
  const pendingSpot = useRef(null);

  const setSettings = (patch) => setSettingsState((s) => { const n = { ...s, ...patch }; saveSettings(n); return n; });

  /* --- game lifecycle ------------------------------------------------------- */
  const handlers = useRef({});
  useEffect(() => {
    let game;
    try {
      game = createGame(canvasRef.current, {
        onResult: (r) => handlers.current.onResult?.(r),
        onMeter: (v) => setMeter(v),
      });
    } catch {
      setErr("This browser can't run WebGL, so the 3D court can't load.");
      return undefined;
    }
    gameRef.current = game;
    game.setTrack({ accent: ACCENT, title: "AI SECURITY" });
    game.setScore(readNum(SCORE_KEY), 0);
    const ro = new ResizeObserver(() => game.resize());
    ro.observe(stageRef.current);
    game.resize();
    return () => { ro.disconnect(); game.destroy(); gameRef.current = null; };
  }, []);

  useEffect(() => { gameRef.current?.setControl(settings.control); }, [settings.control]);
  useEffect(() => { gameRef.current?.audio.setEnabled(settings.sound); }, [settings.sound]);
  useEffect(() => { counts().catch(() => setErr("The flashcards could not load. Refresh to try again.")); }, []);

  /* --- difficulty ------------------------------------------------------------- */
  const applyLevel = useCallback((s) => {
    const g = gameRef.current; if (!g) return;
    const L = LEVELS[Math.min(LEVELS.length - 1, Math.floor(s / 3))];
    const w = L.wind ? L.wind * (Math.random() < 0.5 ? -1 : 1) : 0;
    g.setDifficulty({ sway: L.sway, wind: w, assist: L.assist });
    setWind(w);
  }, []);

  const nextSpot = (s) => {
    const lvl = Math.floor(s / 3);
    const pool = SPOTS.slice(0, lvl === 0 ? 3 : lvl === 1 ? 5 : SPOTS.length);
    const cur = gameRef.current?.spot?.name;
    const choices = pool.filter((p) => p.name !== cur);
    return choices[Math.floor(Math.random() * choices.length)] || SPOTS[0];
  };

  const say = (text, good) => setCallout({ text, good, k: Math.random() });
  useEffect(() => { if (!callout) return undefined; const t = setTimeout(() => setCallout(null), 1300); return () => clearTimeout(t); }, [callout]);

  /* --- shot results: every shot ends with the next flashcard ------------------ */
  handlers.current.onResult = (r) => {
    const g = gameRef.current;
    if (!g) return;
    let s = score, st = streak;
    if (r.made) { s += r.pts; st += 1; say(`${CALLOUT[r.kind]}${r.pts > 1 ? ` +${r.pts}` : ""}`, true); }
    else { st = 0; say(CALLOUT[r.kind], false); }
    setScore(s); setStreak(st); writeNum(SCORE_KEY, s);
    g.setScore(s, st);
    pendingSpot.current = r.made ? nextSpot(st) : null;
    nextCard(learn.current).then((c) => { saveLearn(learn.current); setDeep(false); setCard({ ...c, k: Math.random() }); })
      .catch(() => { setErr("The flashcards could not load. Refresh to try again."); g.next(); });
  };

  // Retrieval practice: a right answer earns a point, a wrong one re-queues the lesson.
  function onAnswer(ok) {
    const L = learn.current;
    if (ok) { const s = score + 1; setScore(s); writeNum(SCORE_KEY, s); gameRef.current?.setScore(s, streak); }
    else L.review.push({ i: card.i, due: L.taught + 3 });
    saveLearn(L);
  }

  function nextShot() {
    setCard(null);
    const g = gameRef.current; if (!g) return;
    const sp = pendingSpot.current;
    pendingSpot.current = null;
    applyLevel(streak);
    if (sp) { g.setSpot(sp); setSpotName(sp.name); } else g.next();
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
        learn.current = { next: 0, taught: 0, review: [], check: null }; saveLearn(learn.current); writeNum(SCORE_KEY, 0);
        setScore(0); setStreak(0); gameRef.current?.setScore(0, 0); setShowSettings(false);
      }} />
  );
  else if (err) overlay = <div className="h3d-card"><p className="h3d-short">{err}</p></div>;
  else if (card?.kind === "quiz") overlay = <QuizCard key={card.k} q={card.q} title={card.title} onAnswer={onAnswer} onDone={nextShot} />;
  else if (card) overlay = (
    <LessonCard lesson={card.lesson} review={card.review} domain="Lesson" deep={deep} setDeep={setDeep}
      n={card.n} total={card.total} onDone={nextShot} doneLabel="Next shot" />
  );

  return (
    <div ref={rootRef} className={`h3d ${expanded ? "h3d--full" : ""}`} style={{ "--arena": ACCENT }}>
      <div className="h3d-head">
        <h3 className="h3d-name">Shoot hoops to master AI security</h3>
        <span className="h3d-score" aria-live="polite"><b>{score}</b> pts{streak > 1 ? ` · ${streak}×` : ""}</span>
        <div className="h3d-tools">
          <button onClick={() => setShowSettings(!showSettings)} aria-label="Settings" title="Settings">⚙</button>
          <button onClick={toggleFull} aria-label={expanded ? "Exit full screen" : "Full screen"} title={expanded ? "Exit full screen" : "Full screen"}>{expanded ? "✕" : "⤢"}</button>
        </div>
      </div>
      <div className="h3d-stage" ref={stageRef}>
        <canvas ref={canvasRef} className="h3d-canvas" tabIndex={0}
          aria-label={`Basketball court. ${settings.control === "flick" ? "Flick up to shoot" : "Hold and release to shoot"}; arrow keys aim, space shoots.`} />
        <div className="h3d-hud">
          <span className="h3d-spot">{spotName}</span>
          {wind !== 0 && <span className="h3d-wind">Wind {wind < 0 ? "←" : "→"} {Math.abs(wind).toFixed(1)} m/s</span>}
        </div>
        {!overlay && <p className="h3d-tip">{settings.control === "flick" ? "Flick the ball up to shoot" : "Hold, aim, release on the green"}. After each shot: a lesson, then a quick check on it.</p>}
        {callout && <div key={callout.k} className={`h3d-callout ${callout.good ? "is-good" : ""}`}>{callout.text}</div>}
        {meter != null && (
          <div className="h3d-meter" aria-hidden><div className="h3d-meter-sweet" /><div className="h3d-meter-fill" style={{ height: `${meter * 100}%` }} /></div>
        )}
        {overlay && <div className="h3d-overlay" aria-live="polite"><div className="h3d-flash">{overlay}</div></div>}
      </div>
    </div>
  );
}
