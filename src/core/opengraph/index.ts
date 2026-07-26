/**
 * Minimal Open Graph scraper — just enough to pre-fill an item fiche from a
 * pasted product link (Leroy Merlin, Amazon...). Regex over the raw HTML
 * rather than a full parser: OG tags are simple, self-closing `<meta>`
 * elements, and pulling in an HTML parsing library for this alone isn't
 * worth it.
 */
export interface OpenGraphMetadata {
  title: string | null;
  image: string | null;
  priceCents: number | null;
}

const META_TAG_PATTERN = /<meta\s+[^>]*>/gi;

// Loose enough to catch a handful of private/loopback ranges without being a
// complete SSRF blocklist — this endpoint is only reachable by invited
// members pasting a link they chose, not the general public.
const PRIVATE_HOSTNAME_PATTERN =
  /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0|\[?::1\]?)$|\.local$/i;

function extractAttr(tag: string, attr: string): string | null {
  const match = new RegExp(`${attr}\\s*=\\s*["']([^"']*)["']`, "i").exec(tag);
  return match ? match[1] ?? null : null;
}

function isSafeUrl(url: URL): boolean {
  return (
    (url.protocol === "http:" || url.protocol === "https:") &&
    !PRIVATE_HOSTNAME_PATTERN.test(url.hostname)
  );
}

export async function fetchOpenGraphMetadata(rawUrl: string): Promise<OpenGraphMetadata | null> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (!isSafeUrl(url)) return null;

  let html: string;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LeCLHUBBot/1.0)" },
    });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("text/html")) {
      return null;
    }
    html = await res.text();
  } catch {
    return null;
  }

  let title: string | null = null;
  let image: string | null = null;
  let priceCents: number | null = null;

  for (const tag of html.match(META_TAG_PATTERN) ?? []) {
    const property = extractAttr(tag, "property") ?? extractAttr(tag, "name");
    const content = extractAttr(tag, "content");
    if (!property || !content) continue;

    if (!title && (property === "og:title" || property === "twitter:title")) {
      title = content;
    }
    if (!image && (property === "og:image" || property === "twitter:image")) {
      image = content;
    }
    if (priceCents === null && (property === "og:price:amount" || property === "product:price:amount")) {
      const parsed = Math.round(Number.parseFloat(content.replace(",", ".")) * 100);
      if (Number.isFinite(parsed)) priceCents = parsed;
    }
  }

  if (image) {
    try {
      image = new URL(image, url).toString();
    } catch {
      image = null;
    }
  }

  if (!title && !image && priceCents === null) return null;
  return { title, image, priceCents };
}
