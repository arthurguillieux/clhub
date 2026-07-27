/**
 * Shared guard for any server-side fetch of a URL a member pasted in
 * (product links, personal calendar feeds...). Loose enough to catch a
 * handful of private/loopback ranges without being a complete SSRF
 * blocklist — these endpoints are only reachable by invited members
 * pasting a link they chose, not the general public, but the app is
 * self-hosted next to other services on the same home network, so a
 * pasted `http://localhost/...` or `http://192.168.x.x/...` must not be
 * silently fetched by the server.
 */
const PRIVATE_HOSTNAME_PATTERN =
  /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0|\[?::1\]?)$|\.local$/i;

export function isSafeExternalUrl(url: URL): boolean {
  return (
    (url.protocol === "http:" || url.protocol === "https:") &&
    !PRIVATE_HOSTNAME_PATTERN.test(url.hostname)
  );
}
