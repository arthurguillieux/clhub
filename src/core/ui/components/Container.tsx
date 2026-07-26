const WIDTHS = { sm: "max-w-md", md: "max-w-2xl", lg: "max-w-4xl" } as const;

export function Container({
  children,
  size = "md",
}: {
  children: React.ReactNode;
  size?: keyof typeof WIDTHS;
}) {
  return <main className={`${WIDTHS[size]} mx-auto w-full px-4 py-10 sm:px-6`}>{children}</main>;
}
