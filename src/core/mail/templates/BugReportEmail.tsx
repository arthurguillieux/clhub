/** A member reported a bug: the admins read it at once, with a link to sort it out. Inline styles, like the others. */
export function BugReportEmail({ who, page, message, link }: { who: string; page: string | null; message: string; link: string }) {
  return (
    <div style={{ fontFamily: "Helvetica, Arial, sans-serif", backgroundColor: "#f4f1ea", padding: "32px" }}>
      <div style={{ maxWidth: "520px", margin: "0 auto", backgroundColor: "#ffffff", borderRadius: "8px", overflow: "hidden", border: "1px solid #e5e0d5" }}>
        <div style={{ backgroundColor: "#1f3d2e", padding: "20px 24px" }}>
          <span style={{ color: "#f4f1ea", fontSize: "18px", fontWeight: 700 }}>LE CLHUB · signalement</span>
        </div>
        <div style={{ padding: "24px" }}>
          <p style={{ fontSize: "16px", color: "#1f2320", margin: "0 0 12px" }}>
            <b>{who}</b> signale un problème{page ? ` sur ${page}` : ""} :
          </p>
          <p style={{ fontSize: "15px", color: "#3a3f3a", lineHeight: 1.5, margin: "0 0 20px", whiteSpace: "pre-wrap", borderLeft: "3px solid #c8502a", paddingLeft: "12px" }}>{message}</p>
          <a href={link} style={{ display: "inline-block", backgroundColor: "#1f3d2e", color: "#f4f1ea", padding: "10px 16px", borderRadius: "6px", textDecoration: "none", fontSize: "14px" }}>
            Voir les signalements
          </a>
        </div>
      </div>
    </div>
  );
}
