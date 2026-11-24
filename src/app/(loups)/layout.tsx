import { loupsFonts } from "./fonts";

export default function LoupsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-own-theme="" className={`${loupsFonts} contents`}>
      {children}
    </div>
  );
}
