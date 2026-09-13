# Dónde ver stats y telemetría (v0.69)

## 1. Vercel Analytics (visitas / páginas)

1. Entra en [vercel.com/dashboard](https://vercel.com/dashboard)
2. Abre el proyecto de **Guerrilla Cards** (`guerrillacards` / el ligado a `Guerrillabitcoin/Guerrilla-Cards`)
3. Pestaña **Analytics**
4. Ahí ves visitantes, page views y (si el plan lo muestra) **Events** de `card_played`, `card_discarded`, `card_won`, `card_favorited`

Hay que tener **Web Analytics** activado en el proyecto (Settings → Analytics → Enable) la primera vez.

## 2. Speed Insights

Misma proyecto → pestaña **Speed Insights** (Core Web Vitals). Activar si pide Enable.

## 3. Logs de cartas (`/api/telemetry`)

Cada batch de eventos de cartas hace POST a `/api/telemetry`.

- Proyecto → **Logs** (o Observability → Runtime Logs)
- Filtra por `guerrilla_card_telemetry` o por la ruta `/api/telemetry`

Ahí sale un JSON con `cardId`, texto corto, `kind` y el tipo de evento. Úsalo para ver qué juega la gente en producción.

Si más adelante creas un **Vercel KV** y pones `KV_REST_API_URL` + `KV_REST_API_TOKEN` en Environment Variables, los contadores diarios por carta se incrementan ahí (`gc:card:YYYY-MM-DD:…`).

## 4. Stats locales en la app

En la app, la pestaña / pantalla de **Stats** (historial de cartas) sigue siendo **solo de ese navegador/dispositivo**. No es el agregado global.

## 5. Para que Grok Bot analice cartas

- Comparte capturas o export de Analytics / Events, o
- Pega fragmentos de Runtime Logs con `guerrilla_card_telemetry`, o
- Cuando haya KV, exporta las keys `gc:card:*`


## Reports de usuarios (v0.73)

El botón ⚑ abajo-izquierda en inicio abre **Reportar fallo**.

- POST `/api/report`
- Runtime Logs → busca `guerrilla_user_report`
