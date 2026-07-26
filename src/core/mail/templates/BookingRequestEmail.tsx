export function BookingRequestEmail({
  itemName,
  borrowerName,
  startDateLabel,
  endDateLabel,
  message,
  approveUrl,
  rejectUrl,
}: {
  itemName: string;
  borrowerName: string;
  startDateLabel: string;
  endDateLabel: string;
  message?: string | null;
  approveUrl: string;
  rejectUrl: string;
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
            {borrowerName} veut emprunter <strong>{itemName}</strong>.
          </p>
          <p style={{ fontSize: "15px", color: "#3a3f3a", margin: "0 0 16px" }}>
            Du {startDateLabel} au {endDateLabel}.
          </p>
          {message && (
            <p
              style={{
                fontSize: "14px",
                color: "#3a3f3a",
                fontStyle: "italic",
                borderLeft: "3px solid #e5e0d5",
                paddingLeft: "12px",
                margin: "0 0 20px",
              }}
            >
              « {message} »
            </p>
          )}
          <table cellPadding={0} cellSpacing={0}>
            <tbody>
              <tr>
                <td style={{ paddingRight: "10px" }}>
                  <a
                    href={approveUrl}
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
                    ✅ J&apos;accepte
                  </a>
                </td>
                <td>
                  <a
                    href={rejectUrl}
                    style={{
                      display: "inline-block",
                      backgroundColor: "transparent",
                      color: "#3a3f3a",
                      textDecoration: "none",
                      padding: "10px 18px",
                      borderRadius: "6px",
                      fontSize: "14px",
                      fontWeight: 600,
                      border: "1px solid #d8d8c8",
                    }}
                  >
                    ❌ Je refuse
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
          <p style={{ fontSize: "12px", color: "#8a8f8a", marginTop: "20px" }}>
            Chaque lien t&apos;amène à une page de confirmation — rien n&apos;est décidé avant
            que tu cliques sur le bouton qui s&apos;y trouve.
          </p>
        </div>
      </div>
    </div>
  );
}
