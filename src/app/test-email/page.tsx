import { TestEmailForm } from "./TestEmailForm";

export default function TestEmailPage() {
  return (
    <main style={{ maxWidth: "400px", margin: "48px auto", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: "20px" }}>Lot 0 — test d&apos;envoi Resend</h1>
      <p style={{ color: "#555", fontSize: "14px" }}>
        Page temporaire pour vérifier la chaîne d&apos;envoi de bout en bout avant le lot 1.
      </p>
      <TestEmailForm />
    </main>
  );
}
