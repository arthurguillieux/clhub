import { describe, expect, it } from "vitest";
import { decodeEntities, parseOpenGraph, parsePriceCents } from "./index";

const page = new URL("https://shop.example.com/jouets/draisienne?ref=1");

describe("parseOpenGraph", () => {
  it("reads the Open Graph tags, whatever the order of the attributes", () => {
    const html = `<html><head>
      <meta content="Draisienne en bois" property="og:title">
      <meta property="og:image" content="/img/draisienne.jpg" />
      <meta property="product:price:amount" content="59.90">
    </head></html>`;
    expect(parseOpenGraph(html, page)).toEqual({ title: "Draisienne en bois", image: "https://shop.example.com/img/draisienne.jpg", priceCents: 5990 });
  });

  it("keeps an apostrophe inside double quotes, and decodes entities", () => {
    const html = `<meta property="og:title" content="L'étoile du berger &amp; ses amis &#8211; coffret">
      <meta name="twitter:image" content='https://cdn.example.com/a.jpg?w=800&amp;h=800'>`;
    expect(parseOpenGraph(html, page)).toEqual({ title: "L'étoile du berger & ses amis – coffret", image: "https://cdn.example.com/a.jpg?w=800&h=800", priceCents: null });
  });

  it("falls back on the JSON-LD product, @graph and offer lists included", () => {
    const html = `<title>Ignored when the product has a name</title>
      <script type="application/ld+json">{"@context":"https://schema.org","@graph":[
        {"@type":"BreadcrumbList","name":"Jouets"},
        {"@type":["Product"],"name":"Garage Playmobil","image":["https://cdn.example.com/garage.webp"],
         "offers":[{"@type":"Offer","price":"44,99","priceCurrency":"EUR"}]}]}</script>`;
    expect(parseOpenGraph(html, page)).toEqual({ title: "Garage Playmobil", image: "https://cdn.example.com/garage.webp", priceCents: 4499 });
  });

  it("reads an aggregate offer's lowest price and an image object", () => {
    const html = `<script type="application/ld+json">{"@type":"Product","name":"Puzzle","image":{"url":"https://cdn.example.com/p.png"},"offers":{"@type":"AggregateOffer","lowPrice":12.5}}</script>`;
    expect(parseOpenGraph(html, page)?.priceCents).toBe(1250);
  });

  it("survives a broken JSON-LD block and uses the title tag as a last resort", () => {
    const html = `<script type="application/ld+json">{ not json </script><title>
      Livre   Les dinosaures &eacute;tonnants </title>`;
    expect(parseOpenGraph(html, page)).toEqual({ title: "Livre Les dinosaures étonnants", image: null, priceCents: null });
  });

  it("drops what isn't usable: a javascript: image, a nonsense price", () => {
    const html = `<meta property="og:image" content="javascript:alert(1)"><meta property="og:price:amount" content="gratuit"><meta property="og:title" content="Toupie">`;
    expect(parseOpenGraph(html, page)).toEqual({ title: "Toupie", image: null, priceCents: null });
  });

  it("returns null for a page with nothing to say", () => {
    expect(parseOpenGraph("<html><body>Hello</body></html>", page)).toBeNull();
  });
});

describe("parsePriceCents", () => {
  it.each([
    ["35", 3500],
    ["35,99", 3599],
    ["35.5", 3550],
    ["1 299,00 €", 129900],
    ["1.299,00", 129900],
    ["1,299.00", 129900],
    [19.99, 1999],
    ["EUR 12", 1200],
  ] as const)("%s → %i", (raw, cents) => {
    expect(parsePriceCents(raw)).toBe(cents);
  });

  it.each(["", "gratuit", "-5", "0", 0, -3, "1e9", null, undefined, {}])("refuses %s", (raw) => {
    expect(parsePriceCents(raw)).toBeNull();
  });
});

describe("decodeEntities", () => {
  it("decodes named, decimal and hex entities, and leaves unknown ones alone", () => {
    expect(decodeEntities("&Eacute;t&eacute; &#233; &#xE9; &bogus; &amp;")).toBe("Été é é &bogus; &");
  });
});
