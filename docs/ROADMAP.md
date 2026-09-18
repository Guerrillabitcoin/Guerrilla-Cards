# Roadmap

Product intent. Not law. Current behavior is `AGENTS.md` + `DECISIONS.md`.
Point 10 in the source list was empty.

## Next product slice (multi, not a new “async” mode)

- Remove `async` from the UI. Keep the code path in mind as the seed for a later “Apalabrados-style” mode (notifications, my-games list, whose turn, chat). That later mode is multi + notices, not the current 4-seat async label.
- Multi = create with **2–8** seats.
  - 2 players: always `vote`. Each can read the other’s fill and vote.
  - 3–8: host picks Zar (power moves after the round) or everyone votes.
- Still share **one room code**. People close the browser and must return as the same seat (stored seat + explicit “soy este jugador” / per-seat link). A hung seat should be claimable from another browser if that player is gone.
- Multi home: open rooms with free seats **and** join-by-code on the same screen.
- Presence: who has answered / discarded and who has not. Never bind a revealed answer to a name. Each voter sees a **different random order** of the same fills.
- Discard every multiple of 5 in multi too (including Zar), as its own turn; show who discarded and how many cards. Same shape as solo. Only after sync fixtures exist — today this is disabled because it hung rooms.
- Separate Vercel project `guerrillacardsbeta` for a stable beta URL (optional; git preview branches work until then).
- Home remount / full reload on enter: find and stop the extra remount. Fluid, but no skipped turns.

## Later

- Notification multi (turn list, visual “te toca”, optional chat).
- Do not freeze later ideas into `AGENTS.md`.
