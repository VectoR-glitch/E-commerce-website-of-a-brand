import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { answerQuestion, unpublishQuestion, deleteQuestion } from "@/app/admin/actions";
import { ConfirmSubmit } from "@/components/confirm-submit";

export const dynamic = "force-dynamic";

const dateFmt = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

const answerField =
  "mt-2 w-full border border-line bg-white px-3 py-2 text-sm outline-none focus:border-forest";

const QUESTION_SELECT = {
  id: true,
  question: true,
  answer: true,
  published: true,
  isFaq: true,
  askedName: true,
  createdAt: true,
  answeredAt: true,
  product: { select: { name: true } },
  customer: { select: { email: true } },
} as const;

const PAGE_SIZE = 50;

export default async function AdminQuestionsPage(props: { searchParams: Promise<{ page?: string }> }) {
  await requireAdmin();
  const sp = await props.searchParams;
  const page = Math.max(1, Math.floor(Number(sp.page)) || 1);

  // Pending is queried unpaginated — it's an actively-worked moderation queue
  // the admin needs to see in full to clear, not an ever-growing archive.
  // Answered (every answered question, ever) is the side that actually grows
  // unbounded with customer/product traffic, so that's the one paginated —
  // same asymmetric split as admin/reviews.
  const [pending, liveRows] = await Promise.all([
    prisma.productQuestion.findMany({
      where: { answer: null },
      orderBy: { createdAt: "desc" },
      select: QUESTION_SELECT,
    }),
    prisma.productQuestion.findMany({
      where: { answer: { not: null } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE + 1,
      select: QUESTION_SELECT,
    }),
  ]);
  const hasNext = liveRows.length > PAGE_SIZE;
  const live = liveRows.slice(0, PAGE_SIZE);

  const asker = (q: (typeof pending)[number]) => (
    <p className="mt-1 text-xs text-ink/50">
      Asked by {q.askedName || "—"}
      {q.customer?.email ? ` · ${q.customer.email}` : ""}
    </p>
  );

  const deleteForm = (q: (typeof pending)[number]) => (
    <form action={deleteQuestion}>
      <input type="hidden" name="questionId" value={q.id} />
      <ConfirmSubmit
        message="Permanently delete this question?"
        className="smallcaps border border-red-600 px-4 py-1.5 text-red-700 transition-colors hover:bg-red-600 hover:text-white"
      >
        Delete
      </ConfirmSubmit>
    </form>
  );

  const pendingCard = (q: (typeof pending)[number]) => (
    <div key={q.id} className="border border-line bg-paper p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-ink">{q.product.name}</span>
        <span className="text-xs text-ink/45">{dateFmt(q.createdAt)}</span>
      </div>
      <p className="mt-2 font-serif text-lg">{q.question}</p>
      {asker(q)}
      <form action={answerQuestion} className="mt-3">
        <input type="hidden" name="questionId" value={q.id} />
        <textarea
          name="answer"
          rows={3}
          required
          minLength={2}
          maxLength={2000}
          placeholder="Write the store's answer — it publishes when you save."
          className={answerField}
        />
        <button className="smallcaps mt-2 bg-forest px-4 py-1.5 text-bone btn-fill-forest">
          Answer &amp; publish
        </button>
      </form>
      <div className="mt-2">{deleteForm(q)}</div>
    </div>
  );

  const liveCard = (q: (typeof pending)[number]) => (
    <div key={q.id} className="border border-line bg-paper p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-ink">{q.product.name}</span>
          {q.isFaq ? (
            <span className="smallcaps text-xs text-brass-deep">FAQ</span>
          ) : (
            <span className="smallcaps text-xs text-forest">✓ Answered</span>
          )}
          {!q.published && <span className="smallcaps text-xs text-[#9a6b1f]">Hidden</span>}
        </div>
        <span className="text-xs text-ink/45">
          {q.answeredAt ? dateFmt(q.answeredAt) : dateFmt(q.createdAt)}
        </span>
      </div>
      <p className="mt-2 font-serif text-lg">{q.question}</p>
      {!q.isFaq && asker(q)}
      {/* Edit the answer in place; saving re-publishes it. */}
      <form action={answerQuestion} className="mt-3">
        <input type="hidden" name="questionId" value={q.id} />
        <textarea
          name="answer"
          rows={2}
          required
          minLength={2}
          maxLength={2000}
          defaultValue={q.answer ?? ""}
          className={answerField}
        />
        <button className="smallcaps mt-2 border border-line px-4 py-1.5 text-ink/70 transition-colors hover:border-forest hover:text-forest">
          Save answer
        </button>
      </form>
      <div className="mt-2 flex gap-3">
        {q.published && (
          <form action={unpublishQuestion}>
            <input type="hidden" name="questionId" value={q.id} />
            <button className="smallcaps border border-line px-4 py-1.5 text-ink/70 transition-colors hover:border-[#9a6b1f] hover:text-[#9a6b1f]">
              Hide
            </button>
          </form>
        )}
        {deleteForm(q)}
      </div>
    </div>
  );

  return (
    <div>
      <h1 className="font-serif text-3xl">Questions &amp; Answers</h1>
      <p className="mt-1 text-sm text-ink/55">
        Customer questions await an answer before they show on the product page. Store FAQ is
        seeded and always live.
      </p>

      <h2 className="mt-6 smallcaps text-brass-deep">
        Awaiting an answer {pending.length > 0 && `(${pending.length})`}
      </h2>
      <div className="mt-3 space-y-3">
        {pending.length > 0 ? (
          pending.map(pendingCard)
        ) : (
          <p className="text-sm text-ink/50">Nothing waiting.</p>
        )}
      </div>

      <h2 className="mt-10 smallcaps text-brass-deep">Published</h2>
      <div className="mt-3 space-y-3">
        {live.length > 0 ? (
          live.map(liveCard)
        ) : (
          <p className="text-sm text-ink/50">No published Q&amp;A yet.</p>
        )}
      </div>

      {(page > 1 || hasNext) && (
        <div className="mt-4 flex items-center justify-between">
          {page > 1 ? (
            <Link href={`/admin/questions?page=${page - 1}`} className="smallcaps text-forest hover:underline">
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs text-ink/50">Page {page}</span>
          {hasNext ? (
            <Link href={`/admin/questions?page=${page + 1}`} className="smallcaps text-forest hover:underline">
              Next →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
