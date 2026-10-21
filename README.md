Live: https://umairjmanj.github.io

## Darts: learn AI security by playing

The home page's side panel is a darts game that teaches a short AI security course, one card per throw.

**How it plays**
- A regulation board on a 2D canvas (`src/darts/game.js`). The crosshair sways like a real hand; let go to throw. Wind comes in after the first few throws and pushes the dart sideways, so you aim upwind. Keyboard: arrow keys aim, Space throws.
- Every throw shows the next card of the course. Correct answers add 10 points to the darts score.

**The course** (`src/darts/curriculum.js`)
- Eight modules in order: how an AI app works, thinking like an attacker, prompt injection, unsafe output and excessive agency, data leakage and privacy, poisoning and the supply chain, attacks on the model, and defending and governing AI.
- One running example, Ava, a travel company's assistant, carries through every module.
- Each module opens with an intro card. Each lesson is taught in three step cards, then one question. A wrong answer brings a recap card and the same question back a few cards later.
- `node src/darts/curriculum.js` checks the course and `node src/darts/game.js` checks the scoring.
- Progress is stored only in the visitor's browser (localStorage).

`content-build/` holds an older bank of certification practice questions. The game no longer uses it.
