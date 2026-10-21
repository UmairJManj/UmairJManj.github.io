Live: https://umairjmanj.github.io

## Darts and security flashcards

The home page's side column has two panels.

**Darts** (`src/darts/game.js`, `DartsArena.jsx`): a regulation board on a 2D canvas. The crosshair sways like a real hand; let go to throw. Wind comes in after the first few throws and pushes the dart sideways, so you aim upwind. Keyboard: arrow keys aim, Space throws.

**Flashcards** (`src/darts/Flashcards.jsx`): security courses taught one card at a time. Book style tabs down the side are named for what each course teaches: securing AI systems, security, compliance and identity basics, AI fundamentals on Azure, AI and security governance, identity and access management, security operations and threat hunting, securing cloud and AI workloads, and cybersecurity architecture. On a phone the tabs become a row above the cards.
- Each certification course (`public/courses/<id>.json`) follows its official skills outline in `content-build/outlines/`: one module per exam domain, every objective taught from zero, with one fictional organisation as a running example.
- A tab opens the course contents: carry on, or start any module. Then Next moves through a module intro, a lesson in a few steps, and one question per lesson. A wrong answer brings a recap and a second try a few cards later. Each course keeps its own place.
- `node src/darts/courses.js` checks every course file. `node src/darts/game.js` checks the darts scoring.
- Progress is stored only in the visitor's browser (localStorage).

`content-build/` also holds the older certification question bank the courses drew facts from. The site does not load it.
