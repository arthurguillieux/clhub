"use client";

import { ErrorScreen } from "@/core/ui/components/ErrorScreen";

/** Any page outside the club pages (games, letters, invitations…) that breaks gets the same French screen. */
export default function RootError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorScreen {...props} />;
}
