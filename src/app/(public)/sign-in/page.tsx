import { SignInForm } from "./SignInForm";

export default function SignInPage() {
  return (
    <main style={{ maxWidth: "400px", margin: "48px auto", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: "20px" }}>LE CLHUB</h1>
      <p style={{ color: "#555", fontSize: "14px" }}>
        Entre ton adresse mail — ça ne marche que si tu as été invité·e.
      </p>
      <SignInForm />
    </main>
  );
}
