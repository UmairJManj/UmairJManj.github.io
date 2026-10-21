/* Small presentational pieces for the darts panel. */
import { useMemo, useState } from "react";
import { COURSES } from "./courses.js";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Tiny, safe markdown: **bold** and blank-line paragraphs. */
export function Md({ text, className }) {
  const html = String(text || "").split(/\n{2,}/)
    .map((b) => `<p>${esc(b).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")}</p>`).join("");
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Book style index tabs down the side of the flashcards, one per subject. */
export function Tabs({ tab, onPick }) {
  return (
    <nav className="fc-tabs" aria-label="Choose a subject">
      {COURSES.filter((c) => !c.soon).map((c) => (
        <button key={c.id} className={tab === c.id ? "is-on" : ""} style={{ "--tab": c.accent }}
          aria-pressed={tab === c.id} onClick={() => onPick(c.id)}>
          {c.name}
        </button>
      ))}
    </nav>
  );
}

function Top({ course, mi, right }) {
  return (
    <div className="dt-card-top">
      <span className="dt-sect">Module {mi + 1} of {course.modules.length}</span>
      {right && <span className="dt-prog">{right}</span>}
    </div>
  );
}

function Progress({ pos, total }) {
  return <div className="dt-bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={pos}
    aria-label="Course progress"><span style={{ width: `${(100 * pos) / total}%` }} /></div>;
}

/** The course's contents: resume, or start any module (exam domain). */
export function Contents({ course, pos, best, onStart, onResume }) {
  const total = course.seq.length;
  return (
    <div className="dt-card">
      <div className="dt-card-top"><span className="dt-sect">Contents</span><span className="dt-prog">{course.lessons.length} lessons</span></div>
      <h4 className="dt-big">{course.name}</h4>
      <p className="dt-hint">{course.id === "ai-security" ? "A short course on how AI apps are attacked and defended." : `Follows the official outline for ${course.title}.`} Start at the top, or pick a module.</p>
      <ol className="dt-toc">
        {course.modules.map((m, mi) => {
          const a = course.starts[mi], b = course.starts[mi + 1] ?? total - 1;
          const pct = Math.round(100 * Math.min(1, Math.max(0, ((best[mi] || 0) - a) / (b - a))));
          return (
            <li key={m.title}>
              <button onClick={() => onStart(a)}>
                <span>{m.title}</span>
                <span className="dt-pct">{pct ? `${pct}%` : `${m.lessons.length} lessons`}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <Progress pos={pos} total={total} />
      <div className="dt-actions"><button className="dt-btn" onClick={onResume} autoFocus>{pos ? "Carry on where I left off" : "Start from the beginning"}</button></div>
    </div>
  );
}

/** A teaching card: module intro, one step of a lesson, a recap before a retry, or the finish. */
export function CourseCard({ course, card, pos, onDone }) {
  let body;
  if (card.kind === "intro") {
    const m = course.modules[card.mi];
    body = (
      <>
        <div className="dt-card-top"><span className="dt-sect">Module {card.mi + 1} of {course.modules.length}</span><span className="dt-prog">New module</span></div>
        <h4 className="dt-big">{m.title}</h4>
        <Md text={m.intro} className="dt-short" />
        <ol className="dt-plan">{m.lessons.map((l) => <li key={l.title}>{l.title}</li>)}</ol>
      </>
    );
  } else if (card.kind === "step") {
    const l = course.lessons[card.li];
    const [title, text] = l.steps[card.si];
    body = (
      <>
        <Top course={course} mi={l.mi} right={`Lesson ${l.no}: step ${card.si + 1} of ${l.steps.length}`} />
        <p className="dt-lesson">{l.title}</p>
        <h4>{title}</h4>
        <Md text={text} className="dt-short" />
      </>
    );
  } else if (card.kind === "recap") {
    const l = course.lessons[card.li];
    body = (
      <>
        <Top course={course} mi={l.mi} right="Recap" />
        <p className="dt-lesson">{l.title}</p>
        <h4>Remember this</h4>
        <p className="dt-key">{l.key}</p>
        <p className="dt-hint">The next card brings this lesson's question back.</p>
      </>
    );
  } else {
    body = (
      <>
        <div className="dt-card-top"><span className="dt-sect">Course complete</span></div>
        <h4 className="dt-big">You've finished {course.name}</h4>
        <p className="dt-short">That's every module: {course.modules.map((m) => m.title).join(", ")}. Next starts the course again from the top, or pick another subject.</p>
      </>
    );
  }
  return (
    <div className="dt-card">
      {body}
      <Progress pos={pos} total={course.seq.length} />
      <div className="dt-actions"><button className="dt-btn" onClick={onDone} autoFocus>Next</button></div>
    </div>
  );
}

/** The check that ends a lesson. Options are shuffled each time it is shown. */
export function QuizCard({ course, li, review, pts, pos, onAnswer, onDone }) {
  const l = course.lessons[li], c = l.check;
  const order = useMemo(() => c.options.map((_, i) => i).sort(() => Math.random() - 0.5), [c]);
  const [pick, setPick] = useState(null);
  const done = pick !== null;
  const choose = (i) => { if (done) return; setPick(i); onAnswer(i === c.answer); };
  return (
    <div className="dt-card">
      <Top course={course} mi={l.mi} right={review ? "Second try" : "Check your understanding"} />
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
          <Progress pos={pos} total={course.seq.length} />
          <div className="dt-actions"><button className="dt-btn" onClick={onDone} autoFocus>Next</button></div>
        </>
      )}
    </div>
  );
}

export function Settings({ s, set, onReset, onClose, course }) {
  return (
    <div className="dt-card dt-settings">
      <div className="dt-card-top">
        <span className="dt-sect">Settings</span>
        <button className="dt-x" onClick={onClose} aria-label="Close">×</button>
      </div>
      <label className="dt-check"><input type="checkbox" checked={s.sound} onChange={(e) => set({ sound: e.target.checked })} /> Sound</label>
      <p className="dt-hint">{course ? "Progress is saved in this browser only." : "Keyboard: arrow keys to aim, Space to throw."}</p>
      {course && <button className="dt-btn ghost danger" onClick={onReset}>Start this subject again</button>}
    </div>
  );
}
