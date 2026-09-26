function unionRestartReady(existing, incoming, state) {
  if (!state || state.phase !== 'results') return state;
  const ids = [];
  const seen = new Set();
  for (const id of [
    ...((existing && existing.restartReadyIds) || []),
    ...((incoming && incoming.restartReadyIds) || []),
    ...(state.restartReadyIds || []),
  ]) {
    if (!id || seen.has(id)) continue;
    seen.add(String(id));
    ids.push(String(id));
  }
  return { ...state, restartReadyIds: ids };
}

module.exports = { unionRestartReady };
