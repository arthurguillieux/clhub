/**
 * A New Year's mail (the invitation, the request to pay, a reminder): Célébrer's pink, a block for
 * the amount when there is one, one button to the guest's personal page. Inline styles, like the others.
 */
export function NyeEmail({ heading, lines, amount, payment, link, cta }: { heading: string; lines: string[]; amount?: string | null; payment?: string | null; link: string; cta: string }) {
  return (
    <div style={{ fontFamily: "Helvetica, Arial, sans-serif", backgroundColor: "#fbe7f4", padding: "32px" }}>
      <div style={{ maxWidth: "520px", margin: "0 auto", backgroundColor: "#ffffff", borderRadius: "10px", overflow: "hidden", border: "1px solid #f3c6e3" }}>
        <div style={{ backgroundColor: "#1a0512", padding: "20px 24px" }}>
          <span style={{ color: "#ff3ec9", fontSize: "18px", fontWeight: 700 }}>LE CLHUB · nouvel an</span>
        </div>
        <div style={{ padding: "24px" }}>
          <p style={{ fontSize: "18px", color: "#1a0512", fontWeight: 700, margin: "0 0 12px" }}>{heading}</p>
          {lines.map((l, i) => (
            <p key={i} style={{ fontSize: "15px", color: "#4a2a3d", lineHeight: 1.5, margin: "0 0 8px", whiteSpace: "pre-wrap" }}>
              {l}
            </p>
          ))}
          {amount && (
            <div style={{ margin: "16px 0 4px", padding: "14px 16px", borderRadius: "8px", backgroundColor: "#fbe7f4", border: "1px solid #f3c6e3" }}>
              <p style={{ fontSize: "13px", color: "#8a6a7d", margin: "0 0 4px" }}>Ta participation</p>
              <p style={{ fontSize: "24px", color: "#1a0512", fontWeight: 700, margin: 0 }}>{amount}</p>
              {payment && <p style={{ fontSize: "15px", color: "#4a2a3d", lineHeight: 1.5, margin: "8px 0 0", whiteSpace: "pre-wrap" }}>{payment}</p>}
            </div>
          )}
          <a href={link} style={{ display: "inline-block", marginTop: "12px", backgroundColor: "#ff3ec9", color: "#1a0512", padding: "11px 18px", borderRadius: "8px", textDecoration: "none", fontSize: "15px", fontWeight: 700 }}>
            {cta}
          </a>
          <p style={{ fontSize: "13px", color: "#8a6a7d", lineHeight: 1.5, margin: "20px 0 0" }}>Ce lien est le tien : il ouvre ta page sans mot de passe. Ne le transfère pas.</p>
        </div>
      </div>
    </div>
  );
}
