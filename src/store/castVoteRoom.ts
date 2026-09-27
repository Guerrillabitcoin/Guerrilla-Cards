export async function castVoteRoom(
  code: string,
  voterId: string,
  targetId: string
): Promise<{ ok: boolean; state?: unknown }> {
  const raw = String(code || '').trim().toUpperCase();
  if (!raw || !voterId || !targetId) return { ok: false };
  try {
    const res = await fetch('/api/room', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'vote',
        code: raw,
        voterId,
        targetId,
      }),
    });
    const data = (await res.json()) as { ok?: boolean; state?: unknown };
    return { ok: !!data.ok, state: data.state };
  } catch {
    return { ok: false };
  }
}
