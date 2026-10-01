**English** | [한국어](README_KO.md)

# FEENTS Janggi

An AI janggi game that runs in the browser, built with React + Vite and Fairy-Stockfish WASM. Moves, AI search, and rule evaluation all run in the browser, with no game server or external AI API required.

## Running and deploying

Requires Node.js 22.12 or later. Engine binaries are included in the repository, so Emscripten is not needed for normal development or deployment.

```sh
npm ci
npm run dev
```

The default URL is `http://127.0.0.1:5173`. The local development and preview servers both provide COOP and COEP headers.

```sh
npm test
npm run build
npm run preview
```

Copy `dist/` to the nginx web root and apply `deploy/nginx.conf`. Production must be served over **HTTPS**. The example nginx configuration is an HTTP static server block intended to sit behind a proxy that terminates TLS. For a public service, configure HTTPS at the proxy or add TLS configuration to nginx. Keep `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` on document and Worker responses, and serve `.wasm` files as `application/wasm`. Engine requests must not fall back to HTML.

A modern browser with WASM SIMD, Worker, and SharedArrayBuffer support is required. Local localhost and 127.0.0.1 addresses can be tested over HTTP. Some in-app browsers do not provide shared memory; users are prompted to open the game in a regular browser. Actual UI testing has been performed in Chrome. Testing on Safari and Firefox devices remains separate work.

## Game features

On desktop, undo, pass, new game, and turn information sit above the move record on the right, leaving more screen height for the board. On narrow screens, the controls and move record follow the board.

The defaults are 5 minutes, bikjang off, material adjudication on, and repetition restriction on. For both sides, the formation choices appear in this order: Elephant–Horse–Elephant–Horse (상마상마) → Horse–Elephant–Horse–Elephant (마상마상) → Horse–Elephant–Elephant–Horse (마상상마) → Elephant–Horse–Horse–Elephant (상마마상). The initial selections are Elephant–Horse–Elephant–Horse for Cho and Horse–Elephant–Horse–Elephant for Han. Switching your side preserves each side's selected formation while exchanging the human and AI roles.

- Choose Cho or Han; your pieces always appear at the bottom. Cho moves first, so the AI opens when you choose Han. Each side has four formation choices.
- Captured opponent pieces are collected below each player's information. Pieces retain their SVG elements in ID order and move from their previous positions over approximately 180 ms using the Web Animations API. When you step through a replay quickly, the next animation continues from the current onscreen position toward the new destination. Captured pieces move to the capture area over approximately 240 ms. Animations are skipped when the operating system's reduced motion setting is enabled.
- Click or tap a piece to see its legal destinations. Arrow keys and Enter or Space also support piece selection and moves. The last move, check, captures, and material scores update immediately.
- AI levels from 18 geup to 9 dan adjust both the engine Skill Level and thinking time per move. These are **opponent difficulty levels within the game**, not certified playing strengths or guaranteed ranks. Thinking time is approximately 0.18–3.5 seconds and depends on device performance and remaining time.
- The game provides move records, passing, starting a new game after resigning, and results for checkmate, draws, time forfeits, and material adjudication. At the end of a game, a central result dialog clearly shows victory, defeat, or a draw, the reason, and the final scores, then offers a replay or a new game.
- Main time ranges from 0 to 60 minutes; overtime offers 1–5 periods of 10–60 seconds each. Setting main time to 0 starts overtime immediately. A period is consumed when its countdown expires, and a legal move resets the countdown for the remaining period. Actual elapsed time is accounted for even when a hidden tab delays timer callbacks.
- Undo returns to the position before your most recent move. It takes back one move while the AI is searching, or two after the AI has replied, and restores both clocks and repetition history. If you choose Han and only the AI's opening move has been played, undo is unavailable. The allowance is 0–10 undos or unlimited; the count of undos used is not rolled back.
- An engine error pauses the clock, and retry restores the same move history. Undo, a new game, resignation, the end of a game, or leaving the page terminates existing Workers and searches and discards late responses.

Settings and games are held only in the current page's memory. Refreshing returns to a new game. The blurred opening screen, FEENTS header, wooden board, cursive Cho lettering, regular-script Han lettering, and rendering after local fonts finish loading are retained.

## Game results and replay

Select `복기하기` (Review) in the result dialog to replay the game from its initial position. Controls include first, previous, next, and last move buttons, a move selection slider, and selection from the move record. `자동 재생` (Autoplay) advances one move every 0.9 seconds and stops at the final move. On mobile, replay controls are fixed to the bottom of the screen so they remain accessible while viewing the board.

Replay shows the board, captured pieces, scores, and clocks immediately after each move. A pass is also recorded as a move, and check and last-move indicators reflect the selected position. Replay does not execute moves or run AI searches. Time elapsed immediately before the game ended appears in the final result view; each move's clock state appears in replay. `복기 종료` (Exit review) returns to the actual final position.

Resigning also opens the result dialog first. If you cancel the settings dialog opened by `새 게임 시작` (New game), the completed game's board and replay history are preserved. They are cleared, along with the capture areas, only when you actually start the new game. Saving across refreshes and exporting move records to a separate file are not supported.

## Rule options

| Option | Behavior |
| --- | --- |
| Bikjang on | When the generals face each other, the opponent must break the facing position or accept a draw by passing. |
| Bikjang off | Facing generals alone do not constitute check or end the game, and the position may remain. |
| Material adjudication on | If either side's **material score excluding compensation** falls below 10 points, total scores determine the winner. Han's 1.5-point compensation is included in the comparison. Play continues at 10 points; 9 points triggers adjudication. Checkmate takes precedence. |
| Repetition restriction on | A move that produces the same piece placement and side to move for the third time is prohibited. The initial position counts as the first occurrence. |
| Repetition restriction off | Repetition alone does not cause a draw or prohibit a move. |

Two consecutive passes result in a draw. Passing while in check is prohibited, but accepting bikjang follows the engine's bikjang rules. Terminal results from consecutive passes or bikjang acceptance take precedence over the repetition restriction. The base engine's default 50-move, automatic repetition, and insufficient-material draws are not used in this game variant.

Piece values are 13 for a chariot, 7 for a cannon, 5 for a horse, 3 for an elephant or guard, 2 for a soldier, and 0 for a general. Cho starts at 72 points; Han starts at 73.5 including compensation. Both scores and Han's compensation are displayed regardless of the material adjudication setting.

## Engine architecture and rebuilding

`public/engine/ffish.js` and `ffish.wasm` evaluate rules; `stockfish.js` and `stockfish.wasm` perform AI search. Both use the same source and custom rule patch for eight variants. The AI receives the initial FEN and complete move history. Every returned move is checked against the rule engine's legal move list. Separate rule and AI Workers keep the UI responsive during searches.

The AI uses Classical evaluation (`Use NNUE=false`) and runs without downloading an additional NNUE model. Search uses Threads=1 and Hash=16 MiB. The pthread runtime requires shared memory and isolation headers. The declared initial WASM memory is 128 MiB for AI and 32 MiB for rules; these figures are not the total memory consumption.

The pinned upstream commit, Emscripten version, file sizes, and SHA-256 hashes are recorded in `engine/manifest.json`. Rule changes are stored in `engine/feents-rules.patch`; adjustments to message and output connections for newer Emscripten versions are in `scripts/patch-engine-glue.mjs`.

After activating an Emscripten 3.1.74 environment, rebuild both engines with the following commands. Network access to download the GitHub source, along with make, patch, curl, and Node.js, is required.

```sh
source /path/to/emsdk/emsdk_env.sh
bash scripts/build-engine.sh
npm test
npm run build
```

The build script downloads the pinned source into a temporary directory, applies patches, and replaces the assets and manifest only after both engine builds succeed. Normal app builds do not run this process.

## Verification scope

`npm test` runs 71 tests covering formations and scoring, actual WASM rules and AI, time controls, and game state. The main checks include:

- All 256 initial combinations of sides, formations, and rules; coordinate/FEN round trips; and movement, blocking, captures, and palace restrictions for every piece type.
- Breaking, accepting, and disabling bikjang; consecutive passes; the 10↔9-point material threshold and compensation; checkmate precedence; repetition restrictions; and history restoration.
- Actual legal AI moves across 27 difficulty levels and eight rule variants, searches immediately before a repetition limit, and complete AI games from initial setup to the end.
- Overtime boundaries and delayed clock updates; moving first or second; zero, limited, and unlimited undo allowances; search cancellation; late responses after resignation or a new game; error recovery; and leaving the page.

Browser checks cover actual human moves and AI replies for both Cho and Han, undo during AI search and after a reply, keyboard moves, a 390 px mobile layout, passing, resignation, new games, and actual overtime expiry. Development and preview servers started for testing are stopped after verification.

## Design and assets

The shared header follows the `feents-design` skill and the [restaurant map](https://taste.feents.com) and [FIFA](https://fifa.feents.com) sites. Pretendard Variable and JetBrains Mono are served from `public/fonts/` without external CDN requests. Font licenses are included as `*-LICENSE.txt` files in the same directory.

Sides, pieces, and formations were referenced from [PyChess's janggi guide](https://www.pychess.org/variants/janggi). The wooden board and octagonal piece bodies are SVGs created for this project.

Piece lettering is derived from [Kadagaden's chess-pieces](https://github.com/Kadagaden/chess-pieces/tree/b035b0cc6a68e9fb99c872c8fe073c3ae3eba8a0/janggi_kakao_janggi_style_white) under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Lettering strokes were extracted from the 14 original pieces, effects were removed, and the viewBox, size, and colors were adjusted to fit the outlines. Glyph data is stored in `src/assets/janggi-glyphs.js`; author attribution, change notes, and the full license text are in `public/licenses/` and included in the build. No external assets are requested at runtime.

Local work reports are organized by date in `result_yyyyMMdd.html`. Result HTML files, `prompt.md`, `AGENTS.md`, and `docs/` are internal work records excluded from Git.
