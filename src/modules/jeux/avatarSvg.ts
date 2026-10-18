import { avatarById } from "./domain/avatars";

/**
 * The buzzer animals, drawn as inline SVG with a thick dark outline. Ported
 * from the APE Lassy quiz night's buzzer; the body colour is the team's
 * neon colour (see domain/avatars.ts). The markup is built only from the
 * constants below, never from user input, so it's safe to inject as HTML.
 */
const INK = "#151515";
const S = `stroke="${INK}" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round"`;

const eye = (x: number, y: number, r = 5) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${INK}"/><circle cx="${x + r * 0.35}" cy="${y - r * 0.38}" r="${r * 0.36}" fill="#fff"/>`;
const smile = (d: string) => `<path d="${d}" fill="none" ${S}/>`;
const blush = (x: number, y: number) => `<ellipse cx="${x}" cy="${y}" rx="6" ry="4" fill="#ff5c8a" opacity=".5"/>`;

const DRAW: Record<string, (c: string) => string> = {
  renard: (c) => `
    <polygon points="14,46 16,10 42,30" fill="${c}" ${S}/><polygon points="86,46 84,10 58,30" fill="${c}" ${S}/>
    <polygon points="21,38 22,21 33,30" fill="#fff"/><polygon points="79,38 78,21 67,30" fill="#fff"/>
    <path d="M50 90 C22 90 8 66 12 48 C26 54 38 40 50 40 C62 40 74 54 88 48 C92 66 78 90 50 90 Z" fill="${c}" ${S}/>
    <path d="M50 90 C34 90 26 79 28 68 C38 72 44 66 50 66 C56 66 62 72 72 68 C74 79 66 90 50 90 Z" fill="#fff" ${S}/>
    <ellipse cx="50" cy="68" rx="6" ry="4.5" fill="${INK}"/>${eye(34, 54)}${eye(66, 54)}${smile("M44 79 Q50 84 56 79")}`,
  grenouille: (c) => `
    <circle cx="28" cy="36" r="15" fill="${c}" ${S}/><circle cx="72" cy="36" r="15" fill="${c}" ${S}/>
    <ellipse cx="50" cy="60" rx="40" ry="30" fill="${c}" ${S}/>
    <circle cx="28" cy="35" r="9" fill="#fff" stroke="${INK}" stroke-width="3"/><circle cx="72" cy="35" r="9" fill="#fff" stroke="${INK}" stroke-width="3"/>
    <circle cx="30" cy="36" r="4.5" fill="${INK}"/><circle cx="70" cy="36" r="4.5" fill="${INK}"/>
    <circle cx="45" cy="52" r="2.2" fill="${INK}"/><circle cx="55" cy="52" r="2.2" fill="${INK}"/>
    ${smile("M22 64 Q50 92 78 64")}${blush(20, 62)}${blush(80, 62)}`,
  poussin: (c) => `
    <path d="M42 22 Q36 8 45 10 M50 20 Q50 3 58 8 M58 22 Q64 10 70 16" fill="none" ${S}/>
    <ellipse cx="50" cy="57" rx="38" ry="35" fill="${c}" ${S}/>
    ${eye(35, 50)}${eye(65, 50)}${blush(25, 63)}${blush(75, 63)}
    <path d="M41 58 L59 58 L50 71 Z" fill="#ff8c1a" ${S}/>`,
  cochon: (c) => `
    <polygon points="16,18 42,26 20,48" fill="${c}" ${S}/><polygon points="84,18 58,26 80,48" fill="${c}" ${S}/>
    <circle cx="50" cy="56" r="36" fill="${c}" ${S}/>
    <ellipse cx="50" cy="65" rx="17" ry="13" fill="#ffa6cb" ${S}/>
    <ellipse cx="44" cy="65" rx="2.6" ry="4.2" fill="${INK}"/><ellipse cx="56" cy="65" rx="2.6" ry="4.2" fill="${INK}"/>
    ${eye(33, 46)}${eye(67, 46)}`,
  pieuvre: (c) => `
    <circle cx="22" cy="80" r="10" fill="${c}" ${S}/><circle cx="41" cy="88" r="10" fill="${c}" ${S}/>
    <circle cx="59" cy="88" r="10" fill="${c}" ${S}/><circle cx="78" cy="80" r="10" fill="${c}" ${S}/>
    <circle cx="50" cy="46" r="37" fill="${c}" ${S}/>
    <circle cx="30" cy="26" r="4" fill="#fff" opacity=".45"/>
    ${eye(37, 44, 6)}${eye(63, 44, 6)}${blush(26, 57)}${blush(74, 57)}${smile("M41 60 Q50 70 59 60")}`,
  baleine: (c) => `
    <path d="M74 58 C86 58 92 50 90 36 C98 38 99 52 94 62 C90 70 80 68 74 66 Z" fill="${c}" ${S}/>
    <ellipse cx="44" cy="60" rx="36" ry="28" fill="${c}" ${S}/>
    <ellipse cx="44" cy="77" rx="26" ry="9" fill="#dff2ff"/>
    <path d="M38 33 Q36 21 28 16 M38 33 Q40 21 48 16" fill="none" stroke="#7cc4ff" stroke-width="4.5" stroke-linecap="round"/>
    ${eye(27, 54)}${blush(20, 65)}${smile("M17 63 Q26 73 36 66")}`,
  crabe: (c) => `
    <path d="M20 68 L7 77 M24 77 L14 90 M80 68 L93 77 M76 77 L86 90" fill="none" ${S}/>
    <path d="M26 54 L15 40 M74 54 L85 40" fill="none" ${S}/>
    <circle cx="14" cy="30" r="12" fill="${c}" ${S}/><circle cx="86" cy="30" r="12" fill="${c}" ${S}/>
    <path d="M10 21 L14 30 L18 21 M82 21 L86 30 L90 21" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
    <ellipse cx="50" cy="63" rx="36" ry="26" fill="${c}" ${S}/>
    <path d="M38 40 L38 28 M62 40 L62 28" fill="none" ${S}/>
    <circle cx="38" cy="24" r="9" fill="#fff" stroke="${INK}" stroke-width="3.5"/><circle cx="62" cy="24" r="9" fill="#fff" stroke="${INK}" stroke-width="3.5"/>
    <circle cx="38" cy="25" r="4.2" fill="${INK}"/><circle cx="62" cy="25" r="4.2" fill="${INK}"/>
    ${smile("M40 67 Q50 77 60 67")}${blush(27, 66)}${blush(73, 66)}`,
  dino: (c) => `
    <polygon points="22,36 31,10 44,28" fill="#f4c430" ${S}/><polygon points="40,26 51,4 62,24" fill="#f4c430" ${S}/><polygon points="58,28 72,10 78,36" fill="#f4c430" ${S}/>
    <ellipse cx="50" cy="59" rx="38" ry="32" fill="${c}" ${S}/>
    <circle cx="44" cy="56" r="2.4" fill="${INK}"/><circle cx="56" cy="56" r="2.4" fill="${INK}"/>
    ${eye(33, 45)}${eye(67, 45)}${blush(23, 60)}${blush(77, 60)}
    ${smile("M33 68 Q50 83 67 68")}<path d="M45 75 L49 83 L53 75" fill="#fff" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`,
};

export function avatarSvg(id: string): string {
  const avatar = avatarById(id);
  const draw = avatar ? DRAW[avatar.id] : undefined;
  const inner = avatar && draw ? draw(avatar.color) : `<circle cx="50" cy="50" r="38" fill="#ddd" ${S}/>`;
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`;
}
