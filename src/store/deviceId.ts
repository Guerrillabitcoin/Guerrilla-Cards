/**
 * Anonymous persistent device id (localStorage, web only) for daily unique /
 * returning counts. No personal data. Designed to be linked to an account
 * later (email login): the server can map gc_dev_v1 → accountId on sign-in.
 */
import { Platform } from 'react-native';

const DEVICE_KEY = 'gc_dev_v1';
const PING_DAY_KEY = 'gc_dev_ping_day';

function randomId(): string {
  try {
    const c = (globalThis as { crypto?: Crypto }).crypto;
    if (c?.randomUUID) return c.randomUUID();
    if (c?.getRandomValues) {
      const b = new Uint8Array(16);
      c.getRandomValues(b);
      return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    /* fall through */
  }
  return `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

export function getDeviceId(): string | null {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return null;
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id || !/^[a-zA-Z0-9_-]{8,64}$/.test(id)) {
      id = randomId();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

function today(): string {
  try {
    return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/** One tiny POST per device per day (unique + returning players). */
export function pingDeviceDaily(): void {
  const id = getDeviceId();
  if (!id) return;
  const day = today();
  try {
    if (localStorage.getItem(PING_DAY_KEY) === day) return;
  } catch {
    return;
  }
  void fetch('/api/stats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: id }),
  })
    .then((r) => {
      if (r.ok) localStorage.setItem(PING_DAY_KEY, day);
    })
    .catch(() => {
      /* ignore */
    });
}
