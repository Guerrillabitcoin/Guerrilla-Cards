/** Label for Solo random-rival answers (moved from app/play.tsx in v0.99.422.29). */
export function rivalLabel(playerId: string): string {
  const m = /^rival-(\d+)$/.exec(playerId);
  if (m) return `RESPUESTA BOT ${m[1]}`;
  return 'RESPUESTA BOT';
}
