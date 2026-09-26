# Roadmap

Product intent. Not law. Current behavior is `AGENTS.md` + `DECISIONS.md`.

Home shows three player modes:

1. **Solo** (exists)
2. **Multijugador** (exists as live + async under the hood; hide that split)
3. **Reto semanal** — new mode. Until the board/votes exist, it can sit on Home as a temporary entry that uses a small week deck (not the full core pile).

Plus a builder tool, not a player mode on production:

4. **Taller** — preview deployments only. Edit the temporary week deck, fix typos, add/remove cards, export JSON.

## Multijugador (next)

- One button. No Async label.
- Create with **2–8** seats.
  - 2 players: always vote. Each can read the other fill and vote.
  - 3–8: host picks Zar (power moves) or everyone votes.
- One room code. Close the browser, come back as the same seat (saved seat + “soy este jugador” / per-seat link). Claim a hung seat from another browser if that player is gone.
- Home multi: rooms with free seats **and** join-by-code on the same screen.
- Show who has answered or discarded. Never bind a revealed fill to a name. Each voter gets a **different random order** of the same fills.
- Discard every multiple of 5 in multi too (Zar included), own turn, show who discarded and how many. Only after sync fixtures exist.
- Stop the extra remount when entering a match.
- Optional stable beta URL: Vercel project `guerrillacardsbeta`. Until then, `preview/…` branches.

Internal `async` code stays as the seed for a later notice-style multi (turn list, “te toca”, chat). Do not show it as a mode.

## Reto semanal (new mode)

Visitor mode with a **temporary** week deck — not the lifelong core packs.

- Small actualidad pile (news / week hooks). Swap the file when the week changes.
- Limited rounds per person per week (scarcity). After the cap: read + upvote only.
- Collect fills (prompt + answer). Public board, upvote.
- New week → new temporary deck → same cap.
- Home may show the mode early (even a stub / “esta semana”) so the third slot exists. Do not ship votes + board in the same change as multi cleanup.

Suggested data shape later: `deck/reto/` one file per week (example `2026-W38.json`), pointed at by a tiny `deck/reto/current.json`. Taller writes that file; production only reads `current`.

## Taller (preview only)

A simple workshop to correct the temporary baraja before it goes public.

- Visible on **Vercel Preview** (and local), not on `guerrillacards.vercel.app`.
- List cards of the current week deck: edit text, pick, add, hide.
- Mark a line as error / typo and fix it in place.
- Export JSON (same card shape `{id,type,text,pick}`) to commit into `deck/reto/`.
- Reuse the idea of local patches (`src/engine/patches.ts` / AdminPanel) but scoped to the week deck — do not dump taller edits into `core.json` by default.
- Production Home does not show Taller. No PIN on the public site.
