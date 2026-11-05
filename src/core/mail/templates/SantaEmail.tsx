/**
 * The Secret Santa's mails, in its neon-Christmas look. Never the name of who was drawn: only the
 * link to the personal page, so nothing shows in a preview on a phone left on the table.
 */
const FONT = "Helvetica, Arial, sans-serif";

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: FONT, backgroundColor: "#0a0f0c", padding: "28px 16px" }}>
      <div style={{ maxWidth: "480px", margin: "0 auto", backgroundColor: "#121a15", borderRadius: "16px", overflow: "hidden", border: "1px solid #2a3a30" }}>
        <div style={{ height: "4px", backgroundColor: "#39ffb0" }} />
        <div style={{ padding: "20px 24px 8px", textAlign: "center" }}>
          <div style={{ fontSize: "30px", lineHeight: "36px" }}>🎁</div>
          <div style={{ color: "#ffcf7a", fontSize: "12px", letterSpacing: "2px", textTransform: "uppercase", marginTop: "6px" }}>Secret Santa · Le CLHUB</div>
        </div>
        <div style={{ padding: "8px 24px 24px" }}>{children}</div>
        <div style={{ height: "4px", backgroundColor: "#ff3b4e" }} />
      </div>
    </div>
  );
}

function Button({ href, label }: { href: string; label: string }) {
  return (
    <div style={{ textAlign: "center", margin: "22px 0 6px" }}>
      <a
        href={href}
        style={{ display: "inline-block", backgroundColor: "#39ffb0", color: "#06140d", fontWeight: 700, fontSize: "16px", padding: "14px 26px", borderRadius: "12px", textDecoration: "none" }}
      >
        {label}
      </a>
    </div>
  );
}

const text = { color: "#f6efe2", fontSize: "15px", lineHeight: 1.55, margin: "0 0 12px" } as const;

export function SantaInviteEmail({
  name,
  title,
  organizer,
  link,
  budget,
  date,
  message,
}: {
  name: string;
  title: string;
  organizer: string;
  link: string;
  budget: string;
  date: string | null;
  message: string;
}) {
  return (
    <Frame>
      <p style={{ ...text, fontSize: "20px", fontWeight: 700, textAlign: "center" }}>{title}</p>
      <p style={text}>Salut {name} !</p>
      <p style={text}>
        {organizer} t&apos;a inscrit·e au Secret Santa, et le tirage vient d&apos;avoir lieu. Quelqu&apos;un t&apos;attend sous le sapin : ouvre ton
        cadeau pour découvrir à qui tu vas offrir le tien. Chut, ça reste entre toi et le Père Noël.
      </p>
      {message && <p style={{ ...text, borderLeft: "3px solid #ff3b4e", paddingLeft: "12px", whiteSpace: "pre-wrap" }}>{message}</p>}
      {(budget || date) && (
        <p style={{ ...text, color: "#ffcf7a" }}>
          {budget && <>Budget : {budget}</>}
          {budget && date && <br />}
          {date && <>Échange des cadeaux : {date}</>}
        </p>
      )}
      <Button href={link} label="Découvrir qui je gâte" />
      <p style={{ color: "#a3ab9f", fontSize: "13px", lineHeight: 1.5, margin: "14px 0 0", textAlign: "center" }}>
        Ce lien est personnel, garde-le pour toi. Sur ta page, tu pourras aussi écrire ta lettre au Père Noël.
      </p>
    </Frame>
  );
}

/** A short nudge: a question, an answer, a letter. It says what happened, never who. */
export function SantaNoticeEmail({ title, heading, body, link, cta }: { title: string; heading: string; body: string; link: string; cta: string }) {
  return (
    <Frame>
      <p style={{ ...text, fontSize: "18px", fontWeight: 700, textAlign: "center" }}>{heading}</p>
      <p style={text}>{body}</p>
      <Button href={link} label={cta} />
      <p style={{ color: "#a3ab9f", fontSize: "13px", margin: "14px 0 0", textAlign: "center" }}>{title}</p>
    </Frame>
  );
}
