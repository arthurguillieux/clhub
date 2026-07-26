/**
 * Plain JSX with inline styles — Resend renders this server-side to HTML.
 * No @react-email/components: it's an optional convenience layer, not
 * required (see resend.com/docs/send-with-nextjs), and its latest npm
 * release is currently flagged deprecated. Inline styles are what actually
 * survives email clients regardless of which approach is used.
 */
export function TestEmail({ recipientName }: { recipientName: string }) {
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
            Salut {recipientName},
          </p>
          <p style={{ fontSize: "15px", color: "#3a3f3a", lineHeight: 1.5, margin: "0 0 12px" }}>
            Si tu lis ce mail, la chaîne d&apos;envoi fonctionne : l&apos;application, Resend, et
            ta boîte de réception sont bien connectés.
          </p>
          <p style={{ fontSize: "15px", color: "#3a3f3a", lineHeight: 1.5, margin: 0 }}>
            Prochaine étape : les vraies notifications de réservation.
          </p>
        </div>
      </div>
    </div>
  );
}
