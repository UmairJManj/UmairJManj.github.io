import "./darts.css";
import { useEffect, useRef, useState } from "react";
import { createGame, x01, checkout } from "./game.js";
import { loadSettings, saveSettings } from "./learn.js";
import { Settings } from "./ui.jsx";

/* ---------------------------------------------------------------------------
   Darts: a game of 501. Three darts a visit; score counts down from 501 and
   the leg must finish exactly on a double (or the bull). Going below zero,
   leaving 1, or reaching zero on anything but a double is a bust, and the
   score goes back to where the visit started. The flashcards live in their
   own panel below (Flashcards.jsx).
--------------------------------------------------------------------------- */

const STATS_KEY = "darts:stats";
const ACCENT = "#3b82f6";
const START = 501;

const readStats = () => {
  try { const s = JSON.parse(localStorage.getItem(STATS_KEY)); if (s && Number.isFinite(s.darts)) return s; } catch { /* fresh */ }
  return { legs: 0, darts: 0, scored: 0 };
};
const saveStats = (s) => { try { localStorage.setItem(STATS_KEY, JSON.stringify(s)); } catch { /* private mode */ } };

// What the caller says at the end of a visit.
const call = (total) => (total === 180 ? "One hundred and eighty!" : total === 0 ? "No score" : String(total));

// Wind: calm for the first few visits, then stronger and from either side.
const windFor = (n) => (n < 9 ? 0 : (Math.random() < 0.5 ? -1 : 1) * Math.min(4, 0.6 + n * 0.05) * (0.5 + Math.random() * 0.5));

export default function DartsArena() {
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const [settings, setSettingsState] = useState(loadSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [callout, setCallout] = useState(null);
  const [tip, setTip] = useState(null);
  const [rem, setRem] = useState(START);
  const [visit, setVisit] = useState([]);            // this visit's darts
  const [stats, setStats] = useState(readStats);
  const S = useRef({ rem: START, visitStart: START, visit: [], throws: 0 });

  const setSettings = (patch) => setSettingsState((s) => { const n = { ...s, ...patch }; saveSettings(n); return n; });
  const say = (text, good) => setCallout({ text, good, k: Math.random() });

  /* --- one dart ------------------------------------------------------------- */
  const handlers = useRef({});
  handlers.current.onResult = (hit) => {
    const g = gameRef.current, st = S.current;
    st.throws += 1;
    st.visit = [...st.visit, hit];
    setVisit(st.visit);
    if (hit.hint) setTip(hit.hint);
    const res = x01(st.rem, hit);
    let end = st.visit.length === 3, won = false;
    if (res.bust) { say("Bust", false); st.rem = st.visitStart; end = true; g.audio.groan(); }
    else {
      st.rem = res.remaining;
      if (res.won) { won = true; end = true; say("Game shot, and the leg!", true); g.audio.cheer(4); }
      else if (end) { const total = st.visitStart - st.rem; say(call(total), total >= 100); if (total >= 100) g.audio.cheer(total === 180 ? 5 : 2); }
      else say(hit.label, hit.pts >= 50);
    }
    setRem(st.rem);
    setStats((s) => { const n = { legs: s.legs + (won ? 1 : 0), darts: s.darts + 1, scored: s.scored + (res.bust ? 0 : hit.pts) }; saveStats(n); return n; });
    g.setLevel(Math.floor(st.throws / 9));
    if (!end) { setTimeout(() => g.next(), 600); return; }
    // End of the visit: collect the darts and step back up to the oche.
    setTimeout(() => {
      if (won) st.rem = START;
      st.visitStart = st.rem; st.visit = [];
      setRem(st.rem); setVisit([]); setTip(null);
      g.clearBoard(); g.setWind(windFor(st.throws)); g.next();
    }, 1600);
  };

  /* --- game lifecycle ------------------------------------------------------- */
  useEffect(() => {
    const game = createGame(canvasRef.current, {
      onResult: (hit) => handlers.current.onResult(hit),
      onHint: (text) => setTip(text),
    });
    gameRef.current = game;
    game.setAccent(ACCENT);
    const ro = new ResizeObserver(() => game.resize());
    ro.observe(stageRef.current);
    game.resize();
    return () => { ro.disconnect(); game.destroy(); gameRef.current = null; };
  }, []);

  useEffect(() => { gameRef.current?.audio.setEnabled(settings.sound); }, [settings.sound]);
  useEffect(() => { if (!callout) return undefined; const t = setTimeout(() => setCallout(null), 1500); return () => clearTimeout(t); }, [callout]);
  useEffect(() => { if (!tip) return undefined; const t = setTimeout(() => setTip(null), 2600); return () => clearTimeout(t); }, [tip]);

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

  const out = checkout(rem, 3 - visit.length);
  const avg = stats.darts ? ((stats.scored / stats.darts) * 3).toFixed(1) : "0.0";
  return (
    <div ref={rootRef} className={`dt ${expanded ? "dt--full" : ""}`} style={{ "--arena": ACCENT }}>
      <div className="dt-head">
        <h3 className="dt-name">Darts · 501</h3>
        <span className="dt-score" title="Three dart average and legs won">avg <b>{avg}</b> · legs <b>{stats.legs}</b></span>
        <div className="dt-tools">
          <button onClick={() => setShowSettings(!showSettings)} aria-label="Settings" title="Settings">⚙</button>
          <button onClick={toggleFull} aria-label={expanded ? "Exit full screen" : "Full screen"} title={expanded ? "Exit full screen" : "Full screen"}>{expanded ? "✕" : "⤢"}</button>
        </div>
      </div>
      <div className="dt-stage" ref={stageRef}>
        <canvas ref={canvasRef} className="dt-canvas" tabIndex={0}
          aria-label="Dartboard. Hold to aim, flick up and let go to throw. Keyboard: arrow keys aim, space throws." />
        <div className="dt-board" aria-live="polite">
          <b>{rem}</b>
          <span className="dt-visit" aria-label={`${3 - visit.length} darts left this visit`}>
            {[0, 1, 2].map((i) => <i key={i} className={i < visit.length ? "used" : ""} />)}
          </span>
          {visit.length > 0 && <span className="dt-darts">{visit.map((h) => (h.pts ? h.label.replace("Treble ", "T").replace("Double ", "D") : "0")).join(" · ")}</span>}
          {out && <span className="dt-out">Checkout {out.join(" ")}</span>}
        </div>
        {!showSettings && <p className="dt-tip">{tip || "Hold to aim, then flick up and let go. Finish on a double."}</p>}
        {callout && <div key={callout.k} className={`dt-callout ${callout.good ? "is-good" : ""}`}>{callout.text}</div>}
        {showSettings && (
          <div className="dt-overlay"><div className="dt-flash">
            <Settings s={settings} set={setSettings} onClose={() => setShowSettings(false)} />
          </div></div>
        )}
      </div>
    </div>
  );
}
