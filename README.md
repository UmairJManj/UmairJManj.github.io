Live: https://umairjmanj.github.io

## Hoops 3D: learn the certification path by playing

The home page's side panel is a 3D basketball game that teaches my certification path. Each exam is its own arena, in study order:

SC-900 → SC-300 → SC-200 → AI-901 → SC-500 → TryHackMe AI1 → SC-100 → CompTIA SecAI+ → AI & security governance (NIST AI RMF, ISO/IEC 42001 and 27001, NIST CSF 2.0, EU AI Act, NZ Privacy Act 2020 and HIPC).

**How it plays**
- Make a basket and you get the next lesson card, taught in the order of the official skills outline. Each card has a short version and a "go deeper" version with key terms, an exam trap, a real-world example and sometimes a diagram.
- Every second lesson sets up an exam shot. The answers hang over 2–5 hoops, and the hoop you sink is the answer you give. Formats follow the exams: choose one, choose two or three, yes/no statement sets, put steps in order, and complete the KQL/PowerShell/CLI line. Hard questions are taken from the three-point line.
- Smart review: wrong answers come back within minutes and their lesson is re-taught on the next basket. Right answers move up Leitner boxes (10 min, 1 day, 3, 7, 21 days).
- Mastery per exam domain, weighted by the exam's published domain weights. The next arena opens at 60%, or unlock all in settings.
- Endless drill mode turns every shot into an exam question.

**Physics and graphics**
- Three.js night arena, all procedural: maple floor and court lines painted in code, a pebbled ball, crowd, jumbotron, neon accents in each arena's colour, bloom.
- Physics in SI units (`src/hoops3d/physics.js`):
  - a FIBA size 7 ball with quadratic drag and backspin/side-spin Magnus lift;
  - impulse contacts with friction against a steel torus rim, which dips and wobbles on a spring;
  - a glass backboard that shakes;
  - a verlet-cloth net that the ball pushes through.
  - Wind and hoop sway come in as your streak grows.
- Controls are flick to shoot, or hold-aim-release with a power meter. Keyboard users aim with ← → and shoot with Space.
- Quality drops automatically on slow devices: first bloom goes, then shadows, then resolution. Adding `?h3dq=low` to the URL forces the lightest mode.

**Content**
- All questions are original practice items written against the official skills outlines (Microsoft Learn study guides, CompTIA CY0-001 objectives, TryHackMe's AI1 guide and the framework texts). They are not real exam questions.
- Every exam's bank was written, then checked again by a separate reviewer. Review logs are in `content-build/review/`.
- Source files live in `content-build/parts/<exam>/`. `python3 content-build/validate.py` checks them, and `python3 content-build/build_content.py` builds the packs the game loads from `public/hoops/content/`.
- Progress is stored only in the visitor's browser (localStorage).
