import { loupsFonts } from "./fonts";

export default function LoupsLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${loupsFonts} contents`}>{children}</div>;
}
