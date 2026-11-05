import type { SantaTheme } from "@/modules/santa/themes";

/**
 * The Secret Santa's mails, in the event's theme. Never the name of who was drawn: only the link to
 * the personal page, so nothing shows in a preview on a phone left on the table.
 */
const FONT = "Helvetica, Arial, sans-serif";

const PALETTES = {
  neon: { ground: "#0a0f0c", card: "#121a15", line: "#2a3a30", ink: "#f6efe2", muted: "#a3ab9f", label: "#ffcf7a", accent: "#ff3b4e", detail: "#ffcf7a", button: "#39ffb0", buttonInk: "#06140d" },
  blanc: { ground: "#d9e5ec", card: "#ffffff", line: "#c7d6df", ink: "#17303c", muted: "#4f6b79", label: "#b4233a", accent: "#b4233a", detail: "#8a5300", button: "#17694c", buttonInk: "#ffffff" },
} satisfies Record<SantaTheme, Record<string, string>>;

function Frame({ theme, children }: { theme: SantaTheme; children: React.ReactNode }) {
  const c = PALETTES[theme];
  return (
    <div style={{ fontFamily: FONT, backgroundColor: c.ground, padding: "28px 16px" }}>
      <div style={{ maxWidth: "480px", margin: "0 auto", backgroundColor: c.card, borderRadius: "16px", overflow: "hidden", border: `1px solid ${c.line}` }}>
        <div style={{ height: "4px", backgroundColor: c.button }} />
        <div style={{ padding: "20px 24px 8px", textAlign: "center" }}>
          <div style={{ fontSize: "30px", lineHeight: "36px" }}>🎁</div>
          <div style={{ color: c.label, fontSize: "12px", letterSpacing: "2px", textTransform: "uppercase", marginTop: "6px" }}>Secret Santa · Le CLHUB</div>
        </div>
        <div style={{ padding: "8px 24px 24px" }}>{children}</div>
        <div style={{ height: "4px", backgroundColor: c.accent }} />
      </div>
    </div>
  );
}

function Button({ theme, href, label }: { theme: SantaTheme; href: string; label: string }) {
  const c = PALETTES[theme];
  return (
    <div style={{ textAlign: "center", margin: "22px 0 6px" }}>
      <a
        href={href}
        style={{ display: "inline-block", backgroundColor: c.button, color: c.buttonInk, fontWeight: 700, fontSize: "16px", padding: "14px 26px", borderRadius: "12px", textDecoration: "none" }}
      >
        {label}
      </a>
    </div>
  );
}

const textStyle = (theme: SantaTheme) => ({ color: PALETTES[theme].ink, fontSize: "15px", lineHeight: 1.55, margin: "0 0 12px" }) as const;

export function SantaInviteEmail({
  name,
  title,
  organizer,
  link,
  budget,
  date,
  message,
  theme,
}: {
  name: string;
  title: string;
  organizer: string;
  link: string;
  budget: string;
  date: string | null;
  message: string;
  theme: SantaTheme;
}) {
  const c = PALETTES[theme];
  const text = textStyle(theme);
  return (
    <Frame theme={theme}>
      <p style={{ ...text, fontSize: "20px", fontWeight: 700, textAlign: "center" }}>{title}</p>
      <p style={text}>Salut {name} !</p>
      <p style={text}>
        Le tirage du Secret Santa vient d&apos;avoir lieu, et tu en fais partie. Quelqu&apos;un t&apos;attend sous le sapin : ouvre ton cadeau pour
        découvrir à qui tu vas offrir le tien. Chut, ça reste entre toi et le Père Noël.
      </p>
      {message && <p style={{ ...text, borderLeft: `3px solid ${c.accent}`, paddingLeft: "12px", whiteSpace: "pre-wrap" }}>{message}</p>}
      {(budget || date) && (
        <p style={{ ...text, color: c.detail }}>
          {budget && <>Budget : {budget}</>}
          {budget && date && <br />}
          {date && <>Échange des cadeaux : {date}</>}
        </p>
      )}
      <Button theme={theme} href={link} label="Découvrir qui je gâte" />
      <p style={{ color: c.muted, fontSize: "13px", lineHeight: 1.5, margin: "14px 0 0", textAlign: "center" }}>
        Ce lien est personnel, garde-le pour toi. Sur ta page, tu pourras aussi écrire ta lettre au Père Noël. Une question sur
        l&apos;organisation ? Demande à {organizer}.
      </p>
    </Frame>
  );
}

/** A short nudge: a question, an answer, a letter. It says what happened, never who. */
export function SantaNoticeEmail({ title, heading, body, link, cta, theme }: { title: string; heading: string; body: string; link: string; cta: string; theme: SantaTheme }) {
  const text = textStyle(theme);
  return (
    <Frame theme={theme}>
      <p style={{ ...text, fontSize: "18px", fontWeight: 700, textAlign: "center" }}>{heading}</p>
      <p style={text}>{body}</p>
      <Button theme={theme} href={link} label={cta} />
      <p style={{ color: PALETTES[theme].muted, fontSize: "13px", margin: "14px 0 0", textAlign: "center" }}>{title}</p>
    </Frame>
  );
}
