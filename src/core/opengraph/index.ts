/**
 * Minimal Open Graph scraper — just enough to pre-fill an item fiche from a
 * pasted product link (Leroy Merlin, Amazon...). Regex over the raw HTML
 * rather than a full parser: OG tags are simple, self-closing `<meta>`
 * elements, and pulling in an HTML parsing library for this alone isn't
 * worth it.
 */
import { isSafeExternalUrl } from "@/core/net/urlSafety";

export interface OpenGraphMetadata {
  title: string | null;
  image: string | null;
  priceCents: number | null;
}

const META_TAG_PATTERN = /<meta\s+[^>]*>/gi;

function extractAttr(tag: string, attr: string): string | null {
  const match = new RegExp(`${attr}\\s*=\\s*["']([^"']*)["']`, "i").exec(tag);
  return match ? match[1] ?? null : null;
}

export async function fetchOpenGraphMetadata(rawUrl: string): Promise<OpenGraphMetadata | null> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (!isSafeExternalUrl(url)) return null;

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
