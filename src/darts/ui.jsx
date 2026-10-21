/* Small presentational pieces for the darts panel. */
import { useState } from "react";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Tiny, safe markdown: **bold**, `code`, "- " bullets, blank-line paragraphs. */
export function Md({ text, className }) {
  const blocks = String(text || "").split(/\n{2,}/);
  const inline = (s) => esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  const html = blocks.map((b) => {
    const lines = b.split("\n");
    if (lines.every((l) => /^\s*[-•]\s+/.test(l))) {
      return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*[-•]\s+/, ""))}</li>`).join("")}</ul>`;
    }
    return lines.map((l) => (/^\s*[-•]\s+/.test(l) ? `<span class="md-li">${inline(l.replace(/^\s*[-•]\s+/, ""))}</span>` : inline(l))).join("<br>").replace(/^/, "<p>") + "</p>";
  }).join("");
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function Diagram({ d }) {
  if (!d) return null;
  if (d.kind === "compare") {
    return (
      <div className="dt-dg dt-dg-table" role="img" aria-label="Comparison table">
        <table>
          <thead><tr>{d.cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>{d.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
        </table>
      </div>
    );
  }
  const items = d.items || [];
  if (d.kind === "stack") {
    return (
      <div className="dt-dg dt-dg-stack" role="img" aria-label={`Layers: ${items.join(", ")}`}>
        {items.map((it, i) => <div key={i} style={{ opacity: 1 - i * 0.07 }}>{it}</div>)}
      </div>
    );
  }
  return (
    <div className={`dt-dg dt-dg-flow ${d.kind === "cycle" ? "is-cycle" : ""}`} role="img"
      aria-label={`${d.kind === "cycle" ? "Cycle" : "Flow"}: ${items.join(" then ")}`}>
      {items.map((it, i) => (
        <span key={i} className="dt-dg-step">
          <span className="dt-dg-box">{it}</span>
          {(i < items.length - 1 || d.kind === "cycle") && <span className="dt-dg-arrow" aria-hidden>{i < items.length - 1 ? "→" : "↺"}</span>}
        </span>
      ))}
    </div>
  );
}

export function LessonCard({ lesson, review, domain, deep, setDeep, onDone, doneLabel, n, total }) {
  if (!lesson) return null;
  return (
    <div className="dt-card">
      <div className="dt-card-top">
        <span className="dt-sect">{review ? "Review · " : ""}{domain}</span>
        <span className="dt-prog">{n} / {total}</span>
      </div>
      <h4>{lesson.title}</h4>
      <Md text={lesson.short} className="dt-short" />
      {deep && (
        <div className="dt-deep">
          <Md text={lesson.deep} />
          <Diagram d={lesson.diagram} />
          {lesson.terms?.length > 0 && (
            <dl className="dt-terms">
              {lesson.terms.map((t) => (<div key={t.t}><dt>{t.t}</dt><dd>{t.d}</dd></div>))}
            </dl>
          )}
          {lesson.example && <p className="dt-ex"><b>Example</b> {lesson.example}</p>}
          {lesson.trap && <p className="dt-trap"><b>Common mistake</b> {lesson.trap}</p>}
        </div>
      )}
      <div className="dt-actions">
        <button className="dt-btn ghost" onClick={() => setDeep(!deep)}>{deep ? "Show less" : "Go deeper"}</button>
        {onDone && <button className="dt-btn" onClick={onDone} autoFocus>{doneLabel}</button>}
      </div>
    </div>
  );
}

/** A check on the lesson just taught: single choice, multiple choice or yes/no statements. */
export function QuizCard({ q, title, pts, onAnswer, onDone }) {
  const [pick, setPick] = useState(() => (q.type === "yesno" ? q.statements.map(() => null) : []));
  const [ok, setOk] = useState(null);   // null until answered
  const done = ok !== null;
  const check = (p) => {
    const right = q.type === "yesno"
      ? q.statements.every((s, i) => p[i] === s.a)
      : p.length === q.answer.length && q.answer.every((a) => p.includes(a));
    setOk(right); onAnswer(right);
  };
  const choose = (i) => {
    if (done) return;
    if (q.type === "single") { setPick([i]); check([i]); }
    else setPick((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));
  };
  const ready = q.type === "yesno" ? pick.every((v) => v !== null) : pick.length > 0;
  return (
    <div className="dt-card">
      <div className="dt-card-top"><span className="dt-sect">Quick check</span><span className="dt-prog">{title}</span></div>
      {q.case && <p className="dt-case">{q.case}</p>}
      <h4>{q.stem}</h4>
      {q.type === "yesno" ? (
        <div className="dt-yn">
          {q.statements.map((s, i) => (
            <div key={i} className={`dt-yn-row ${done ? (pick[i] === s.a ? "is-right" : "is-wrong") : ""}`}>
              <span>{s.s}</span>
              {[true, false].map((v) => (
                <button key={String(v)} disabled={done} aria-pressed={pick[i] === v}
                  onClick={() => setPick((p) => p.map((x, j) => (j === i ? v : x)))}>{v ? "Yes" : "No"}</button>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="dt-opts">
          {q.options.map((o, i) => {
            const cls = !done ? (pick.includes(i) ? "is-picked" : "") : q.answer.includes(i) ? "is-right" : pick.includes(i) ? "is-wrong" : "";
            return <button key={i} className={cls} disabled={done} onClick={() => choose(i)} autoFocus={i === 0}>{o}</button>;
          })}
        </div>
      )}
      {!done && q.type !== "single" && (
        <div className="dt-actions"><button className="dt-btn" disabled={!ready} onClick={() => check(pick)}>Check</button></div>
      )}
      {done && (
        <>
          <p className={`dt-verdict ${ok ? "is-right" : "is-wrong"}`}>{ok ? `Correct. +${pts} points.` : "Not quite. This lesson comes back in a few cards."}</p>
          <Md text={q.explain} className="dt-short" />
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
      <button className="dt-btn ghost danger" onClick={onReset}>Start the flashcards again</button>
    </div>
  );
}
