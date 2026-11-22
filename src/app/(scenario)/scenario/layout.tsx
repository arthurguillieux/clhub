import localFont from "next/font/local";
import "./projection.css";

// The scenarios' own type, served by the CLHUB: VT323 for the screens of 1988, IBM Plex Mono for the console.
const vt323 = localFont({ src: "../../fonts/vt323-latin-400-normal.woff2", variable: "--scn-font-vt", display: "swap" });
const plexMono = localFont({ src: "../../fonts/ibm-plex-mono-latin-500-normal.woff2", variable: "--scn-font-mono", display: "swap" });

export default function ScenarioLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${vt323.variable} ${plexMono.variable} contents`}>{children}</div>;
}
