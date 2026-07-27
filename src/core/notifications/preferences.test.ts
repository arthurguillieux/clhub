import { describe, expect, it } from "vitest";
import { wantsEmail } from "./preferences";

describe("wantsEmail", () => {
  it("defaults to true when prefs is the empty object (never configured)", () => {
    expect(wantsEmail({}, "bookingRequest")).toBe(true);
  });

  it("defaults to true when the category key is absent", () => {
    expect(wantsEmail({ someOtherKey: false }, "bookingRequest")).toBe(true);
  });

  it("respects an explicit false", () => {
    expect(wantsEmail({ bookingRequest: false }, "bookingRequest")).toBe(false);
  });

  it("respects an explicit true", () => {
    expect(wantsEmail({ bookingRequest: true }, "bookingRequest")).toBe(true);
  });

  it("defaults to true for non-object prefs (null, malformed data)", () => {
    expect(wantsEmail(null, "bookingRequest")).toBe(true);
    expect(wantsEmail(undefined, "bookingRequest")).toBe(true);
    expect(wantsEmail("not-an-object", "bookingRequest")).toBe(true);
  });
});
