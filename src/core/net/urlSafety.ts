import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Shared guard for any server-side fetch of a URL a member pasted in (product links, calendar
 * feeds...). The app is self-hosted next to other services on a home network, so the server must
 * never fetch a private address typed as is (`http://192.168.1.10/`), a public name that resolves
 * to one, or a public page that redirects to one. `safeFetch` checks all three, at every redirect.
 */

/** Names that only mean something on a local network. */
const LOCAL_NAME = /(^|\.)(localhost|local|lan|home|internal|intranet|arpa)$/i;

function parseV4(ip: string): number[] | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const bytes = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN));
  return bytes.every((b) => b >= 0 && b <= 255) ? bytes : null;
}

function isPrivateV4([a = 0, b = 0, c = 0]: number[]): boolean {
  return (
    a === 0 || // "this" network
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local, cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224 // multicast, reserved, broadcast
  );
}

/** The eight 16-bit groups of an IPv6 address, an IPv4 tail included; null if it isn't one. */
function parseV6(ip: string): number[] | null {
  let s = ip.toLowerCase().replace(/%.*$/, "");
  const tail = /(\d+\.\d+\.\d+\.\d+)$/.exec(s);
  if (tail?.[1]) {
    const v4 = parseV4(tail[1]);
    if (!v4) return null;
    const [a = 0, b = 0, c = 0, d = 0] = v4;
    s = `${s.slice(0, s.length - tail[1].length)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const groups = (part: string | undefined) => (part ? part.split(":") : []);
  const head = groups(halves[0]);
  const rest = groups(halves[1]);
  const missing = 8 - head.length - rest.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const all = [...head, ...Array<string>(halves.length === 1 ? 0 : missing).fill("0"), ...rest];
  const values = all.map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : NaN));
  return values.length === 8 && values.every((v) => !Number.isNaN(v)) ? values : null;
}

const embeddedV4 = (g: number[]) => [(g[6] ?? 0) >> 8, (g[6] ?? 0) & 0xff, (g[7] ?? 0) >> 8, (g[7] ?? 0) & 0xff];

function isPrivateV6(g: number[]): boolean {
  const [g0 = 0, g1 = 0, g2 = 0, g3 = 0, g4 = 0, g5 = 0] = g;
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0) {
    // ::ffff:a.b.c.d is judged by the IPv4 inside; ::, ::1 and the old IPv4-compatible form are refused.
    return g5 === 0xffff ? isPrivateV4(embeddedV4(g)) : true;
  }
  if (g0 === 0x64 && g1 === 0xff9b) return isPrivateV4(embeddedV4(g)); // NAT64
  if (g0 === 0x2002) return isPrivateV4([g1 >> 8, g1 & 0xff, g2 >> 8, g2 & 0xff]); // 6to4
  return (
    (g0 & 0xfe00) === 0xfc00 || // unique local
    (g0 & 0xffc0) === 0xfe80 || // link-local
    (g0 & 0xff00) === 0xff00 || // multicast
    (g0 === 0x2001 && g1 === 0x0db8) // documentation
  );
}

/** Whether an IP address, v4 or v6 (brackets allowed), is anything but a public internet address. Not an address at all: true. */
export function isPrivateAddress(address: string): boolean {
  const ip = address.replace(/^\[|\]$/g, "");
  const v4 = parseV4(ip);
  if (v4) return isPrivateV4(v4);
  const v6 = parseV6(ip);
  return v6 ? isPrivateV6(v6) : true;
}

/** The checks that need no network: http(s), no local name, no private address written as is. */
export function isSafeExternalUrl(url: URL): boolean {
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const host = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!host || LOCAL_NAME.test(host)) return false;
  if (isIP(host)) return !isPrivateAddress(host);
  return host.includes(".");
}

/** Every address the name resolves to must be public: a single private one is enough to refuse. */
async function resolvesPublicly(url: URL): Promise<boolean> {
  if (!isSafeExternalUrl(url)) return false;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) return true;
  try {
    const addresses = await lookup(host, { all: true, verbatim: true });
    return addresses.length > 0 && addresses.every((a) => !isPrivateAddress(a.address));
  } catch {
    return false;
  }
}

const USER_AGENT = "Mozilla/5.0 (compatible; LeCLHUBBot/1.0)";

/**
 * fetch() for a URL a member pasted: refuses private destinations and follows redirects by hand,
 * checking each hop the same way. Null when refused, unreachable or too slow.
 */
export async function safeFetch(rawUrl: string | URL, options: { timeoutMs?: number; accept?: string; maxRedirects?: number } = {}): Promise<Response | null> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  const signal = AbortSignal.timeout(options.timeoutMs ?? 6000);
  const headers: Record<string, string> = { "User-Agent": USER_AGENT, "Accept-Language": "fr-FR,fr;q=0.9" };
  if (options.accept) headers.Accept = options.accept;
  try {
    for (let hop = 0; hop <= (options.maxRedirects ?? 4); hop++) {
      if (!(await resolvesPublicly(url))) return null;
      const res = await fetch(url, { signal, headers, redirect: "manual" });
      if (res.status < 300 || res.status >= 400) return res;
      const location = res.headers.get("location");
      await res.body?.cancel();
      if (!location) return null;
      url = new URL(location, url);
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * The body, stopped at `maxBytes` so a page or a picture can't fill the server's memory. Bigger:
 * null, or with `truncate` the first `maxBytes` (enough for the head of a web page).
 */
export async function readLimited(res: Response, maxBytes: number, truncate = false): Promise<Buffer | null> {
  if (!res.body) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = res.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        if (!truncate) return null;
        chunks.push(value.subarray(0, value.byteLength - (size - maxBytes)));
        break;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }
  return Buffer.concat(chunks);
}
