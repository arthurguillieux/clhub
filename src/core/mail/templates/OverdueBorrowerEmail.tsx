export function OverdueBorrowerEmail({
  itemName,
  ownerName,
  endDateLabel,
  appUrl,
}: {
  itemName: string;
  ownerName: string;
  endDateLabel: string;
  appUrl: string;
}) {
  return (
    <div style={{ fontFamily: "Helvetica, Arial, sans-serif", backgroundColor: "#f4f1ea", padding: "32px" }}>
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
            Petit rappel : <strong>{itemName}</strong> devait être rendu le {endDateLabel}.
          </p>
          <p style={{ fontSize: "15px", color: "#3a3f3a", margin: "0 0 20px" }}>
            {ownerName} n&apos;a pas encore confirmé le retour — pense à le lui rapporter, ou à passer
            par l&apos;appli si c&apos;est déjà fait.
          </p>
          <a
            href={`${appUrl}/pretotheque/mine`}
            style={{
              display: "inline-block",
              backgroundColor: "#1f3d2e",
              color: "#f4f1e6",
              textDecoration: "none",
              padding: "10px 18px",
              borderRadius: "6px",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            Voir mes emprunts
          </a>
        </div>
      </div>
    </div>
  );
}
