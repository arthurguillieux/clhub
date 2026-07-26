const fieldBase =
  "w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm text-ink " +
  "placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary";

export function Label(props: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className="text-sm font-medium text-ink" {...props} />;
}

export function Input(
  props: React.InputHTMLAttributes<HTMLInputElement> & { ref?: React.Ref<HTMLInputElement> },
) {
  return <input className={fieldBase} {...props} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${fieldBase} min-h-24`} {...props} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={fieldBase} {...props} />;
}

export function FormField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
