import { Suspense } from "react";
import { Toaster } from "@/core/ui/components/Toaster";

/** A guest's page without an account: the club's look, its little confirmations, no header. */
export default function NewYearGuestLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Suspense>
        <Toaster />
      </Suspense>
    </>
  );
}
