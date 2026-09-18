# Guerrilla Cards

Party card game — **Guerrilla Cards** (Spanish). Dark guerrilla UI. Expo + TypeScript + Expo Router.

**Brand:** Guerrilla Cards only. No Cards Against Humanity / Cartas Contra la Humanidad trademarks or CAH stock card text.

Shipped UI version lives in `src/version.ts` (currently **v0.99.420**). `package.json` / `app.json` may lag; do not treat them as the label shown in the app.

For agents: read `AGENTS.md` first. Architecture, scars, preview vs production, and wishlist: `docs/`.

## ES — Cómo ejecutar

1. Instala [Node.js](https://nodejs.org/) LTS (20+).
2. En esta carpeta:

```bash
npm install
npx expo start
```

3. Abre en Expo Go (móvil), emulador, o pulsa `w` para web.

Local cubre Solo y pass-and-play. El multi entre dispositivos usa `/api/room` en Vercel (hace falta KV / Upstash).

### Cómo se juega

Tres modos de cara al jugador (el tercero aún no está):

- **Solo** — un humano; al enviar se rellenan 3 rivales desde el mazo.
- **Multijugador** — un código de sala. Hoy el código interno aún distingue mismo teléfono (`live`) y online web (`async`, 4 asientos). En pantalla no hace falta esa jerga.
- **Reto semanal** — adelante: cartas de actualidad, pocas rondas, recopilar respuestas y votos.

Flujo de una ronda: pregunta → envío desde mano de 12 → Zar o voto → Puntaco → siguiente ronda.
Cartas de `_banned` **nunca** se reparte.
Descarte periódico: hoy solo en Solo (`docs/DECISIONS.md`).

Detalle de lo que falta: `docs/ROADMAP.md`.

## EN — Quick start

```bash
npm install
npx expo start
```

Production site: https://guerrillacards.vercel.app (deploys from `main`). Test a build without replacing that site: push a `preview/…` branch and use the Vercel Preview URL (`docs/RELEASE.md`).

## Packs (`deck/`)

Playable: `core`, `politica`, `celebridades`, `economia`, `animales`, `sexo`, `drogas`, `familia`, `religion`, `tech`, `salud`, `espana`, `plus18`.
Not dealt: `_banned`.

Counts and files: `deck/manifest.json`. Parse notes: `deck/parse-report.md`. House rules text: `deck/rules.json` (not all variants are implemented).

## Project layout

- `app/` — Expo Router screens (Home, Lobby, Play, Results, Historial, Compartir)
- `src/engine/` — deck loader + game rules (UI-free)
- `src/store/` — AsyncStorage sessions + web room client
- `deck/` — JSON packs
- `api/` — Vercel room + telemetry

## Scripts

- `npm start` / `npx expo start`
- `npm run web`
- `npm run typecheck`
- `npm run build` — `expo export -p web` (what Vercel builds)

## License / content

House rules adapted under Guerrilla Cards branding. Playable cards from a custom Spanish deck parse — not CAH stock translations.
