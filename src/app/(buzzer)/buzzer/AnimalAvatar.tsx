import { avatarSvg } from "@/modules/jeux/avatarSvg";

/** Sized by its parent (`h-*`/`w-*` on `className`); the SVG fills it. */
export function AnimalAvatar({ id, className = "" }: { id: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block [&>svg]:block [&>svg]:h-full [&>svg]:w-full ${className}`}
      // Markup comes from avatarSvg(), built from constants only — never from user input.
      dangerouslySetInnerHTML={{ __html: avatarSvg(id) }}
    />
  );
}
