import "./darts.css";
import { useEffect, useRef, useState } from "react";
import { createGame } from "./game.js";
import { loadSettings, saveSettings } from "./learn.js";
import { Settings } from "./ui.jsx";

/* ---------------------------------------------------------------------------
   Darts: just the game. Aim, let go, and the dart is scored like a real
   board. Wind comes in after the first few throws. The flashcards live in
   their own panel below (Flashcards.jsx).
--------------------------------------------------------------------------- */

const SCORE_KEY = "darts:score";
const ACCENT = "#3b82f6";

const readNum = (k) => { try { return Number(localStorage.getItem(k)) || 0; } catch { return 0; } };
const writeNum = (k, v) => { try { localStorage.setItem(k, String(v)); } catch { /* private mode */ } };

// Wind: calm for the first few throws, then stronger and from either side.
const windFor = (n) => (n < 3 ? 0 : (Math.random() < 0.5 ? -1 : 1) * Math.min(4, 0.8 + n * 0.12) * (0.5 + Math.random() * 0.5));

export default function DartsArena() {
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const [settings, setSettingsState] = useState(loadSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [score, setScore] = useState(() => readNum(SCORE_KEY));
  const [callout, setCallout] = useState(null);
  const throws = useRef(0);

  const setSettings = (patch) => setSettingsState((s) => { const n = { ...s, ...patch }; saveSettings(n); return n; });

  /* --- game lifecycle ------------------------------------------------------- */
  useEffect(() => {
    const game = createGame(canvasRef.current, {
      onResult: (hit) => {
        setScore((s) => { writeNum(SCORE_KEY, s + hit.pts); return s + hit.pts; });
        setCallout({ text: hit.pts ? `${hit.label} +${hit.pts}` : hit.label, good: hit.pts >= 25, k: Math.random() });
        throws.current += 1;
        game.setLevel(Math.floor(throws.current / 4));
        setTimeout(() => { game.setWind(windFor(throws.current)); game.next(); }, 900);
      },
    });
    gameRef.current = game;
    game.setAccent(ACCENT);
    const ro = new ResizeObserver(() => game.resize());
    ro.observe(stageRef.current);
    game.resize();
    return () => { ro.disconnect(); game.destroy(); gameRef.current = null; };
  }, []);

  useEffect(() => { gameRef.current?.audio.setEnabled(settings.sound); }, [settings.sound]);
  useEffect(() => { if (!callout) return undefined; const t = setTimeout(() => setCallout(null), 1300); return () => clearTimeout(t); }, [callout]);

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

  return (
    <div ref={rootRef} className={`dt ${expanded ? "dt--full" : ""}`} style={{ "--arena": ACCENT }}>
      <div className="dt-head">
        <h3 className="dt-name">Darts</h3>
        <span className="dt-score" aria-live="polite"><b>{score}</b> pts</span>
        <div className="dt-tools">
          <button onClick={() => setShowSettings(!showSettings)} aria-label="Settings" title="Settings">⚙</button>
          <button onClick={toggleFull} aria-label={expanded ? "Exit full screen" : "Full screen"} title={expanded ? "Exit full screen" : "Full screen"}>{expanded ? "✕" : "⤢"}</button>
        </div>
      </div>
      <div className="dt-stage" ref={stageRef}>
        <canvas ref={canvasRef} className="dt-canvas" tabIndex={0}
          aria-label="Dartboard. Aim with the pointer or arrow keys, release or press space to throw." />
        {!showSettings && <p className="dt-tip">Aim, then let go to throw. Watch the wind.</p>}
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
