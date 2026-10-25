import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("co-organization password", () => {
  it("is never stored as typed, and two games with the same password get different hashes", () => {
    const a = hashPassword("Citrouille");
    expect(a).not.toContain("itrouille");
    expect(hashPassword("Citrouille")).not.toBe(a);
  });

  it("accepts the password whatever its case or surrounding spaces, and refuses anything else", () => {
    const stored = hashPassword("Citrouille");
    expect(verifyPassword("citrouille", stored)).toBe(true);
    expect(verifyPassword("  CITROUILLE ", stored)).toBe(true);
    expect(verifyPassword("citrouilles", stored)).toBe(false);
    expect(verifyPassword("", stored)).toBe(false);
    expect(verifyPassword("citrouille", "garbage")).toBe(false);
  });
});
