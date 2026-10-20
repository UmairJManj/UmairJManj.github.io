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
        {onDone && <button className="h3d-btn" onClick={onDone}>{doneLabel}</button>}
      </div>
    </div>
  );
}

const LETTERS = "ABCDE";

export function QuizCard({ quiz, onTap, onSubmit, onOrderPick, tapMode, setTapMode }) {
  const { q, perm, selected, yi, yesno, order } = quiz;
  const need = q.type === "multi" ? q.answer.length : 1;
  return (
    <div className="h3d-card h3d-quiz">
      <div className="h3d-card-top">
        <span className="h3d-sect">Exam shot · {typeLabel(q)}</span>
        <span className="h3d-prog">{"●".repeat(q.difficulty)}{"○".repeat(3 - q.difficulty)}</span>
      </div>
      {q.case && <details className="h3d-case" open><summary>Case study</summary><p>{q.case}</p></details>}
      <p className="h3d-stem">{q.stem}</p>
      {q.code && <pre className="h3d-code"><code>{q.code}</code></pre>}

      {q.type === "yesno" && (
        <>
          <ol className="h3d-yn">
            {q.statements.map((s, i) => (
              <li key={i} className={i === yi ? "is-now" : yesno[i] === undefined ? "" : "is-done"}>
                <span>{s.s}</span>
                {yesno[i] !== undefined && <b>{yesno[i] ? "Yes" : "No"}</b>}
              </li>
            ))}
          </ol>
          <p className="h3d-hint">Statement {yi + 1} of 3: sink <b>YES</b> or <b>NO</b>.</p>
          {tapMode && (
            <div className="h3d-actions">
              <button className="h3d-btn" onClick={() => onTap(0)}>Yes</button>
              <button className="h3d-btn" onClick={() => onTap(1)}>No</button>
            </div>
          )}
        </>
      )}

      {q.type === "order" && (
        <>
          <p className="h3d-hint">Tap the steps in order, then sink the <b>GO</b> hoop.</p>
          <ul className="h3d-opts">
            {perm.map((oi) => {
              const pos = order.indexOf(oi);
              return (
                <li key={oi}>
                  <button className={`h3d-opt ${pos >= 0 ? "is-on" : ""}`} onClick={() => onOrderPick(oi)}>
                    <span className="h3d-letter">{pos >= 0 ? pos + 1 : "·"}</span>{q.options[oi]}
                  </button>
                </li>
              );
            })}
          </ul>
          {tapMode && <div className="h3d-actions"><button className="h3d-btn" disabled={order.length !== q.options.length} onClick={onSubmit}>Submit</button></div>}
        </>
      )}

      {(q.type === "single" || q.type === "complete" || q.type === "multi") && (
        <>
          <ul className="h3d-opts">
            {perm.map((oi, i) => (
              <li key={oi}>
                <button className={`h3d-opt ${selected.includes(i) ? "is-on" : ""}`} onClick={() => tapMode && onTap(i)}
                  aria-disabled={!tapMode} tabIndex={tapMode ? 0 : -1}>
                  <span className="h3d-letter">{LETTERS[i]}</span>{q.options[oi]}
                </button>
              </li>
            ))}
          </ul>
          <p className="h3d-hint">
            {q.type === "multi"
              ? <>Sink each answer you choose ({selected.length}/{need}), then {tapMode ? "submit" : "tap Submit"}.</>
              : <>Sink the hoop with your answer.</>}
          </p>
          {q.type === "multi" && (
            <div className="h3d-actions"><button className="h3d-btn" disabled={selected.length !== need} onClick={onSubmit}>Submit</button></div>
          )}
        </>
      )}
      <button className="h3d-link" onClick={() => setTapMode(!tapMode)}>{tapMode ? "Shoot to answer" : "Tap to answer instead"}</button>
    </div>
  );
}

export function typeLabel(q) {
  return { single: "choose one", multi: `choose ${q.answer?.length || 2}`, yesno: "yes / no", order: "put in order", complete: "complete the code" }[q.type] || q.type;
}

export function Feedback({ fb, onNext, onReview }) {
  const { q, correct, perm, given } = fb;
  let answer = null;
  if (q.type === "yesno") answer = q.statements.map((s, i) => `${i + 1}. ${s.a ? "Yes" : "No"}`).join("  ");
  else if (q.type === "order") answer = q.options.map((o, i) => `${i + 1}. ${o}`).join("\n");
  else answer = q.answer.map((a) => `${LETTERS[perm.indexOf(a)]}. ${q.options[a]}`).join("\n");
  return (
    <div className={`h3d-card h3d-fb ${correct ? "is-right" : "is-wrong"}`}>
      <div className="h3d-card-top">
        <span className="h3d-sect">{correct ? "Correct" : "Not quite"}</span>
        {given?.length > 0 && !correct && q.type !== "yesno" && q.type !== "order" && (
          <span className="h3d-prog">you chose {given.map((g) => LETTERS[g]).join(", ")}</span>
        )}
      </div>
      <p className="h3d-answer">{answer}</p>
      <Md text={q.explain} className="h3d-short" />
      <div className="h3d-actions">
        <button className="h3d-btn ghost" onClick={onReview}>Review lesson</button>
        <button className="h3d-btn" onClick={onNext} autoFocus>Next shot</button>
      </div>
    </div>
  );
}

export function ProgressView({ m, track, content, onClose }) {
  return (
    <div className="h3d-card h3d-progress">
      <div className="h3d-card-top">
        <span className="h3d-sect">{track.code} mastery</span>
        <button className="h3d-x" onClick={onClose} aria-label="Close">×</button>
      </div>
      <div className="h3d-big">{Math.round(m.overall * 100)}%</div>
      <p className="h3d-hint">Weighted by the exam's domain weights. 100% means every question answered right three times across spaced reviews.</p>
      {m.domains.map((d) => (
        <div className="h3d-bar" key={d.id}>
          <div className="h3d-bar-top"><span>{d.name}</span><span>{d.weight}</span></div>
          <div className="h3d-bar-track"><div style={{ width: `${Math.round(d.pct * 100)}%` }} /></div>
          <div className="h3d-bar-sub">{Math.round(d.pct * 100)}% · lessons {d.seen}/{d.lessons} · questions {d.answered}/{d.total}</div>
        </div>
      ))}
      {content?.sourceUrl && (
        <p className="h3d-hint">Built on the official outline: <a href={content.sourceUrl} target="_blank" rel="noopener">{content.outlineVersion || "skills measured"}</a>. Questions are original practice items, not real exam questions.</p>
      )}
    </div>
  );
}

export function ArenaPicker({ tracks, current, masteryOf, unlocked, onPick, onClose }) {
  return (
    <div className="h3d-card h3d-arenas">
      <div className="h3d-card-top">
        <span className="h3d-sect">Arenas · in exam order</span>
        <button className="h3d-x" onClick={onClose} aria-label="Close">×</button>
      </div>
      <ol>
        {tracks.map((t, i) => {
          const open = unlocked(i);
          return (
            <li key={t.id}>
              <button className={`h3d-arena ${i === current ? "is-on" : ""}`} disabled={!open} onClick={() => onPick(i)}
                style={{ "--arena": t.accent }}>
                <span className="h3d-arena-code">{t.code}</span>
                <span className="h3d-arena-name">{t.arena}<small>{t.name}</small></span>
                <span className="h3d-arena-m">{open ? `${Math.round((masteryOf(t.id) || 0) * 100)}%` : "Locked"}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="h3d-hint">The next arena opens at 60% mastery. You can unlock all in settings.</p>
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
      <fieldset>
        <legend>Mode</legend>
        <label><input type="radio" checked={!s.drill} onChange={() => set({ drill: false })} /> Learn: lesson every basket, exam shot every two</label>
        <label><input type="radio" checked={s.drill} onChange={() => set({ drill: true })} /> Endless drill: every shot is an exam question</label>
      </fieldset>
      <label className="h3d-check"><input type="checkbox" checked={s.sound} onChange={(e) => set({ sound: e.target.checked })} /> Sound</label>
      <label className="h3d-check"><input type="checkbox" checked={s.unlockAll} onChange={(e) => set({ unlockAll: e.target.checked })} /> Unlock all arenas</label>
      <p className="h3d-hint">Keyboard: ← → to aim, Space to shoot. Progress is saved in this browser only.</p>
      <button className="h3d-btn ghost danger" onClick={onReset}>Reset this arena's progress</button>
    </div>
  );
}
