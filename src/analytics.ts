import { Platform } from 'react-native';

type CardKind = 'answer' | 'prompt';

export type CardTelemetryEvent = {
  name: 'card_played' | 'card_discarded' | 'card_won' | 'card_favorited';
  cardId: string;
  text: string;
  kind: CardKind;
  won?: boolean;
};

const QUEUE_MAX = 40;
const FLUSH_MS = 2500;

let queue: CardTelemetryEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let trackFn: ((name: string, props?: Record<string, string | number | boolean>) => void) | null =
  null;

function isWeb(): boolean {
  return Platform.OS === 'web';
}

function truncate(text: string, max = 40): string {
  const t = (text || '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** Lazy-load Vercel Analytics track (web only). */
async function ensureTrack(): Promise<typeof trackFn> {
  if (!isWeb()) return null;
  if (trackFn) return trackFn;
  try {
    const mod = await import('@vercel/analytics');
    trackFn = mod.track as unknown as typeof trackFn;
  } catch {
    trackFn = null;
  }
  return trackFn;
}

function scheduleFlush() {
  if (flushTimer != null) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushQueue();
  }, FLUSH_MS);
}

async function flushQueue() {
  if (!isWeb() || queue.length === 0) return;
  const batch = queue.splice(0, QUEUE_MAX);
  const track = await ensureTrack();
  for (const ev of batch) {
    try {
      track?.(ev.name, {
        cardId: ev.cardId,
        text: truncate(ev.text),
        kind: ev.kind,
        ...(ev.won != null ? { won: ev.won } : {}),
      });
    } catch {
      /* ignore */
    }
  }
  try {
    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : '';
    if (!origin) return;
    await fetch(`${origin}/api/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        v: '0.69',
        ts: Date.now(),
        events: batch.map((ev) => ({
          name: ev.name,
          cardId: ev.cardId,
          text: truncate(ev.text),
          kind: ev.kind,
          won: ev.won,
        })),
      }),
      keepalive: true,
    });
  } catch {
    /* offline / static preview — ignore */
  }
}

/** Fire-and-forget card telemetry (web). No-op on native. */
export function trackCardEvent(ev: CardTelemetryEvent) {
  if (!isWeb() || !ev.cardId) return;
  queue.push(ev);
  if (queue.length >= QUEUE_MAX) {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    void flushQueue();
    return;
  }
  scheduleFlush();
}

export function trackCards(
  name: CardTelemetryEvent['name'],
  cards: { id: string; text: string; kind?: CardKind }[],
  opts?: { won?: boolean }
) {
  for (const c of cards) {
    if (!c?.id) continue;
    trackCardEvent({
      name,
      cardId: c.id,
      text: c.text || '',
      kind: c.kind ?? 'answer',
      won: opts?.won,
    });
  }
}
