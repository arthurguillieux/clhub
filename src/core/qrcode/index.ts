import QRCode from "qrcode";

/** SVG markup (not a data URL) — scales cleanly at any print size, unlike a rasterized PNG. */
export async function itemQrSvg(url: string): Promise<string> {
  return QRCode.toString(url, {
    type: "svg",
    margin: 1,
    color: { dark: "#1f3d2e", light: "#00000000" },
  });
}

/**
 * Same idea, but plain dark-on-white: this one is scanned off a projector or
 * a laptop across a room, where contrast beats matching the theme.
 */
export async function buzzerQrSvg(url: string): Promise<string> {
  return QRCode.toString(url, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#08080d", light: "#ffffff" },
  });
}
