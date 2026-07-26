export function InvitationEmail({
  inviterName,
  url,
}: {
  inviterName: string;
  url: string;
}) {
  return (
    <div
      style={{
        fontFamily: "Helvetica, Arial, sans-serif",
        backgroundColor: "#f4f1ea",
        padding: "32px",
      }}
    >
      <div
        style={{
          maxWidth: "480px",
          margin: "0 auto",
          backgroundColor: "#ffffff",
          borderRadius: "8px",
          overflow: "hidden",
          border: "1px solid #e5e0d5",
        }}
      >
        <div style={{ backgroundColor: "#1f3d2e", padding: "20px 24px" }}>
          <span style={{ color: "#f4f1ea", fontSize: "18px", fontWeight: 700 }}>LE CLHUB</span>
        </div>
        <div style={{ padding: "24px" }}>
          <p style={{ fontSize: "16px", color: "#1f2320", margin: "0 0 12px" }}>
            {inviterName} t&apos;invite à rejoindre LE CLHUB.
          </p>
          <p style={{ fontSize: "15px", color: "#3a3f3a", lineHeight: 1.5, margin: "0 0 20px" }}>
            Clique ci-dessous pour entrer — pas de mot de passe à retenir, juste ton adresse mail.
          </p>
          <a
            href={url}
            style={{
              display: "inline-block",
              backgroundColor: "#1f3d2e",
              color: "#f4f1ea",
              textDecoration: "none",
              padding: "10px 20px",
              borderRadius: "6px",
              fontSize: "15px",
              fontWeight: 600,
            }}
          >
            Rejoindre le club
          </a>
        </div>
      </div>
    </div>
  );
}
