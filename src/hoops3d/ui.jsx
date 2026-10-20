/* Small presentational pieces for the Hoops 3D panel. */

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
      <div className="h3d-dg h3d-dg-table" role="img" aria-label="Comparison table">
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
      <div className="h3d-dg h3d-dg-stack" role="img" aria-label={`Layers: ${items.join(", ")}`}>
        {items.map((it, i) => <div key={i} style={{ opacity: 1 - i * 0.07 }}>{it}</div>)}
      </div>
    );
  }
  return (
    <div className={`h3d-dg h3d-dg-flow ${d.kind === "cycle" ? "is-cycle" : ""}`} role="img"
      aria-label={`${d.kind === "cycle" ? "Cycle" : "Flow"}: ${items.join(" then ")}`}>
      {items.map((it, i) => (
        <span key={i} className="h3d-dg-step">
          <span className="h3d-dg-box">{it}</span>
          {(i < items.length - 1 || d.kind === "cycle") && <span className="h3d-dg-arrow" aria-hidden>{i < items.length - 1 ? "→" : "↺"}</span>}
        </span>
      ))}
    </div>
  );
}

export function LessonCard({ lesson, review, domain, deep, setDeep, onDone, doneLabel, n, total }) {
  if (!lesson) return null;
  return (
    <div className="h3d-card">
      <div className="h3d-card-top">
        <span className="h3d-sect">{review ? "Review · " : ""}{domain}</span>
        <span className="h3d-prog">{n} / {total}</span>
      </div>
      <h4>{lesson.title}</h4>
      <Md text={lesson.short} className="h3d-short" />
      {deep && (
        <div className="h3d-deep">
          <Md text={lesson.deep} />
          <Diagram d={lesson.diagram} />
          {lesson.terms?.length > 0 && (
            <dl className="h3d-terms">
              {lesson.terms.map((t) => (<div key={t.t}><dt>{t.t}</dt><dd>{t.d}</dd></div>))}
            </dl>
          )}
          {lesson.example && <p className="h3d-ex"><b>Example</b> {lesson.example}</p>}
          {lesson.trap && <p className="h3d-trap"><b>Exam trap</b> {lesson.trap}</p>}
        </div>
      )}
      <div className="h3d-actions">
        <button className="h3d-btn ghost" onClick={() => setDeep(!deep)}>{deep ? "Show less" : "Go deeper"}</button>
        {onDone && <button className="h3d-btn" onClick={onDone} autoFocus>{doneLabel}</button>}
      </div>
    </div>
  );
}

export function Settings({ s, set, onReset, onClose }) {
  return (
    <div className="h3d-card h3d-settings">
      <div className="h3d-card-top">
        <span className="h3d-sect">Settings</span>
        <button className="h3d-x" onClick={onClose} aria-label="Close">×</button>
      </div>
      <fieldset>
        <legend>Controls</legend>
        <label><input type="radio" checked={s.control === "flick"} onChange={() => set({ control: "flick" })} /> Flick to shoot</label>
        <label><input type="radio" checked={s.control === "meter"} onChange={() => set({ control: "meter" })} /> Hold, aim and release (power meter)</label>
      </fieldset>
      <label className="h3d-check"><input type="checkbox" checked={s.sound} onChange={(e) => set({ sound: e.target.checked })} /> Sound</label>
      <p className="h3d-hint">Keyboard: ← → to aim, Space to shoot. Progress is saved in this browser only.</p>
      <button className="h3d-btn ghost danger" onClick={onReset}>Start the flashcards again</button>
    </div>
  );
}
