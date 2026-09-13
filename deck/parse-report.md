# Guerrilla Cards — parse report

## Multi-pack membership + deck dedupe (v1.1)

Packs may **overlap**: the same card `id`+content can appear in multiple pack JSON files.
The game engine merges selected packs and **dedupes by `id`** (first pack wins), then skips any id in `_banned.json`.

### Classification rules
- Start from all prior playable cards (deduped by `id`); **stable ids reused**.
- Keyword heuristics assign each card to **zero or more** theme packs.
- If matched to ≥1 theme → those theme packs only (not forced into `core`).
- If matched to 0 themes → `core` only.
- `sexo` / `drogas` (+ other edgy adult via plus18_extra) also go into umbrella `plus18`.
- `_banned.json` stays separate; banned ids never written into playable packs.

### Counts (unique cards per pack file)

| Pack | Answers | Prompts | Total | NSFW |
|------|--------:|--------:|------:|:----:|
| core | 3000 | 219 | 3219 |  |
| politica | 92 | 21 | 113 |  |
| celebridades | 58 | 2 | 60 |  |
| economia | 86 | 15 | 101 |  |
| animales | 64 | 1 | 65 |  |
| sexo | 317 | 16 | 333 | yes |
| drogas | 79 | 3 | 82 | yes |
| familia | 196 | 40 | 236 |  |
| religion | 69 | 4 | 73 |  |
| tech | 74 | 7 | 81 |  |
| salud | 58 | 9 | 67 |  |
| espana | 42 | 10 | 52 |  |
| plus18 | 480 | 22 | 502 | yes |

- Unique playable cards (by id): **4437**
- Card slots across packs (with overlaps): **4984**
- Cards in 2+ packs: **479**
- Banned: **21**

### Top pack-pair overlaps

- `plus18` ∩ `sexo`: 333
- `drogas` ∩ `plus18`: 82
- `familia` ∩ `plus18`: 31
- `familia` ∩ `sexo`: 20
- `celebridades` ∩ `plus18`: 12
- `celebridades` ∩ `sexo`: 12
- `plus18` ∩ `tech`: 8
- `plus18` ∩ `salud`: 7
- `familia` ∩ `religion`: 5
- `animales` ∩ `familia`: 5
- `celebridades` ∩ `espana`: 5
- `plus18` ∩ `politica`: 5
- `sexo` ∩ `tech`: 5
- `economia` ∩ `politica`: 5
- `salud` ∩ `sexo`: 5

## Inputs (historical)
- Answers+prompts source: `/workspace/guerrilla-cards/extract/finalgrok.txt`
- House rules source: `/workspace/guerrilla-cards/extract/cch1.txt` (rules only)

## Banned
- `_banned.json` cards: **21** (not playable)
- Engine skips banned ids when building a match deck.


## Import 2026-09-13 (v1.3 / app v0.71)
- Source PDF: user print sheet (16 pages × 24 cards ≈ 384 answers).
- Added **382** new answer cards (1 duplicate skipped: Camarón de la Isla).
- Classified into theme packs with multi-membership; unmatched → `core`.
- Kept original JSON card shape `{id,type,text,pick}` (deck 1.0 format).
- Did **not** mass-delete answers starting with «en»/«por» (~37 unique): they fit prompts like «___» where a location/reason clause wins; deleting them loses combo space. Prefer filtering in UI later if desired.
