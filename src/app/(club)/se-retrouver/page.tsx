import type { Metadata } from "next";
import { PolePage } from "@/core/ui/components/PolePage";

export const metadata: Metadata = { title: "Se retrouver" };

export default function Page() {
  return <PolePage pole="retrouver" />;
}
