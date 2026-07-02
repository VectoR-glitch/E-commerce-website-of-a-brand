import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { approveReview, deleteReview } from "@/app/admin/actions";
import { Stars } from "@/components/stars";
import { ConfirmSubmit } from "@/components/confirm-submit";

export const dynamic = "force-dynamic";

export default async function AdminReviewsPage() {
  await requireAdmin();

  const reviews = await prisma.review.findMany({
    orderBy: [{ approved: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      rating: true,
      title: true,
      body: true,
      approved: true,
      createdAt: true,
      product: { select: { name: true, slug: true } },
      customer: { select: { name: true, email: true } },
    },
  });

  const pending = reviews.filter((r) => !r.approved);
  const live = reviews.filter((r) => r.approved);

  const card = (r: (typeof reviews)[number]) => (
    <div key={r.id} className="border border-line bg-paper p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Stars value={r.rating} size={14} />
          <span className="text-sm font-medium text-ink">{r.product.name}</span>
          {r.approved ? (
            <span className="smallcaps text-xs text-forest">✓ Live</span>
          ) : (
            <span className="smallcaps text-xs text-[#9a6b1f]">Pending</span>
          )}
        </div>
        <span className="text-xs text-ink/45">
          {r.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
        </span>
      </div>
      {r.title && <p className="mt-2 font-serif text-lg">{r.title}</p>}
      <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink/75">{r.body}</p>
      <p className="mt-2 text-xs text-ink/50">
        {r.customer.name || "—"} · {r.customer.email}
      </p>
      <div className="mt-3 flex gap-3">
        {!r.approved && (
          <form action={approveReview}>
            <input type="hidden" name="reviewId" value={r.id} />
            <button className="smallcaps bg-forest px-4 py-1.5 text-bone btn-fill-forest">Approve</button>
          </form>
        )}
        <form action={deleteReview}>
          <input type="hidden" name="reviewId" value={r.id} />
          <ConfirmSubmit
            message="Permanently delete this review?"
            className="smallcaps border border-red-600 px-4 py-1.5 text-red-700 transition-colors hover:bg-red-600 hover:text-white"
          >
            Delete
          </ConfirmSubmit>
        </form>
      </div>
    </div>
  );

  return (
    <div>
      <h1 className="font-serif text-3xl">Reviews</h1>

      <h2 className="mt-6 smallcaps text-brass-deep">
        Pending approval {pending.length > 0 && `(${pending.length})`}
      </h2>
      <div className="mt-3 space-y-3">
        {pending.length > 0 ? pending.map(card) : <p className="text-sm text-ink/50">Nothing waiting.</p>}
      </div>

      <h2 className="mt-10 smallcaps text-brass-deep">Live {live.length > 0 && `(${live.length})`}</h2>
      <div className="mt-3 space-y-3">
        {live.length > 0 ? live.map(card) : <p className="text-sm text-ink/50">No published reviews yet.</p>}
      </div>
    </div>
  );
}
