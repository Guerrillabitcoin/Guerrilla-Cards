# Architecture

## Runtime

- Expo 57 + Expo Router + TypeScript + React 19 + RN 0.86.
- Web export is static: `npx expo export -p web` → `dist` (see `vercel.json`).
- Vercel project: `guerrillacards`.
- Production domain: `https://guerrillacards.vercel.app`.
- Production deploys from `main`. Other branches → preview URLs.

## Screens (`app/`)

| Route | Role |
|-------|------|
| `index.tsx` | Home: create / join / packs / mode |
| `lobby.tsx` | Seats, nicknames, start |
| `play.tsx` | Match UI (submitting, judging, reveal, discard). Largest file. |
| `results.tsx` | Ranking + rematch |
| `historial.tsx` | Favorite fills + card stats |
| `compartir.tsx` | Share image/text of a filled prompt |

Providers wrap the stack in `app/_layout.tsx`: Theme, Admin, Game, History.

## Engine (`src/engine/`)

UI-free. All match RNG should happen at create/restart.

| File | Role |
|------|------|
| `types.ts` | Card, GameState, phases, constants (`HAND_SIZE=12`, seats, discard gates) |
| `deck.ts` | Load packs, banned filter, dedupe, shuffle, prompt/answer piles |
| `game.ts` | create / start / submit / judge / next round / solo rivals / discard |
| `glue.ts` | Fill `_` blanks with answers for display + share |
| `patches.ts` | Local admin edits/adds on top of JSON packs |
| `nicknames.ts` | Default funny nicks |
| `syncProgress.ts` | Monotonic round+phase rank for online merge |

## Store (`src/store/`)

| File | Role |
|------|------|
| `GameContext.tsx` | Local games map, slim persist, hydrate decks, async push/pull apply |
| `roomSync.ts` | Web `/api/room` client, seat lock, redaction, hand merge |
| `HistoryContext.tsx` | Winning combos, favorites, per-card stats |
| `AdminContext.tsx` | Local deck patches |
| `ThemeContext.tsx` | Classic / Guerrilla / Oscuro |

Persist key: `guerrilla_cards_games_v1`. Decks are stripped before write and rebuilt on load.

## Online room (`api/room.js`)

- Vercel serverless + KV / Upstash.
- Actions: `join` (server assigns seat + unique nick), `upsert` (merge state).
- Client poll in `app/play.tsx` every 2.5s when the online flag is set.
- Early phases redact other players' submission text (`…`). Hands published at deal, then only own hand mid-round.
- `gameProgress` must treat reveal → next submitting as forward, not a downgrade.

## Deck (`deck/`)

- `manifest.json` lists packs + counts (deck format 1.3.0).
- `rules.json` house rules (not all implemented).
- `packs/*.json` — playable theme files + `_banned.json`.
- Engine statically imports every pack file today (bundle cost).
