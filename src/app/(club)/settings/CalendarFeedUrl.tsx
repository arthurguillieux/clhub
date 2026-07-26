"use client";

import { useState } from "react";
import { Input } from "@/core/ui/components/Field";
import { Button } from "@/core/ui/components/Button";

export function CalendarFeedUrl({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="min-w-0 flex-1">
        <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
      </div>
      <Button type="button" variant="ghost" onClick={handleCopy}>
        {copied ? "Copié !" : "Copier"}
      </Button>
    </div>
  );
}
