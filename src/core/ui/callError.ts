/**
 * What to tell someone whose server action failed in the browser. Three different stories, three
 * different gestures: the CLHUB was updated while the page stayed open (reload), the network is gone
 * (try again), or the server stumbled (reload, and say so if it comes back).
 */
export function callError(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  if (/server action|deployment|failed to find/i.test(message)) return "Le CLHUB vient d'être mis à jour : recharge la page, puis refais ton geste.";
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "Pas de connexion — réessaie.";
  return "Le serveur n'a pas pu le faire : recharge la page et réessaie.";
}
