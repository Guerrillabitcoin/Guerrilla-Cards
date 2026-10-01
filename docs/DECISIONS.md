# Decisions (cicatrices)

Stable constraints. Do not “fix” these without an explicit issue. Wishlist belongs in `ROADMAP.md`.

## Brand and content

- Brand is Guerrilla Cards only. No CAH / Cartas Contra la Humanidad names or stock card text in the product.
- `_banned` ids are never dealt. Do not write banned ids back into playable packs.
- House variants in `rules.json` are documented flavor, not a promise that the engine implements them.

## Online / async (current)

- On web, `mode === 'async'` is the cross-device room. Native has no `/api/room` client (`Platform.OS !== 'web'` → no sync).
- Async lobby is exactly 4 seats until the roadmap ships 2–8 multi.
- Room state is a slim JSON in KV. Decks are not uploaded.
- Submission text from other seats is fogged (`…`) until judging.
- Mid-round upserts must not publish every hand (that clobbered peers). Publish all hands only on lobby / fresh deal.
- Never re-attach another player’s old submission after the Zar advanced. Only re-attach *my* in-progress answer when round + prompt match.
- `gameProgress` is monotonic across rounds. `reveal` → next `submitting` is forward, not a downgrade.
- Discard in `async` / `live` is disabled. It hung sync. Do not re-enable without an issue and merge fixtures.

## Deck entropy — shuffle once, deal from a cursor

Problem we already hit: rebuilding or reshuffling the pile on every draw (or sinking almost every recently seen id) made the next match feel like the same tip of the deck, and mid-round reshuffles were expensive.

Rules:

- All match RNG for piles happens at **create / rematch / restart**. Not on every rob / submit / next round.
- Prompts: one varied pile (`buildVariedPromptDeck`) + `promptDeckPos` cursor. Do not slice a new array out of the pile each round as the source of randomness.
- Answers: one pre-shuffled draw pile (`buildPreShuffledAnswerDeck`) + `answerDeckPos` cursor.
- `refillAnswerDeck` is emergency only (pile exhausted). It is not the normal draw path.
- Recently seen prompt/answer ids may sink to the back, but only a **cap** (about 28% of the pile, max 120). Do not merge every live game’s `usedPromptIds` into the avoid list.
- Do not interleave prompts by `sourcePack` for the match pile. That read as “one theme per round”.

### Size the answer pile from max need (do not * 3 the whole pack by habit)

Before shuffling, compute an upper bound and build **one** pile that covers it (then shuffle that pile, or shuffle the source once and take a prefix — do not generate many full extra barajas “por si acaso”).

Inputs:

- `N` = seats that hold a hand (solo = 1 human; live/async = player count)
- `R` = max rounds in this match (`SOLO_MAX_ROUNDS` in solo; otherwise enough rounds to hit `targetScore` in the worst case, or a documented cap)
- `P` = max `pick` on a selected prompt (1–3)
- `D` = discard phases that can fire (`shouldDiscardBeforeRound`; today 0 in live/async)
- `Q` = max cards discarded per seat per phase (`DISCARD_MAX`, currently 5)
- Solo extras: each round draws `SOLO_RIVAL_COUNT` × `P` answers from the pile (not from a bot hand)

Bound (answers):

```
initial hands     = N * HAND_SIZE
round refills     = R * submitters * P     // submitters = N in vote/solo, N-1 in zar multi
discard refills   = D * N * Q
solo rivals       = (mode === solo) ? R * SOLO_RIVAL_COUNT * P : 0
maxNeed           = initial + refills + discards + rivals + small slack
```

Use `maxNeed`, not “3 copies of the entire combined pack”, when the combined pack is already larger than `maxNeed`. If the combined pack is *smaller* than `maxNeed`, keep the current emergency refill path and tell the host to add packs.

### Deal: randomize across seats, not first-N-to-player-1

After the pile is shuffled once, dealing must not give seat 0 a systematic first-chunk advantage every match.

Do:

- Walk the shuffled cursor, but assign the next card to seats in a **shuffled seat order** (repeat that permutation, or reshuffle seat order each deal wave).
- Skip ids already in any hand.
- When replacing discarded / played cards, keep `replaceInHand` slot stability for UX, but the *incoming* cards still come from the same shuffled cursor (no extra shuffle).

Do not:

- Reshuffle the remaining pile on every rob.
- Build a fresh combined deck per tap.
- Deal 12 sequential cards to player 1, then 12 to player 2, from an unshuffled leftover of a previous match.

## Persist / UI performance

- Do not put full `promptDeck` / `answerDeck` in React state or in the persisted JSON.
- Hydrate piles in the store ref on load.
- Debounce persist (~900 ms). Memory is source of truth mid-match.

## Reto and Taller

- Reto semanal uses a **temporary week deck**, not `core`.
- Taller (edit / typo / add / export that week file) is preview + local only. Do not put Taller on the production Home.
- Do not merge Taller drafts into `core.json` by default. Export JSON, review, then commit the week file.
- Existing AdminPanel / local patches stay a preview tool. Production must not depend on `?admin=1`.
