# Guerrilla Cards

Party card game MVP — **Guerrilla Cards** (Spanish). Dark guerrilla UI. Expo + TypeScript + Expo Router.

**Brand:** Guerrilla Cards only. No Cards Against Humanity / Cartas Contra la Humanidad trademarks or CAH stock card text.

## ES — Cómo ejecutar

1. Instala [Node.js](https://nodejs.org/) LTS (20+).
2. En esta carpeta:

```bash
npm install
npx expo start
```

3. Abre en Expo Go (móvil), emulador, o pulsa `w` para web.

### Cómo jugar este MVP (local)

- **Sin backend:** las partidas viven en `AsyncStorage` de **este dispositivo**.
- Crea partida → elige packs → añade 3–8 asientos en el lobby → Empezar.
- **Pass-and-play:** pásale el móvil a cada jugador; cada asiento confirma identidad antes de ver la mano.
- Flujo: prompt → envío desde mano de 10 → el Zar elige → Puntaco → siguiente ronda.
- Modo **async** = misma lógica, partida guardada para retomar; **no** es multiplayer online todavía.
- Unirse por código solo funciona si el código existe **en el mismo teléfono**.
- Cartas del pack `_banned` **nunca** se reparte.

Multijugador online real = siguiente iteración.

## EN — Quick start

```bash
npm install
npx expo start
```

Local pass-and-play MVP only. Banned cards are never dealt. Pack multi-select filters the combined deck at game create.

## Packs (`deck/`)

| Pack | Playable | Notes |
|------|----------|-------|
| `core` | yes | Main Spanish absurd/misc deck |
| `politica` | yes | Politics |
| `celebridades` | yes | Celebs / pop |
| `plus18` | yes | Adults only |
| `_banned` | **no** | Excluded from dealing |

See `deck/manifest.json`, `deck/rules.json`, `deck/parse-report.md`.

## Project layout

- `app/` — Expo Router screens (Home, Lobby, Play, Results)
- `src/engine/` — deck loader + game rules (UI-free)
- `src/store/` — AsyncStorage game sessions
- `deck/` — JSON packs

## Push to GitHub

Repo target: https://github.com/Guerrillabitcoin/Guerrilla-Cards

```bash
# from project root (this folder)
git init
git add .
git commit -m "Initial Guerrilla Cards Expo MVP"
git branch -M main
git remote add origin https://github.com/Guerrillabitcoin/Guerrilla-Cards.git
git push -u origin main
```

Or unzip this project, then drag-drop files in the GitHub web UI / `gh repo sync`.

```bash
# with GitHub CLI (if repo already exists empty)
gh repo clone Guerrillabitcoin/Guerrilla-Cards
# copy files in, then:
git add . && git commit -m "MVP" && git push
```

## Scripts

- `npm start` / `npx expo start`
- `npm run web`
- `npm run typecheck`

## License / content

House rules adapted under Guerrilla Cards branding. Playable cards from custom Spanish deck parse — not CAH stock translations.
