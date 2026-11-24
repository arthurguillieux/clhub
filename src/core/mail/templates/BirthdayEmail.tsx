/** A birthday's news by mail (invited, the present chosen, bought): Célébrer's pink, one button. Inline styles, like the others. */
export function BirthdayEmail({ heading, lines, link, cta }: { heading: string; lines: string[]; link: string; cta: string }) {
  return (
    <div style={{ fontFamily: "Helvetica, Arial, sans-serif", backgroundColor: "#fbe7f4", padding: "32px" }}>
      <div style={{ maxWidth: "520px", margin: "0 auto", backgroundColor: "#ffffff", borderRadius: "10px", overflow: "hidden", border: "1px solid #f3c6e3" }}>
        <div style={{ backgroundColor: "#1a0512", padding: "20px 24px" }}>
          <span style={{ color: "#ff3ec9", fontSize: "18px", fontWeight: 700 }}>LE CLHUB · un anniversaire</span>
        </div>
        <div style={{ padding: "24px" }}>
          <p style={{ fontSize: "18px", color: "#1a0512", fontWeight: 700, margin: "0 0 12px" }}>{heading}</p>
          {lines.map((l, i) => (
            <p key={i} style={{ fontSize: "15px", color: "#4a2a3d", lineHeight: 1.5, margin: "0 0 8px" }}>
              {l}
            </p>
          ))}
          <a href={link} style={{ display: "inline-block", marginTop: "12px", backgroundColor: "#ff3ec9", color: "#1a0512", padding: "11px 18px", borderRadius: "8px", textDecoration: "none", fontSize: "15px", fontWeight: 700 }}>
            {cta}
          </a>
          <p style={{ fontSize: "13px", color: "#8a6a7d", lineHeight: 1.5, margin: "20px 0 0" }}>C&apos;est une surprise : pas un mot à la personne fêtée !</p>
        </div>
      </div>
    </div>
  );
}
