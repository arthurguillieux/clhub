"use client";

import { useActionState, useRef, useEffect } from "react";
import { Button } from "@/core/ui/components/Button";
import { Textarea } from "@/core/ui/components/Field";
import { postComment, type PostCommentState } from "./actions";

const initialState: PostCommentState = { status: "idle" };

export function CommentForm({ itemId, itemSlug }: { itemId: string; itemSlug: string }) {
  const action = postComment.bind(null, itemId, itemSlug);
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="mt-4 flex flex-col gap-2">
      <Textarea
        name="body"
        rows={2}
        placeholder="Une astuce, une question sur cet objet..."
        required
      />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending} variant="ghost" className="self-start">
          {pending ? "Envoi..." : "Publier"}
        </Button>
        {state.status === "error" && (
          <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
        )}
      </div>
    </form>
  );
}
