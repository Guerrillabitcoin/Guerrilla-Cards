import type { useRouter } from 'expo-router';

type Router = ReturnType<typeof useRouter>;

/**
 * Back to Inicio without stacking screens.
 * `router.replace('/')` from Resultados/Play swapped only the top route, so every
 * «Menu inicio» → «Jugar» cycle left one more Home mounted underneath (hidden on
 * web). Each of them re-rendered on every game/state change, so starting a game and
 * opening Resultados got slower the more matches were played in a session.
 * Pop the stack first, then replace → always exactly one fresh Home.
 */
export function goHome(router: Router): void {
  try {
    if (router.canDismiss()) router.dismissAll();
  } catch {
    // navigator not ready — plain replace below still works
  }
  router.replace('/');
}
