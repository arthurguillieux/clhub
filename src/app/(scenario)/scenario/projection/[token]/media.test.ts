import { describe, expect, it } from "vitest";
import { keyOf } from "./media";

describe("the projection's media", () => {
  it("are found by their name, whatever their format or case", () => {
    expect(keyOf("vent.aac")).toBe(keyOf("vent.mp3"));
    expect(keyOf("Vent.M4A")).toBe("vent");
    expect(keyOf("log-1.webm")).toBe(keyOf("log-1.mp4"));
    expect(keyOf("accueil.png")).toBe(keyOf("accueil.jpg"));
  });

  it("keep the subtitles apart from their video", () => {
    expect(keyOf("log-2.vtt")).toBe("log-2.vtt");
    expect(keyOf("log-2.vtt")).not.toBe(keyOf("log-2.mp4"));
  });
});
