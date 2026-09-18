# Roadmap

Product intent. Not law. Current behavior is `AGENTS.md` + `DECISIONS.md`.

Home should show only three things:

1. **Solo** (exists)
2. **Multijugador** (exists as live + async under the hood; hide that split)
3. **Reto semanal** (not built)

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

## Reto semanal (later)

A visitor mode, not a full match type.

- Small deck of **actualidad** cards (news / week hooks), not the whole core pile.
- Limited rounds per person per week (scarcity). When the cap is hit, you can read and upvote, not keep farming fills.
- Collect player fills (prompt + answer text). Public board: upvote the funniest.
- Replay hook: new week → new prompts → same scarcity.
- Do not ship this in the same change as multi cleanup.
