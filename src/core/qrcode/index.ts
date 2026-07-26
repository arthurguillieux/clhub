import QRCode from "qrcode";

/** SVG markup (not a data URL) — scales cleanly at any print size, unlike a rasterized PNG. */
export async function itemQrSvg(url: string): Promise<string> {
  return QRCode.toString(url, {
    type: "svg",
    margin: 1,
    color: { dark: "#1f3d2e", light: "#00000000" },
  });
}
