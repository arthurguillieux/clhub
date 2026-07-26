import Link from "next/link";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-16">
      <Link
        href="/sign-in"
        className="mb-8 font-display text-2xl font-extrabold tracking-tight text-ink"
      >
        LE CL<span className="text-primary">HUB</span>
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
