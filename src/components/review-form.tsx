"use client";
import { useActionState, useState } from "react";
import { submitReviewAction, type ReviewState } from "@/app/actions/reviews";

const field =
  "mt-2 w-full border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-forest";

// Write / edit a review. Rendered only for signed-in customers who bought the
// product. `existing` prefills the fields when they've reviewed before.
export function ReviewForm({
  productId,
  slug,
  existing,
}: {
  productId: string;
  slug: string;
  existing: { rating: number; title: string | null; body: string; approved: boolean } | null;
}) {
  const [state, action, pending] = useActionState<ReviewState, FormData>(
    submitReviewAction,
    undefined,
  );
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [hover, setHover] = useState(0);

  const done = state?.ok;

  return (
    <form action={action} className="mt-4 border border-line bg-paper p-5">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="rating" value={rating} />

      <p className="smallcaps text-brass-deep">
        {existing ? "Edit your review" : "Write a review"}
      </p>

      {existing && !done && (
        <p className="mt-1 text-xs text-ink/55">
          {existing.approved
            ? "Your review is live. Editing it will send it back for approval."
            : "Your review is awaiting approval."}
        </p>
      )}

      {/* Star picker */}
      <div className="mt-3 flex items-center gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            className="p-0.5 leading-none"
          >
            <svg
              width={26}
              height={26}
              viewBox="0 0 20 20"
              fill={(hover || rating) >= n ? "var(--color-brass)" : "var(--color-line)"}
              aria-hidden="true"
            >
              <path d="M10 1.6l2.47 5.01 5.53.8-4 3.9.94 5.5L10 14.2l-4.94 2.6.94-5.5-4-3.9 5.53-.8L10 1.6z" />
            </svg>
          </button>
        ))}
      </div>

      <label htmlFor="review-title" className="sr-only">Review title (optional)</label>
      <input
        id="review-title"
        name="title"
        defaultValue={existing?.title ?? ""}
        placeholder="Title (optional)"
        maxLength={120}
        className={field}
      />
      <label htmlFor="review-body" className="sr-only">Your review</label>
      <textarea
        id="review-body"
        name="body"
        defaultValue={existing?.body ?? ""}
        placeholder="How did it work for you?"
        rows={4}
        required
        minLength={10}
        maxLength={2000}
        className={field}
      />

      {state?.error && <p role="alert" className="mt-2 text-sm text-red-700">{state.error}</p>}
      {done && (
        <p role="status" className="mt-2 text-sm text-forest">
          Thanks! Your review will appear once we&rsquo;ve approved it.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="smallcaps mt-3 bg-forest px-6 py-2.5 text-bone btn-fill-forest disabled:opacity-60"
      >
        {pending ? "Submitting…" : existing ? "Update review" : "Submit review"}
      </button>
    </form>
  );
}
