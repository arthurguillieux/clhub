import { ANDROID_PLACEHOLDER } from "@/modules/killer/android";

/** An agent's selfie, or a porcelain android with its visor off while they haven't taken one yet. Sized by `className`. */
export function TributePhoto({
  code,
  id,
  name,
  photoVersion,
  fallen = false,
  className = "",
}: {
  code: string;
  id: string;
  name: string;
  photoVersion: number | null;
  fallen?: boolean;
  className?: string;
}) {
  const src = photoVersion === null ? ANDROID_PLACEHOLDER : `/api/killer/${code}/photo/${id}?v=${photoVersion}`;
  return (
    <div className={`killer-portrait aspect-square overflow-hidden rounded-full ${fallen ? "fallen" : ""} ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- small selfie served from the database, or an inline drawing */}
      <img src={src} alt={name} className="h-full w-full object-cover" />
    </div>
  );
}
