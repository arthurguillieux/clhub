import { describe, expect, it } from "vitest";
import { callError } from "./callError";

describe("callError", () => {
  it("tells an update from a server error", () => {
    expect(callError(new Error('Server Action "7f3a" was not found on the server.'))).toMatch(/mis à jour/);
    expect(callError(new Error("An unexpected response was received from the server."))).toMatch(/Le serveur n'a pas pu/);
  });
});
