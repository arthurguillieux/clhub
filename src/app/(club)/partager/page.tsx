import type { Metadata } from "next";
import { PolePage } from "@/core/ui/components/PolePage";

export const metadata: Metadata = { title: "Partager" };

export default function Page() {
  return <PolePage pole="partager" />;
}
