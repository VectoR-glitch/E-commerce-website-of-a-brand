"use client";
import { useActionState } from "react";
import { askQuestionAction, type QuestionState } from "@/app/actions/product-qa";

const field =
  "mt-2 w-full border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-forest";

// Ask a question about the product. Rendered only for signed-in customers (no
// purchase required). The question lands in the moderation queue and appears
// publicly once the store answers it.
export function AskQuestionForm({ productId, slug }: { productId: string; slug: string }) {
  const [state, action, pending] = useActionState<QuestionState, FormData>(
    askQuestionAction,
    undefined,
  );

  const done = state?.ok;

  return (
    <form action={action} className="mt-4 border border-line bg-paper p-5">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="slug" value={slug} />

      <p className="smallcaps text-brass-deep">Ask a question</p>
      <p className="mt-1 text-xs text-ink/55">
        We&rsquo;ll answer publicly here so it helps the next shopper too.
      </p>

      <label htmlFor="question-body" className="sr-only">Your question</label>
      <textarea
        id="question-body"
        name="question"
        placeholder="e.g. Is the floor cleaner safe to use around pets?"
        rows={3}
        required
        minLength={10}
        maxLength={500}
        className={field}
      />

      {state?.error && <p role="alert" className="mt-2 text-sm text-red-700">{state.error}</p>}
      {done && (
        <p role="status" className="mt-2 text-sm text-forest">
          Thanks! We&rsquo;ll post an answer here soon.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="smallcaps mt-3 bg-forest px-6 py-2.5 text-bone btn-fill-forest disabled:opacity-60"
      >
        {pending ? "Sending…" : "Submit question"}
      </button>
    </form>
  );
}
