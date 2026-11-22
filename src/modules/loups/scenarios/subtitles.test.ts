import { describe, expect, it } from "vitest";
import { parseCues } from "./subtitles";

describe("parseCues", () => {
  it("reads the preparation's lines, each until the next one", () => {
    expect(parseCues("0:03 Je… ça marche ? Cool !\n0:07 On vient d'arriver.\n\nnot a cue")).toEqual([
      { start: 3, end: 7, text: "Je… ça marche ? Cool !" },
      { start: 7, end: 13, text: "On vient d'arriver." },
    ]);
  });

  it("reads a .vtt file", () => {
    const vtt = "WEBVTT\n\n1\n00:00:01.000 --> 00:00:04.500\nBonjour\nà tous\n\n00:00:05.000 --> 00:00:06.000 align:center\nFin";
    expect(parseCues(vtt)).toEqual([
      { start: 1, end: 4.5, text: "Bonjour à tous" },
      { start: 5, end: 6, text: "Fin" },
    ]);
  });

  it("gives nothing for nothing", () => {
    expect(parseCues("  ")).toEqual([]);
  });
});
