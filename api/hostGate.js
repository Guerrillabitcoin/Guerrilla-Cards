/**
 * Host is the escape valve: rematch, prompt lock, league latch.
 * Guests may still upsert answers/votes; they cannot deal a new prompt
 * or start Otra manga.
 */
function hostIdOf(state) {
  const list = (state && state.players) || [];
  const host = list.find((p) => p && p.isHost);
  return host && host.id ? String(host.id) : null;
}

function isHostActor(state, actorId) {
  if (!actorId) return false;
  return hostIdOf(state) === String(actorId);
}

function applyHostAuthority(existing, incoming, actorId) {
  if (!existing || !incoming) return { reject: false, state: incoming };
  const host =
    isHostActor(existing, actorId) || isHostActor(incoming, actorId);

  const incomingRematch =
    existing.phase === 'results' &&
    incoming.phase !== 'results' &&
    incoming.phase !== 'lobby' &&
    (Number(incoming.round) || 0) <= 1;
  if (incomingRematch && actorId && !host) {
    return { reject: true, state: existing };
  }

  let state = incoming;
  const sameRound =
    (Number(existing.round) || 0) === (Number(incoming.round) || 0);
  const inPlay =
    existing.phase !== 'lobby' &&
    incoming.phase !== 'lobby' &&
    existing.phase !== 'results' &&
    incoming.phase !== 'results';
  if (
    sameRound &&
    inPlay &&
    existing.currentPrompt &&
    incoming.currentPrompt &&
    existing.currentPrompt.id !== incoming.currentPrompt.id
  ) {
    state = { ...state, currentPrompt: existing.currentPrompt };
  }

  if (existing.leagueAwarded) {
    state = {
      ...state,
      leagueAwarded: true,
      leagueScores: existing.leagueScores || state.leagueScores,
    };
  }
  return { reject: false, state };
}

module.exports = {
  hostIdOf,
  isHostActor,
  applyHostAuthority,
};
