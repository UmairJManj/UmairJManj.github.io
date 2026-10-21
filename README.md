Live: https://umairjmanj.github.io

## Darts: learn security by playing

The home page's side panel is a darts game that teaches, one card per throw.

**How it plays**
- A regulation board on a 2D canvas (`src/darts/game.js`). The crosshair sways like a real hand; let go to throw. Wind comes in after the first few throws and pushes the dart sideways, so you aim upwind. Keyboard: arrow keys aim, Space throws.
- Book style tabs down the side of the panel pick what to learn: **Play** (just darts), an AI security course, and one course per certification (SC-900, AI1, SecAI+, AI-901, governance frameworks, SC-300, SC-200, SC-500, SC-100). On a phone the tabs become a row above the panel.

**The courses** (`public/courses/<id>.json`, format and checks in `src/darts/courses.js`)
- Each certification course follows its official skills outline (`content-build/outlines/`): one module per exam domain, every objective taught from zero, with one fictional organisation as a running example.
- Picking a tab opens the course contents. Carry on, or start any module. Then each throw shows the next card: a module intro, a lesson in a few steps, then one question. A wrong answer brings a recap and a second try a few cards later. Each course keeps its own place.
- `node src/darts/courses.js` checks every course file. `node src/darts/game.js` checks the scoring.
- Progress is stored only in the visitor's browser (localStorage).

`content-build/` also holds the older certification question bank the courses drew facts from. The game does not load it.
