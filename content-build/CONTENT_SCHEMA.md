# Content part files

Write to `content-build/parts/<examId>/<domainId>-<n>.json` (n = 1, 2, 3… one file per batch of
about 25–40 questions, so no single write is huge). Each file is ONE JSON object, valid JSON, no comments:

```json
{
  "exam": "sc-900",
  "domain": "d1",
  "lessons": [ LESSON, ... ],
  "questions": [ QUESTION, ... ]
}
```

## LESSON (one per outline bullet, sometimes two for big bullets)
```json
{
  "id": "sc-900.d1.1.03",            // exam.objective.NN, unique across the exam
  "objective": "d1.1",                // objective id from the outline file
  "seq": 3,                           // order inside the objective (teach in outline order)
  "title": "Shared responsibility model",
  "short": "2–3 sentences, max ~55 words, plain English, uses the exact technical terms.",
  "deep": "A fuller explanation, 120–220 words. Explain from basics, define jargon, give the mechanism, how Microsoft names it, defaults/limits/licensing where examinable. Markdown allowed: **bold**, `code`, line breaks with \n, simple '- ' bullet lines.",
  "terms": [ { "t": "IaaS", "d": "Infrastructure as a Service: provider runs hardware, you run OS and up." } ],   // 2–5 terms
  "trap": "One sentence: how the exam tests this and the common wrong answer.",
  "example": "One or two sentences: a realistic scenario.",
  "diagram": null                      // or a small structured diagram, see below; include one on roughly 1 in 3 lessons where it truly helps
}
```

### diagram (optional)
One of:
- `{ "kind": "flow", "items": ["User", "Entra ID", "Conditional Access", "App"] }`  — left-to-right steps (2–6 short labels, ≤ 18 chars)
- `{ "kind": "stack", "items": ["Data", "Apps", "OS", "Network", "Physical"] }` — layers, top to bottom (2–7)
- `{ "kind": "compare", "cols": ["IaaS", "PaaS", "SaaS"], "rows": [["You: OS", "Provider: OS", "Provider: OS"]] }` — small table (≤4 cols, ≤5 rows, cells ≤ 22 chars)
- `{ "kind": "cycle", "items": ["Prepare", "Detect", "Contain", "Recover"] }` — a loop (3–6)

## QUESTION
Every question is ORIGINAL (never copied from any exam, dump, or practice site), exam-style, scenario-based where possible, and tied to a lesson.
```json
{
  "id": "sc-900.d1.q017",
  "lesson": "sc-900.d1.1.03",          // the lesson that teaches it
  "objective": "d1.1",
  "difficulty": 1,                      // 1 recall, 2 apply, 3 scenario/analysis (≈ 35% / 45% / 20%)
  "type": "single",                     // single | multi | yesno | order | complete
  "case": null,                         // optional scenario paragraph (≤ 90 words) for case-study style; use on ~15% of questions
  "stem": "Question text.",
  "options": ["A text", "B text", "C text", "D text"],
  "answer": [2],                        // indices into options
  "explain": "Why the right answer is right AND why each tempting wrong one is wrong (≤ 70 words)."
}
```
Type rules:
- `single`: exactly 4 options, exactly 1 answer. Distractors must be plausible real Microsoft features/terms.
- `multi`: 4 or 5 options, 2 or 3 answers; stem says "Select TWO" / "Select THREE". `answer` sorted ascending.
- `yesno`: no `options`/`answer`; instead `"statements": [{ "s": "statement", "a": true }, ...]` with exactly 3 statements; stem like "For each statement, select Yes if true." Mix of true/false.
- `order`: `"options"` = the steps IN THE CORRECT ORDER (3–5 steps), `answer` omitted; the game shuffles them. Stem says "Put the steps in order."
- `complete`: a code/command completion (KQL for Sentinel/Defender, PowerShell/Graph/Azure CLI, Conditional Access JSON, etc.). Add `"code": "SigninLogs\n| where ResultType != 0\n| ____ count() by UserPrincipalName"` with exactly one `____` blank; 4 options; 1 answer. Use only where the exam domain truly involves code/queries. Code must be syntactically correct when the right option fills the blank.

Mix per domain (approx): single 50%, multi 15%, yesno 15%, order 8%, complete 12% (complete only where relevant; otherwise give that share to single).

Option text ≤ 110 chars; avoid "All of the above"/"None of the above"; vary the position of the correct answer evenly across A–D.

## Accuracy rules
- Use current Microsoft product names (Microsoft Entra ID not Azure AD, Microsoft Defender XDR, Microsoft Purview, Microsoft Sentinel, Microsoft Foundry, Security Copilot …) as used in the outline file.
- Facts about licensing, defaults, retention periods, role names, limits must be correct as of Oct 2026. When unsure, check learn.microsoft.com with WebSearch/WebFetch, or write the question so it doesn't depend on the uncertain detail.
- Paraphrase; never copy Microsoft Learn or ISO text verbatim beyond short term names.
