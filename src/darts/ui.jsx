/* Small presentational pieces for the darts panel. */
import { useMemo, useState } from "react";
import { MODULES, LESSONS } from "./curriculum.js";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Tiny, safe markdown: **bold** and blank-line paragraphs. */
export function Md({ text, className }) {
  const html = String(text || "").split(/\n{2,}/)
    .map((b) => `<p>${esc(b).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")}</p>`).join("");
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

function Top({ mi, right }) {
  return (
    <div className="dt-card-top">
      <span className="dt-sect">Module {mi + 1} of {MODULES.length} · {MODULES[mi].title}</span>
      {right && <span className="dt-prog">{right}</span>}
    </div>
  );
}

function Progress({ pos, total }) {
  return <div className="dt-bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={pos}
    aria-label="Course progress"><span style={{ width: `${(100 * pos) / total}%` }} /></div>;
}

/** A teaching card: module intro, one step of a lesson, a recap before a retry, or the finish. */
export function CourseCard({ card, pos, total, onDone }) {
  let body;
  if (card.kind === "intro") {
    const m = MODULES[card.mi];
    body = (
      <>
        <div className="dt-card-top"><span className="dt-sect">Module {card.mi + 1} of {MODULES.length}</span><span className="dt-prog">New module</span></div>
        <h4 className="dt-big">{m.title}</h4>
        <Md text={m.intro} className="dt-short" />
        <ol className="dt-plan">{m.lessons.map((l) => <li key={l.title}>{l.title}</li>)}</ol>
      </>
    );
  } else if (card.kind === "step") {
    const l = LESSONS[card.li];
    const [title, text] = l.steps[card.si];
    body = (
      <>
        <Top mi={l.mi} right={`Lesson ${l.no}: step ${card.si + 1} of ${l.steps.length}`} />
        <p className="dt-lesson">{l.title}</p>
        <h4>{title}</h4>
        <Md text={text} className="dt-short" />
      </>
    );
  } else if (card.kind === "recap") {
    const l = LESSONS[card.li];
    body = (
      <>
        <Top mi={l.mi} right="Recap" />
        <p className="dt-lesson">{l.title}</p>
        <h4>Remember this</h4>
        <p className="dt-key">{l.key}</p>
        <p className="dt-hint">Your next throw brings this lesson's question back.</p>
      </>
    );
  } else {
    body = (
      <>
        <div className="dt-card-top"><span className="dt-sect">Course complete</span></div>
        <h4 className="dt-big">You've finished AI security basics</h4>
        <p className="dt-short">Eight modules: how AI apps work, threat modelling, prompt injection, unsafe output, data leakage, poisoning and supply chain, attacks on models, and defence and governance. Your next throw starts the course again from the top.</p>
      </>
    );
  }
  return (
    <div className="dt-card">
      {body}
      <Progress pos={pos} total={total} />
      <div className="dt-actions"><button className="dt-btn" onClick={onDone} autoFocus>Next throw</button></div>
    </div>
  );
}

/** The check that ends a lesson. Options are shuffled each time it is shown. */
export function QuizCard({ li, review, pts, pos, total, onAnswer, onDone }) {
  const l = LESSONS[li], c = l.check;
  const order = useMemo(() => c.options.map((_, i) => i).sort(() => Math.random() - 0.5), [c]);
  const [pick, setPick] = useState(null);
  const done = pick !== null;
  const choose = (i) => { if (done) return; setPick(i); onAnswer(i === c.answer); };
  return (
    <div className="dt-card">
      <Top mi={l.mi} right={review ? "Second try" : "Check your understanding"} />
      <p className="dt-lesson">{l.title}</p>
      <h4>{c.q}</h4>
      <div className="dt-opts">
        {order.map((i, k) => {
          const cls = !done ? "" : i === c.answer ? "is-right" : i === pick ? "is-wrong" : "";
          return <button key={i} className={cls} disabled={done} onClick={() => choose(i)} autoFocus={k === 0}>{c.options[i]}</button>;
        })}
      </div>
      {done && (
        <>
          <p className={`dt-verdict ${pick === c.answer ? "is-right" : "is-wrong"}`}>
            {pick === c.answer ? `Correct. +${pts} points.` : "Not quite. You'll get a recap and another go in a few cards."}
          </p>
          <Md text={c.why} className="dt-short" />
          <Progress pos={pos} total={total} />
          <div className="dt-actions"><button className="dt-btn" onClick={onDone} autoFocus>Next throw</button></div>
        </>
      )}
    </div>
  );
}

export function Settings({ s, set, onReset, onClose }) {
  return (
    <div className="dt-card dt-settings">
      <div className="dt-card-top">
        <span className="dt-sect">Settings</span>
        <button className="dt-x" onClick={onClose} aria-label="Close">×</button>
      </div>
      <label className="dt-check"><input type="checkbox" checked={s.sound} onChange={(e) => set({ sound: e.target.checked })} /> Sound</label>
      <p className="dt-hint">Keyboard: arrow keys to aim, Space to throw. Progress is saved in this browser only.</p>
      <button className="dt-btn ghost danger" onClick={onReset}>Start the course again</button>
    </div>
  );
}
