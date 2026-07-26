import { Card } from "@/core/ui/components/Card";
import { SignInForm } from "./SignInForm";

export default function SignInPage() {
  return (
    <Card className="p-6">
      <h1 className="font-display text-xl font-extrabold text-ink">Entrer au club</h1>
      <p className="mt-1.5 mb-6 text-sm text-muted">
        Ça ne marche que si tu as été invité·e — colle ton adresse et on t&apos;envoie un lien.
      </p>
      <SignInForm />
    </Card>
  );
}
