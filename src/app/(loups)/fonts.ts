import localFont from "next/font/local";

// The Loups-garous' own type, after the APE poster: onciales for the titles, condensed capitals for the rest.
export const uncial = localFont({ src: "../fonts/uncial-antiqua-latin-400-normal.woff2", variable: "--lg-font-title", display: "swap" });
export const barlow = localFont({
  src: [
    { path: "../fonts/barlow-semi-condensed-latin-600-normal.woff2", weight: "600" },
    { path: "../fonts/barlow-semi-condensed-latin-800-normal.woff2", weight: "800" },
  ],
  variable: "--lg-font-caps",
  display: "swap",
});
export const loupsFonts = `${uncial.variable} ${barlow.variable}`;
