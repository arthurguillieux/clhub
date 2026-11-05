import type { SantaTheme } from "@/modules/santa/themes";
import { Garland, Snow } from "./Snow";
import { WinterScene } from "./WinterScene";
import { WinterSnow } from "./WinterSnow";

/** The page of a Secret Santa, dressed in its theme. */
export function SantaScene({ theme, className, children }: { theme: SantaTheme; className: string; children: React.ReactNode }) {
  return (
    <main className={`santa${theme === "blanc" ? " santa-blanc" : ""} relative min-h-dvh overflow-x-clip px-4 pt-12 ${className}`}>
      {theme === "blanc" ? (
        <>
          <WinterScene />
          <WinterSnow />
        </>
      ) : (
        <>
          <Snow />
          <Garland />
        </>
      )}
      {children}
    </main>
  );
}
