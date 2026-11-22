import { loupsFonts } from "@/app/(loups)/fonts";

export default function LoupsClubLayout({ children }: { children: React.ReactNode }) {
  return <div className={loupsFonts}>{children}</div>;
}
