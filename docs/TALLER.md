# Taller — corregir preguntas y respuestas

Tú no tienes que editar JSON a mano ni tocar `main`.

Hay dos caminos. El primero ya funciona hoy (este chat). El segundo es la pantalla Taller en preview.

## Camino A — el sencillo (hoy)

1. En una partida ves un fallo o quieres otra carta.
2. Me lo pegas aquí, así:

```
TIPO: pregunta | respuesta
TEXTO ACTUAL: …
TEXTO NUEVO: …
PACK (si lo sabes): core / politica / …
```

O varias líneas. Si es carta nueva, pon `TEXTO ACTUAL: (nueva)`.

3. Yo la cambio en `deck/packs/…json` en una rama `preview/…` (nunca directo a la oficial).
4. Pruebas la URL preview. Si está bien, merge a `main` → sale en guerrillacards.vercel.app.

Eso es “actualizar el mazo”. Un cambio = un preview = un merge.

## Camino B — Taller en la preview (cuando se encienda)

El panel Admin ya está en el código (`AdminPanel` + parches locales) y **está apagado** (`ADMIN_ENABLED = false`). No aparece en la web pública.

Cuando lo encendamos **solo en preview**:

1. Abres la URL preview (no la oficial).
2. Entras al Taller / `?admin=1`.
3. Editas o añades pregunta/respuesta. Eso queda en **este navegador** (parche local). La oficial no cambia.
4. Pulsas **Exportar JSON**. Se descarga un fichero.
5. Me pasas ese fichero (o lo dejas en el repo) y yo lo aplico a `deck/packs/` o a `deck/reto/` en una rama preview.
6. Pruebas. Merge. Oficial actualizada.

PIN del código actual (solo preview): `guerrilla`. Cambiarlo antes de encender nada.

## Qué no hacer

- No editar `core.json` a ciegas en GitHub Desktop si no quieres pelearte con 4000 líneas.
- No encender Admin en producción.
- No mezclar parches del Reto semanal con el mazo core. El reto va a `deck/reto/` (baraja temporal de la semana).

## Reto semanal

Misma rutina: me pegas textos de la semana → preview → pruebas → merge. El Taller, cuando exista, edita ese fichero de semana, no todo el core.
