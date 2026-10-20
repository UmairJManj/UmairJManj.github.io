# Writer brief (read fully before writing)

You write study content for a basketball learning game on Umair Javaid Manj's portfolio. After every basket the player gets a lesson card; later shots are exam-style questions answered by shooting the right hoop. The goal: a player who works through everything is genuinely job-ready and ready for the real exam, including the exact technical vocabulary.

1. Read `/home/claude/site/content-build/CONTENT_SCHEMA.md` (format + rules) and your exam's outline `/home/claude/site/content-build/outlines/<exam>.json` (only your assigned domain/objectives).
2. Lessons: cover EVERY bullet of your assigned objectives in outline order, one lesson per bullet (two for bullets that bundle several features). Explain from basics for a beginner but reach exam depth. Use the outline's key terms.
3. Questions: write your target count (±5%), spread across your objectives in proportion to their bullet count, each linked to a lesson. Follow the type mix and difficulty mix. Every question original. Make distractors real, plausible features — that's how Microsoft-style exams test.
4. Accuracy is the top priority. You have WebSearch/WebFetch: verify anything specific (licence tiers, role names, retention days, limits, defaults, cmdlet/KQL syntax, clause numbers) on official sources (learn.microsoft.com, nist.gov, privacy.org.nz, legislation.govt.nz, owasp.org, atlas.mitre.org…). If you can't verify a detail, don't test it.
5. Write files in batches: `/home/claude/site/content-build/parts/<exam>/<domain><suffix>-<n>.json` (n=1,2,…; ~25–40 questions per file; put all lessons in file 1 or spread them, either is fine). Use the Write tool. Use the id prefixes given in your assignment so ids never collide with other writers.
6. When done, validate: `python3 /home/claude/site/content-build/validate.py <exam>` and fix every error it reports in YOUR files.
7. Then re-read your own questions once as a strict examiner: wrong keys, ambiguous stems, two defensible answers, outdated names. Fix them.
8. Final report: 3 lines max — files written, lesson count, question count by type, anything you couldn't verify.
