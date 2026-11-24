/** A meal's news by mail (invited, a nudge, tomorrow's reminder): warm colours, one button. Inline styles, like the others. */
export function MealEmail({ heading, lines, link, cta }: { heading: string; lines: string[]; link: string; cta: string }) {
  return (
    <div style={{ fontFamily: "Helvetica, Arial, sans-serif", backgroundColor: "#f6ead7", padding: "32px" }}>
      <div style={{ maxWidth: "520px", margin: "0 auto", backgroundColor: "#ffffff", borderRadius: "10px", overflow: "hidden", border: "1px solid #ead8bb" }}>
        <div style={{ backgroundColor: "#2a1d12", padding: "20px 24px" }}>
          <span style={{ color: "#ffc94a", fontSize: "18px", fontWeight: 700 }}>LE CLHUB · les potlucks</span>
        </div>
        <div style={{ padding: "24px" }}>
          <p style={{ fontSize: "18px", color: "#2a1d12", fontWeight: 700, margin: "0 0 12px" }}>{heading}</p>
          {lines.map((l, i) => (
            <p key={i} style={{ fontSize: "15px", color: "#4a3a2a", lineHeight: 1.5, margin: "0 0 8px" }}>
              {l}
            </p>
          ))}
          <a href={link} style={{ display: "inline-block", marginTop: "12px", backgroundColor: "#ffc94a", color: "#2a1d12", padding: "11px 18px", borderRadius: "8px", textDecoration: "none", fontSize: "15px", fontWeight: 700 }}>
            {cta}
          </a>
        </div>
      </div>
    </div>
  );
}
