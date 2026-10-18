import localFont from "next/font/local";

// The Killer's own type, loaded only on its pages: Michroma for titles (wide, instrument-panel lettering),
// IBM Plex Sans for reading, IBM Plex Mono for the small lab labels.
const michroma = localFont({
  src: "../../fonts/michroma-latin-400-normal.woff2",
  variable: "--k-font-display",
  display: "swap",
});
const plexSans = localFont({
  src: [
    { path: "../../fonts/ibm-plex-sans-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../../fonts/ibm-plex-sans-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--k-font-body",
  display: "swap",
});
const plexMono = localFont({
  src: "../../fonts/ibm-plex-mono-latin-500-normal.woff2",
  variable: "--k-font-mono",
  display: "swap",
});

export default function KillerLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${michroma.variable} ${plexSans.variable} ${plexMono.variable} contents`}>{children}</div>;
}
