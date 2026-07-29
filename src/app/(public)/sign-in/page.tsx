import { Card } from "@/core/ui/components/Card";
import { SignInForm } from "./SignInForm";

export default function SignInPage() {
  return (
    <Card className="p-6">
      <h1 className="font-display text-xl font-extrabold text-ink">Halte. Qui va là ?</h1>
      <p className="mt-1.5 mb-6 text-sm text-muted">
        File ton adresse mail — t&apos;as intérêt à être sur la liste. Le CLHUB n&apos;est pas ouvert à
        n&apos;importe qui.
      </p>
      <SignInForm />
    </Card>
  );
}
