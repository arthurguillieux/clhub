/**
 * Minimal Open Graph scraper: just enough to pre-fill a fiche from a pasted product link (an item
 * of the Prêtothèque, a gift on a letter to Santa). Regex over the raw HTML rather than a full
 * parser: the tags are simple, and an HTML library isn't worth it for this alone. What a page says
 * about itself is outside data, so the result goes through a zod schema before anyone uses it.
 */
import { z } from "zod";
import { readLimited, safeFetch } from "@/core/net/urlSafety";

export interface OpenGraphMetadata {
  title: string | null;
  image: string | null;
  priceCents: number | null;
}

const META_TAG = /<meta\s[^>]*>/gi;
const LINK_TAG = /<link\s[^>]*>/gi;
const LD_SCRIPT = /<script[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
const TITLE_TAG = /<title[^>]*>([\s\S]*?)<\/title>/i;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  laquo: "«",
  raquo: "»",
  hellip: "…",
  ndash: "–",
  mdash: "—",
  euro: "€",
  eacute: "é",
  Eacute: "É",
  egrave: "è",
  Egrave: "È",
  ecirc: "ê",
  euml: "ë",
  agrave: "à",
  Agrave: "À",
  acirc: "â",
  ccedil: "ç",
  Ccedil: "Ç",
  icirc: "î",
  iuml: "ï",
  ocirc: "ô",
  oelig: "œ",
  ucirc: "û",
  ugrave: "ù",
  uuml: "ü",
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (whole, code: string) => {
    if (code.startsWith("#")) {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : whole;
    }
    return NAMED_ENTITIES[code] ?? whole;
  });
}

/** An attribute of a tag, whatever the quotes (an apostrophe inside double quotes must not cut « L'étoile »). */
function attr(tag: string, name: string): string | null {
  const match = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i").exec(tag);
  return match ? decodeEntities(match[1] ?? match[2] ?? match[3] ?? "") : null;
}

/** « 35,99 », « 1 299.00 », « 1.299,00 € », 35.5 → cents; null when it isn't a plausible price. */
export function parsePriceCents(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) && raw > 0 && raw < 100_000 ? Math.round(raw * 100) : null;
  if (typeof raw !== "string") return null;
  let s = raw.replace(/[\s  €$£]|EUR/gi, "");
  if (!/^\d[\d.,]*$/.test(s)) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    // Both: the last one separates the cents, the other groups thousands.
    s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else {
    s = s.replace(",", ".");
  }
  const value = Number(s);
  return Number.isFinite(value) && value > 0 && value < 100_000 ? Math.round(value * 100) : null;
}

const typeIs = (node: Record<string, unknown>, type: string) => {
  const t = node["@type"];
  return t === type || (Array.isArray(t) && t.includes(type));
};

/** Every object of a JSON-LD block, `@graph` and arrays flattened. */
function ldNodes(value: unknown, out: Record<string, unknown>[] = [], depth = 0): Record<string, unknown>[] {
  if (depth > 4 || value === null || typeof value !== "object") return out;
  if (Array.isArray(value)) {
    for (const v of value) ldNodes(v, out, depth + 1);
    return out;
  }
  const node = value as Record<string, unknown>;
  out.push(node);
  if (node["@graph"]) ldNodes(node["@graph"], out, depth + 1);
  return out;
}

function ldImage(image: unknown): string | null {
  if (typeof image === "string") return image;
  if (Array.isArray(image)) return ldImage(image[0]);
  if (image && typeof image === "object" && typeof (image as { url?: unknown }).url === "string") return (image as { url: string }).url;
  return null;
}

function ldPrice(offers: unknown): number | null {
  if (Array.isArray(offers)) {
    for (const o of offers) {
      const price = ldPrice(o);
      if (price !== null) return price;
    }
    return null;
  }
  if (!offers || typeof offers !== "object") return null;
  const o = offers as Record<string, unknown>;
  return parsePriceCents(o.price) ?? parsePriceCents(o.lowPrice) ?? ldPrice(o.offers);
}

const clean = (text: string | null | undefined) => (text ? decodeEntities(text).replace(/\s+/g, " ").trim() : "");

const resultSchema = z.object({
  title: z.string().min(1).max(200).nullable().catch(null),
  image: z
    .string()
    .url()
    .max(2000)
    .refine((u) => /^https?:/i.test(u))
    .nullable()
    .catch(null),
  priceCents: z.number().int().positive().max(10_000_000).nullable().catch(null),
});

/** What a product page says about itself: its name, its picture, its price. Pure, for the tests. */
export function parseOpenGraph(html: string, pageUrl: URL): OpenGraphMetadata | null {
  let title: string | null = null;
  let image: string | null = null;
  let priceCents: number | null = null;

  for (const tag of html.match(META_TAG) ?? []) {
    const key = (attr(tag, "property") ?? attr(tag, "name") ?? attr(tag, "itemprop") ?? "").toLowerCase();
    const content = attr(tag, "content");
    if (!key || !content) continue;
    if (!title && (key === "og:title" || key === "twitter:title")) title = clean(content);
    if (!image && (key === "og:image" || key === "og:image:secure_url" || key === "og:image:url" || key === "twitter:image" || key === "twitter:image:src")) image = content.trim();
    if (priceCents === null && (key === "og:price:amount" || key === "product:price:amount" || key === "price")) priceCents = parsePriceCents(content);
  }

  for (const match of html.matchAll(LD_SCRIPT)) {
    if (title && image && priceCents !== null) break;
    let data: unknown;
    try {
      data = JSON.parse(match[1] ?? "");
    } catch {
      continue;
    }
    for (const node of ldNodes(data)) {
      if (!typeIs(node, "Product")) continue;
      if (!title && typeof node.name === "string") title = clean(node.name);
      if (!image) image = ldImage(node.image);
      if (priceCents === null) priceCents = ldPrice(node.offers);
    }
  }

  if (!image) {
    for (const tag of html.match(LINK_TAG) ?? []) {
      if ((attr(tag, "rel") ?? "").toLowerCase() === "image_src") {
        image = attr(tag, "href");
        break;
      }
    }
  }
  if (!title) title = clean(TITLE_TAG.exec(html)?.[1]) || null;

  if (image) {
    try {
      image = new URL(image, pageUrl).toString();
    } catch {
      image = null;
    }
  }

  const result = resultSchema.parse({ title: title || null, image, priceCents });
  return result.title || result.image || result.priceCents !== null ? result : null;
}

/** The text of a page in the charset it declares: some shops still serve Latin-1. */
function decode(body: Buffer, contentType: string): string {
  const declared = /charset=["']?([\w-]+)/i.exec(contentType)?.[1] ?? /<meta[^>]+charset=["']?([\w-]+)/i.exec(body.subarray(0, 4096).toString("latin1"))?.[1] ?? "utf-8";
  try {
    return new TextDecoder(declared.toLowerCase()).decode(body);
  } catch {
    return body.toString("utf8");
  }
}

export async function fetchOpenGraphMetadata(rawUrl: string): Promise<OpenGraphMetadata | null> {
  const res = await safeFetch(rawUrl, { accept: "text/html,application/xhtml+xml" });
  if (!res?.ok) return null;
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("html")) {
    await res.body?.cancel();
    return null;
  }
  // The head is near the top; product details in JSON-LD may come later, but rarely after 3 MB.
  const body = await readLimited(res, 3_000_000, true);
  if (!body) return null;
  try {
    return parseOpenGraph(decode(body, contentType), new URL(res.url || rawUrl));
  } catch {
    return null;
  }
}

/** A picture found on a page, downloaded with the same care as the page. Null if it isn't one, or too big. */
export async function downloadImage(rawUrl: string): Promise<Buffer | null> {
  const res = await safeFetch(rawUrl, { accept: "image/*", timeoutMs: 8000 });
  if (!res?.ok) return null;
  if (!(res.headers.get("content-type") ?? "").startsWith("image/")) {
    await res.body?.cancel();
    return null;
  }
  return readLimited(res, 10_000_000);
}
