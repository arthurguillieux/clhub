import Link from "next/link";

export const buttonVariants = {
  primary: "bg-primary text-primary-ink hover:opacity-90",
  accent: "bg-accent text-accent-ink hover:opacity-90",
  ghost: "border border-line bg-transparent text-ink hover:bg-surface",
} as const;

export type ButtonVariant = keyof typeof buttonVariants;

const base =
  "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold " +
  "transition-opacity disabled:pointer-events-none disabled:opacity-50 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-ground";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button className={`${base} ${buttonVariants[variant]} ${className}`} {...props} />;
}

export function LinkButton({
  variant = "primary",
  className = "",
  href,
  children,
}: {
  variant?: ButtonVariant;
  className?: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={`${base} ${buttonVariants[variant]} ${className}`}>
      {children}
    </Link>
  );
}
