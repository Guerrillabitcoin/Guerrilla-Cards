# AGENTS.md — Guerrilla Cards

Read this before changing code. Product facts live here. Wishlist lives in `docs/ROADMAP.md`.

## Product

- Spanish party card game. Brand: **Guerrilla Cards** only.
- No Cards Against Humanity / Cartas Contra la Humanidad trademarks.
- No CAH stock card text.
- House rules text is in `deck/rules.json`. Documented variants are not all implemented.

## Version source of truth

- UI / release label: `src/version.ts` (`APP_VERSION`, currently `0.99`).
- Do not treat `package.json` or `app.json` as the shipped version until they are aligned.
- Bump `APP_VERSION` only when shipping a visible change.

## Layout

- `app/` — Expo Router screens (Home, Lobby, Play, Results, Historial, Compartir).
- `src/engine/` — deck + rules, UI-free.
- `src/store/` — AsyncStorage sessions + web room sync.
- `deck/` — JSON packs, `manifest.json`, `rules.json`.
- `api/` — Vercel `/api/room` and `/api/telemetry`.

## Modes (current code)

- `live` — pass-and-play on one device, 3–8 seats.
- `async` — 4 seats; on web this is the online room path (`/api/room`).
- `solo` — one human; 3 random rival fills from the answer pile after submit.
- Judge: `zar` or `vote`.
- Hand size: 12. Win token: Puntaco.

`docs/ROADMAP.md` may remove `async` from the UI later. Until that ships, `async` is the online mode.

## Do not touch in the same change as something else

- `api/room.js` merge / progress / join
- `src/store/GameContext.tsx` `applyRemoteGame` / persist / hydrate
- `src/store/roomSync.ts` `slimForRoom` / `mergeHandsPreserveLocal`
- `src/engine/syncProgress.ts`

These exist because of real races (wiped hands, stale submissions, false “ya contestaste”, hung discard). See `docs/DECISIONS.md`.

## Deck rules

- Never deal `_banned` ids.
- Merge selected packs; dedupe by `id` then normalized Spanish text; first pack wins.
- Shuffle **once** at create/restart. Draw with a cursor. Do not reshuffle on every draw.
- Size the pre-shuffled answer pile from a max-need calculation (players, rounds, pick, max discards, solo rivals). See `docs/DECISIONS.md`.
- When dealing to seats, do not give player 1 a systematic first-N advantage.

## Workflow

- One change = one goal.
- Implement on `preview/…`, not `main`.
- Production domain: `https://guerrillacards.vercel.app`.
- Preview URL is the live test. Do not `git push origin main` or `vercel --prod` to try an idea.
- After a visible ship, bump `APP_VERSION` in `src/version.ts` and add notes there.

## Verify

- `npm run typecheck`
- Solo smoke: create game, submit, next round, results.
- If room code changed: two browsers on the **preview** URL, same code, two seats.
