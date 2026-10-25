import { crc32 as zlibCrc32 } from "node:zlib";
import { describe, expect, it } from "vitest";
import { buildZip, crc32 } from "./zip";

/** Reads a stored zip back through its central directory — enough to check what buildZip wrote. */
function readZip(zip: Buffer): { name: string; data: Buffer }[] {
  const end = zip.length - 22;
  expect(zip.readUInt32LE(end)).toBe(0x06054b50);
  const count = zip.readUInt16LE(end + 10);
  let at = zip.readUInt32LE(end + 16);
  const files = [];
  for (let i = 0; i < count; i++) {
    expect(zip.readUInt32LE(at)).toBe(0x02014b50);
    const crc = zip.readUInt32LE(at + 16);
    const size = zip.readUInt32LE(at + 20);
    const nameLength = zip.readUInt16LE(at + 28);
    const offset = zip.readUInt32LE(at + 42);
    const name = zip.subarray(at + 46, at + 46 + nameLength).toString("utf8");
    expect(zip.readUInt32LE(offset)).toBe(0x04034b50);
    const localNameLength = zip.readUInt16LE(offset + 26);
    const data = zip.subarray(offset + 30 + localNameLength, offset + 30 + localNameLength + size);
    expect(crc32(data)).toBe(crc);
    files.push({ name, data });
    at += 46 + nameLength;
  }
  return files;
}

describe("zip", () => {
  it("computes the standard CRC-32", () => {
    const data = Buffer.from("Le Killer du CLHUB");
    expect(crc32(data)).toBe(zlibCrc32(data));
  });

  it("stores each file with its accented name and exact bytes", () => {
    const files = [
      { name: "Élodie.jpg", data: Buffer.from([1, 2, 3, 255]) },
      { name: "Zoé (2).jpg", data: Buffer.alloc(5000, 7) },
    ];
    const back = readZip(buildZip(files));
    expect(back.map((f) => f.name)).toEqual(["Élodie.jpg", "Zoé (2).jpg"]);
    back.forEach((f, i) => expect(f.data.equals(files[i]!.data)).toBe(true));
  });
});
