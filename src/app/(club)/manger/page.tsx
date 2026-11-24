import type { Metadata } from "next";
import { PolePage } from "@/core/ui/components/PolePage";

export const metadata: Metadata = { title: "Manger" };

export default function Page() {
  return <PolePage pole="manger" />;
}
