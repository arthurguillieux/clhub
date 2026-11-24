"use client";

import { ErrorScreen } from "@/core/ui/components/ErrorScreen";

export default function ClubError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorScreen {...props} />;
}
