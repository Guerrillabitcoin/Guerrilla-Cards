# Guerrilla Cards — datos de mazo

Cartas jugables parseadas desde `finalgrok` (mazo custom en español).

**Multi-pack:** la misma carta (`id`) puede pertenecer a varios packs JSON.
El motor (`loadCombinedDeck` / `buildDeck`) fusiona packs seleccionados y **deduplica por `id`** (gana el primero).

**Copyright / diseño:** El PDF `cch1` incluye material printable v1 con textos stock traducidos de Cartas Contra la Humanidad / CAH; esos textos **no** se importan a los packs jugables. Solo se adaptaron las reglas de casa a `rules.json` bajo la marca Guerrilla Cards.

El pack `_banned.json` reúne líneas CSAM-adjacent / abuso de menores y no es jugable.
