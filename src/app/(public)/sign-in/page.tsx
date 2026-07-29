import { Card } from "@/core/ui/components/Card";
import { SignInForm } from "./SignInForm";

export default function SignInPage() {
  return (
    <Card className="p-6">
      <h1 className="font-display text-xl font-extrabold text-ink">Oh, tu veux rejoindre le CLHUB ?</h1>
      <p className="mt-1.5 mb-6 text-sm text-muted">
        Donne-moi ton adresse mail, on va vérifier si tu peux y prétendre. Sinon, circule.
      </p>
      <SignInForm />
    </Card>
  );
}
