/**
 * A porcelain android bust — white shell, black glass visor, a line of light for eyes — on a studio
 * grey ground, in the Killer's lab look. Used for the Test game's made-up agents (rendered to WebP
 * on the server) and, with its visor switched off, for any agent who hasn't taken a photo yet.
 * No text, so it renders the same everywhere, system fonts or not.
 */
export function androidSvg({ glow, tilt = 0 }: { glow: string | null; tilt?: number }): string {
  const light = glow ?? "#59646e";
  const halo = glow
    ? `<path d="M162 176 H238" stroke="${glow}" stroke-width="10" stroke-linecap="round" filter="url(#blur)"/>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <defs>
    <radialGradient id="bg" cx="50%" cy="30%" r="85%">
      <stop offset="0" stop-color="#eef1f4"/>
      <stop offset="0.6" stop-color="#cdd4da"/>
      <stop offset="1" stop-color="#a7b1ba"/>
    </radialGradient>
    <radialGradient id="shell" cx="38%" cy="28%" r="80%">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="0.7" stop-color="#e9edf0"/>
      <stop offset="1" stop-color="#bfc7ce"/>
    </radialGradient>
    <linearGradient id="body" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#cdd4da"/>
    </linearGradient>
    <linearGradient id="visor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3c454e"/>
      <stop offset="1" stop-color="#0b0f12"/>
    </linearGradient>
    <filter id="blur" x="-50%" y="-200%" width="200%" height="500%"><feGaussianBlur stdDeviation="5"/></filter>
  </defs>
  <rect width="400" height="400" fill="url(#bg)"/>
  <g transform="translate(200 232) scale(1.22) translate(-200 -200)">
  <path d="M48 400 C58 318 120 286 200 286 C280 286 342 318 352 400 Z" fill="url(#body)" stroke="#aeb8c1" stroke-width="2"/>
  <path d="M120 330 C150 312 250 312 280 330" fill="none" stroke="#b5bec6" stroke-width="2"/>
  <rect x="176" y="236" width="48" height="62" rx="10" fill="#2a3138"/>
  <path d="M176 254 H224 M176 270 H224" stroke="${light}" stroke-width="2" opacity="0.8"/>
  <g transform="rotate(${tilt} 200 170)">
    <path d="M200 62 C142 62 118 112 120 166 C122 220 158 256 200 256 C242 256 278 220 280 166 C282 112 258 62 200 62 Z" fill="url(#shell)" stroke="#aeb8c1" stroke-width="2"/>
    <path d="M200 62 C200 100 200 130 200 150" stroke="#d3d9de" stroke-width="2" fill="none"/>
    <circle cx="126" cy="170" r="16" fill="#e9edf0" stroke="#aeb7bf" stroke-width="3"/>
    <circle cx="126" cy="170" r="5" fill="${light}"/>
    <circle cx="274" cy="170" r="16" fill="#e9edf0" stroke="#aeb7bf" stroke-width="3"/>
    <path d="M136 150 C150 136 250 136 264 150 C270 170 262 198 246 204 C220 212 180 212 154 204 C138 198 130 170 136 150 Z" fill="url(#visor)"/>
    <path d="M150 148 C170 140 230 140 250 148" stroke="#ffffff" stroke-opacity="0.35" stroke-width="3" fill="none"/>
    ${halo}
    <path d="M164 176 H236" stroke="${light}" stroke-width="4" stroke-linecap="round"/>
  </g>
  </g>
</svg>`;
}

/** The visor-off android, ready for an <img src>: an agent who hasn't taken a photo yet. */
export const ANDROID_PLACEHOLDER = `data:image/svg+xml;utf8,${encodeURIComponent(androidSvg({ glow: null }))}`;
