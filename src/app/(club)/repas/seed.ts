/** A seed for the « nothing yet » joke: stable for a guest over a day, so it doesn't change on every refresh. */
export function jokeSeed(key: string): number {
  const day = Math.floor(Date.now() / 86_400_000);
  return [...key].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, day);
}
