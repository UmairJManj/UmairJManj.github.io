import "./hoops3d.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createGame, SPOTS } from "./game.js";
import { TRACKS } from "./tracks.js";
import {
  loadContent, loadProgress, saveProgress, resetProgress, loadSettings, saveSettings,
  nextLesson, markSeen, nextQuestion, record, mastery, isCorrect,
} from "./learn.js";
import { LessonCard, QuizCard, Feedback, ProgressView, ArenaPicker, Settings } from "./ui.jsx";

/* ---------------------------------------------------------------------------
   Hoops 3D: learn your certification path one basket at a time.

   Make a basket -> a lesson card from the official skills outline.
   Every second lesson -> an exam shot: the answers hang over the hoops and the
   one you sink is the one you give. Wrong answers come back sooner and their
   lesson is re-taught. Each exam is its own arena, in study order.
--------------------------------------------------------------------------- */

const LESSONS_PER_QUIZ = 2;
const LETTERS = "ABCDE";
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

const shuffle = (n) => {
  const a = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

function storedMastery(id) {
  try { return JSON.parse(localStorage.getItem(`hoops3d:v1:${id}`) || "{}").mastery || 0; } catch { return 0; }
}

export default function HoopsArena() {
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const [settings, setSettingsState] = useState(loadSettings);
  const [trackIdx, setTrackIdx] = useState(() => {
    const s = loadSettings();
    // Start at the first arena not yet mastered.
    const i = TRACKS.findIndex((t) => storedMastery(t.id) < 0.6);
    return s.lastTrack != null ? s.lastTrack : Math.max(0, i);
  });
  const track = TRACKS[trackIdx];
  const [content, setContent] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const progRef = useRef(null);
  const [, bump] = useState(0);
  const refresh = () => bump((n) => n + 1);

  const [phase, setPhase] = useState("shoot");      // shoot | quiz | feedback
  const [card, setCard] = useState(null);           // { lesson, review }
  const [deep, setDeep] = useState(false);
  const [quiz, setQuiz] = useState(null);
  const [fb, setFb] = useState(null);
  const [tapMode, setTapMode] = useState(false);
  const [panel, setPanel] = useState(null);         // null | progress | arenas | settings
  const [expanded, setExpanded] = useState(false);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [callout, setCallout] = useState(null);
  const [meter, setMeter] = useState(null);
  const [spotName, setSpotName] = useState(SPOTS[0].name);
  const [wind, setWind] = useState(0);
  const sinceQuiz = useRef(0);
  const quizRef = useRef(null);
  quizRef.current = quiz;

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
    } catch (e) {
      setLoadErr("This browser can't run WebGL, so the 3D court can't load.");
      return undefined;
    }
    gameRef.current = game;
    const ro = new ResizeObserver(() => game.resize());
    ro.observe(stageRef.current);
    game.resize();
    return () => { ro.disconnect(); game.destroy(); gameRef.current = null; };
  }, []);

  useEffect(() => { gameRef.current?.setControl(settings.control); }, [settings.control]);
  useEffect(() => { gameRef.current?.audio.setEnabled(settings.sound); }, [settings.sound]);

  /* --- load an arena --------------------------------------------------------- */
  useEffect(() => {
    let alive = true;
    setContent(null); setLoadErr(null); setCard(null); setQuiz(null); setFb(null); setPhase("shoot");
    progRef.current = loadProgress(track.id);
    setScore(progRef.current.score || 0);
    setStreak(0);
    sinceQuiz.current = 0;
    const g = gameRef.current;
    if (g) { g.setTrack({ accent: track.accent, title: `${track.code} · ${track.arena}` }); g.setMode({ kind: "lesson" }, SPOTS[0]); g.setScore(progRef.current.score || 0, 0); }
    setSpotName(SPOTS[0].name);
    loadContent(track.id)
      .then((c) => { if (alive) setContent(c); })
      .catch(() => { if (alive) setLoadErr(`The ${track.code} arena is still being built. Pick another arena.`); });
    return () => { alive = false; };
  }, [track.id]);

  useEffect(() => { if (content && settings.drill && phase === "shoot" && !quiz) startQuiz(); }, [content, settings.drill]);

  const m = useMemo(() => (content && progRef.current ? mastery(content, progRef.current) : null), [content, phase, card, fb]);
  const domainName = (objective) => {
    if (!content) return "";
    const d = content.domains.find((x) => x.id === content.domainOf[objective]);
    return d ? d.name.replace(/^(Describe|Implement|Manage|Design|Plan and|Perform|Identify|Secure|Respond to)\s+(the\s+)?/i, "").replace(/^./, (c) => c.toUpperCase()) : "";
  };

  const persist = () => {
    const p = progRef.current;
    if (content) p.mastery = mastery(content, p).overall;
    p.score = scoreRef.current;
    p.best = Math.max(p.best || 0, scoreRef.current);
    saveProgress(track.id, p);
  };
  const scoreRef = useRef(0);
  scoreRef.current = score;

  /* --- difficulty ------------------------------------------------------------- */
  const applyLevel = useCallback((s, forQuiz) => {
    const g = gameRef.current; if (!g) return;
    const L = forQuiz ? LEVELS[0] : LEVELS[Math.min(LEVELS.length - 1, Math.floor(s / 3))];
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

  const say = (text, good) => {
    setCallout({ text, good, k: Math.random() });
  };
  useEffect(() => { if (!callout) return undefined; const t = setTimeout(() => setCallout(null), 1300); return () => clearTimeout(t); }, [callout]);

  /* --- quiz ----------------------------------------------------------------- */
  function startQuiz() {
    if (!content) return;
    const q = nextQuestion(content, progRef.current, { anyLesson: settings.drill });
    if (!q) return;
    const n = q.type === "yesno" ? 2 : q.type === "order" ? q.options.length : q.options.length;
    const perm = q.type === "yesno" ? [0, 1] : shuffle(n);
    const labels = q.type === "yesno"
      ? [{ text: "YES", color: "#22c55e" }, { text: "NO", color: "#ef4444" }]
      : q.type === "order" ? [{ text: "GO" }]
        : perm.map((_, i) => ({ text: LETTERS[i] }));
    setQuiz({ q, perm, selected: [], yi: 0, yesno: [], order: [] });
    setTapMode(false);
    setPhase("quiz");
    setCard(null);
    applyLevel(0, true);
    gameRef.current?.setMode({ kind: "quiz", labels, three: q.difficulty === 3 });
    setSpotName(q.difficulty === 3 ? "Three-point line · hard question" : "Exam line");
  }

  function finishQuiz(qz, given) {
    const { q } = qz;
    const correct = isCorrect(q, given);
    record(content, progRef.current, q, correct);
    const g = gameRef.current;
    let s = score, st = streak;
    if (correct) { s += 3 + q.difficulty * 2; st += 1; g?.audio.correct(); g?.flash(`Correct +${3 + q.difficulty * 2}`); }
    else { st = 0; g?.audio.wrong(); g?.flash("Review it"); }
    setScore(s); setStreak(st); scoreRef.current = s;
    g?.setScore(s, st);
    setFb({ q, correct, perm: qz.perm, given: q.type === "single" || q.type === "complete" || q.type === "multi" ? qz.selected : [] });
    setQuiz(null);
    setPhase("feedback");
    persist();
  }

  function quizAnswer(i) {
    const qz = quizRef.current; if (!qz) return;
    const { q } = qz;
    if (q.type === "single" || q.type === "complete") {
      const sel = [i];
      finishQuiz({ ...qz, selected: sel }, sel.map((x) => qz.perm[x]));
      return;
    }
    if (q.type === "multi") {
      const sel = qz.selected.includes(i) ? qz.selected.filter((x) => x !== i) : [...qz.selected, i];
      setQuiz({ ...qz, selected: sel });
      gameRef.current?.next();
      return;
    }
    if (q.type === "yesno") {
      const yn = [...qz.yesno]; yn[qz.yi] = i === 0;
      if (qz.yi >= 2) { finishQuiz({ ...qz, yesno: yn }, yn); return; }
      setQuiz({ ...qz, yesno: yn, yi: qz.yi + 1 });
      gameRef.current?.next();
      return;
    }
    if (q.type === "order") {
      if (qz.order.length !== q.options.length) { say("Tap every step first", false); gameRef.current?.next(); return; }
      finishQuiz(qz, qz.order);
    }
  }

  function quizSubmit() {
    const qz = quizRef.current; if (!qz) return;
    if (qz.q.type === "multi") finishQuiz(qz, qz.selected.map((x) => qz.perm[x]));
    else if (qz.q.type === "order") finishQuiz(qz, qz.order);
  }

  function orderPick(oi) {
    const qz = quizRef.current; if (!qz) return;
    const order = qz.order.includes(oi) ? qz.order.filter((x) => x !== oi) : [...qz.order, oi];
    setQuiz({ ...qz, order });
  }

  function backToCourt() {
    setFb(null);
    if (settings.drill) { startQuiz(); return; }
    setPhase("shoot");
    const sp = nextSpot(streak);
    gameRef.current?.setMode({ kind: "lesson" }, sp);
    setSpotName(sp.name);
    applyLevel(streak, false);
  }

  function reviewLesson() {
    if (!fb) return;
    const l = content.lessonById[fb.q.lesson];
    progRef.current.relearn = progRef.current.relearn.filter((x) => x !== l.id);
    setCard({ lesson: l, review: true });
    setDeep(true);
    setFb(null);
    setPhase("shoot");
    const sp = nextSpot(streak);
    gameRef.current?.setMode({ kind: "lesson" }, sp);
    setSpotName(sp.name);
    applyLevel(streak, false);
  }

  /* --- shot results -------------------------------------------------------- */
  handlers.current.onResult = (r) => {
    const g = gameRef.current;
    if (!g) return;
    if (phase === "quiz") {
      if (!r.made) { say(`${CALLOUT[r.kind]}: shoot again`, false); g.next(); return; }
      say(CALLOUT[r.kind], true);
      quizAnswer(r.hoop);
      return;
    }
    if (phase !== "shoot") { g.next(); return; }
    if (!r.made) {
      say(CALLOUT[r.kind], false);
      setStreak(0); g.setScore(score, 0);
      applyLevel(0, false);
      g.next();
      return;
    }
    const s = score + r.pts, st = streak + 1;
    setScore(s); setStreak(st); scoreRef.current = s;
    g.setScore(s, st);
    say(`${CALLOUT[r.kind]}${r.pts > 1 ? ` +${r.pts}` : ""}`, true);
    if (content) {
      const p = progRef.current;
      p.made = (p.made || 0) + 1;
      const nl = nextLesson(content, p);
      markSeen(p, nl.lesson.id);
      setCard(nl); setDeep(false);
      sinceQuiz.current += 1;
      persist();
    }
    const sp = nextSpot(st);
    applyLevel(st, false);
    g.setSpot(sp);
    setSpotName(sp.name);
  };

  const quizDue = phase === "shoot" && card && sinceQuiz.current >= LESSONS_PER_QUIZ;
  const onCardDone = () => {
    if (quizDue) { sinceQuiz.current = 0; startQuiz(); }
    else setCard(null);
  };

  /* --- expanded view ------------------------------------------------------------ */
  useEffect(() => {
    if (!expanded) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") setExpanded(false); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [expanded]);

  const unlocked = (i) => settings.unlockAll || i === 0 || storedMastery(TRACKS[i - 1].id) >= 0.6;
  const pickTrack = (i) => { setPanel(null); setTrackIdx(i); setSettings({ lastTrack: i }); };
  const total = content?.lessons.length || 0;
  const seenCount = content ? content.lessons.filter((l) => progRef.current?.seen[l.id]).length : 0;

  /* --- render ----------------------------------------------------------------- */
  let body;
  if (panel === "progress" && m) body = <ProgressView m={m} track={track} content={content} onClose={() => setPanel(null)} />;
  else if (panel === "arenas") body = <ArenaPicker tracks={TRACKS} current={trackIdx} masteryOf={storedMastery} unlocked={unlocked} onPick={pickTrack} onClose={() => setPanel(null)} />;
  else if (panel === "settings") body = (
    <Settings s={settings} set={setSettings} onClose={() => setPanel(null)}
      onReset={() => {
        if (!window.confirm(`Reset all ${track.code} progress in this browser?`)) return;
        resetProgress(track.id); progRef.current = loadProgress(track.id); setScore(0); setStreak(0); setCard(null); gameRef.current?.setScore(0, 0); setPanel(null);
      }} />
  );
  else if (loadErr) body = <div className="h3d-card"><p className="h3d-short">{loadErr}</p><div className="h3d-actions"><button className="h3d-btn" onClick={() => setPanel("arenas")}>Arenas</button></div></div>;
  else if (!content) body = <div className="h3d-card"><p className="h3d-short">Loading the {track.arena}…</p></div>;
  else if (phase === "quiz" && quiz) body = <QuizCard quiz={quiz} onTap={quizAnswer} onSubmit={quizSubmit} onOrderPick={orderPick} tapMode={tapMode} setTapMode={setTapMode} />;
  else if (phase === "feedback" && fb) body = <Feedback fb={fb} onNext={backToCourt} onReview={reviewLesson} />;
  else if (card) body = (
    <LessonCard lesson={card.lesson} review={card.review} domain={domainName(card.lesson.objective)} deep={deep} setDeep={setDeep}
      n={card.lesson.index + 1} total={total}
      onDone={onCardDone} doneLabel={quizDue ? "Exam shot" : "Got it"} />
  );
  else body = (
    <div className="h3d-card h3d-intro">
      <div className="h3d-card-top"><span className="h3d-sect">{track.issuer} · {track.code}</span><span className="h3d-prog">{seenCount} / {total} lessons</span></div>
      <h4>{track.name}</h4>
      <p className="h3d-short">
        {settings.control === "flick" ? "Flick the ball up towards the hoop." : "Press and hold, aim, release on the green."}{" "}
        Every basket teaches the next idea on the official {track.code} outline; every second one sets up an exam shot where you sink the right answer.
      </p>
    </div>
  );

  return (
    <div className={`h3d ${expanded ? "h3d--full" : ""}`} style={{ "--arena": track.accent }}>
      <div className="h3d-head">
        <button className="h3d-title" onClick={() => setPanel(panel === "arenas" ? null : "arenas")} aria-label="Choose arena">
          <span className="h3d-tcode">{track.code}</span>
          <span className="h3d-arena-label">{track.arena}</span>
          <span aria-hidden>▾</span>
        </button>
        <span className="h3d-score" aria-live="polite"><b>{score}</b> pts{streak > 1 ? ` · ${streak}×` : ""}</span>
        <div className="h3d-tools">
          <button onClick={() => setPanel(panel === "progress" ? null : "progress")} aria-label="Mastery" title="Mastery">{m ? `${Math.round(m.overall * 100)}%` : "–"}</button>
          <button onClick={() => setPanel(panel === "settings" ? null : "settings")} aria-label="Settings" title="Settings">⚙</button>
          <button onClick={() => setExpanded(!expanded)} aria-label={expanded ? "Exit full screen" : "Full screen"} title={expanded ? "Exit full screen" : "Full screen"}>{expanded ? "✕" : "⤢"}</button>
        </div>
      </div>
      <div className="h3d-main">
        <div className="h3d-stage" ref={stageRef}>
          <canvas ref={canvasRef} className="h3d-canvas" tabIndex={0}
            aria-label={`Basketball court. ${settings.control === "flick" ? "Flick up to shoot" : "Hold and release to shoot"}; arrow keys aim, space shoots.`} />
          <div className="h3d-hud">
            <span className="h3d-spot">{spotName}</span>
            {wind !== 0 && <span className="h3d-wind">Wind {wind < 0 ? "←" : "→"} {Math.abs(wind).toFixed(1)} m/s</span>}
          </div>
          {callout && <div key={callout.k} className={`h3d-callout ${callout.good ? "is-good" : ""}`}>{callout.text}</div>}
          {meter != null && (
            <div className="h3d-meter" aria-hidden><div className="h3d-meter-sweet" /><div className="h3d-meter-fill" style={{ height: `${meter * 100}%` }} /></div>
          )}
        </div>
        <div className="h3d-panel" aria-live="polite">{body}</div>
      </div>
    </div>
  );
}
