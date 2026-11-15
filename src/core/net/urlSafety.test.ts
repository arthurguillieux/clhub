import { describe, expect, it } from "vitest";
import { isPrivateAddress, isSafeExternalUrl, safeFetch } from "./urlSafety";

describe("isPrivateAddress", () => {
  it.each([
    "127.0.0.1",
    "127.8.9.10",
    "10.0.0.5",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.20",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "255.255.255.255",
    "::",
    "::1",
    "[::1]",
    "fc00::1",
    "fd12:3456::1",
    "fe80::1%eth0",
    "ff02::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "::ffff:c0a8:114",
    "64:ff9b::a00:1",
    "2002:c0a8:101::1",
    "2001:db8::1",
    "not an address",
    "1.2.3",
  ])("refuses %s", (address) => {
    expect(isPrivateAddress(address)).toBe(true);
  });

  it.each(["8.8.8.8", "93.184.216.34", "172.32.0.1", "192.169.0.1", "100.128.0.1", "2a00:1450:4007:80e::200e", "::ffff:8.8.8.8", "[2606:4700::1111]"])("lets %s through", (address) => {
    expect(isPrivateAddress(address)).toBe(false);
  });
});

describe("isSafeExternalUrl", () => {
  it.each([
    "http://localhost:3000/",
    "http://127.0.0.1/",
    "http://192.168.1.20/admin",
    "http://10.0.0.1:5000/",
    "http://[::1]/",
    "http://nas.local/",
    "http://box.lan/",
    "http://router/",
    "ftp://example.com/file",
    "file:///etc/passwd",
    "http://169.254.169.254/latest/meta-data/",
  ])("refuses %s", (url) => {
    expect(isSafeExternalUrl(new URL(url))).toBe(false);
  });

  it.each(["https://www.fnac.com/a1234/draisienne", "http://example.com/", "https://8.8.8.8/"])("lets %s through", (url) => {
    expect(isSafeExternalUrl(new URL(url))).toBe(true);
  });
});

describe("safeFetch", () => {
  it("never reaches a private address, whatever the spelling", async () => {
    for (const url of ["http://127.0.0.1:1/", "http://[::ffff:127.0.0.1]:1/", "http://localhost:1/", "not a url"]) {
      expect(await safeFetch(url, { timeoutMs: 500 })).toBeNull();
    }
  });
});
