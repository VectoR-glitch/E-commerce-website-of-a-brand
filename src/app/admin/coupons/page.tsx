import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { formatINR } from "@/lib/catalog";
import { createCoupon, toggleCoupon, deleteCoupon } from "@/app/admin/actions";
import { isSystemCouponCode } from "@/lib/coupons";
import { ConfirmSubmit } from "@/components/confirm-submit";

export const dynamic = "force-dynamic";

const fieldCls = "border border-line bg-white px-3 py-2 text-sm outline-none focus:border-forest";

export default async function AdminCouponsPage() {
  await requireAdmin();

  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
  // Computed once per request (this is a dynamic RSC, rendered server-side).
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  return (
    <div>
      <h1 className="font-serif text-3xl">Coupons</h1>

      <div className="mt-6 overflow-x-auto border border-line">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="bg-paper text-left text-ink/60">
              <th className="px-3 py-2 font-medium">Code</th>
              <th className="px-3 py-2 font-medium">Discount</th>
              <th className="px-3 py-2 font-medium">Min order</th>
              <th className="px-3 py-2 font-medium">Used</th>
              <th className="px-3 py-2 font-medium">Expires</th>
              <th className="px-3 py-2 text-center font-medium">Status</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {coupons.map((c) => {
              const expired = c.expiresAt != null && c.expiresAt.getTime() < now;
              const maxedOut = c.maxUses != null && c.usedCount >= c.maxUses;
              const managed = isSystemCouponCode(c.code);
              return (
                <tr key={c.id} className="border-t border-line">
                  <td className="px-3 py-2 font-mono text-ink">
                    {c.code}
                    {managed && (
                      <span className="ml-2 smallcaps text-[10px] text-ink/45">
                        {c.code.startsWith("KIT-") ? "· Managed by Kits" : "· Managed by Subscriptions"}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-ink/80">
                    {c.type === "PERCENT" ? `${c.value}%` : formatINR(c.value)}
                  </td>
                  <td className="px-3 py-2 text-ink/70">
                    {c.minOrderPaise > 0 ? formatINR(c.minOrderPaise) : "—"}
                  </td>
                  <td className="px-3 py-2 text-ink/70">
                    {c.usedCount}
                    {c.maxUses != null ? ` / ${c.maxUses}` : ""}
                  </td>
                  <td className="px-3 py-2 text-ink/70">
                    {c.expiresAt
                      ? c.expiresAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {!c.active ? (
                      <span className="text-ink/45">Off</span>
                    ) : expired ? (
                      <span className="text-[#b3402f]">Expired</span>
                    ) : maxedOut ? (
                      <span className="text-[#b3402f]">Used up</span>
                    ) : (
                      <span className="text-forest">Active</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-3">
                      <form action={toggleCoupon}>
                        <input type="hidden" name="couponId" value={c.id} />
                        <button className="text-xs text-forest hover:underline">
                          {c.active ? "Disable" : "Enable"}
                        </button>
                      </form>
                      {managed ? (
                        <span className="text-xs text-ink/35" title="Delete this from the Kits or Subscriptions page instead — it's kept in sync automatically.">
                          Delete
                        </span>
                      ) : (
                        <form action={deleteCoupon}>
                          <input type="hidden" name="couponId" value={c.id} />
                          <ConfirmSubmit
                            message={`Delete coupon ${c.code}? Existing orders that used it are unaffected.`}
                            className="text-xs text-red-600 hover:underline"
                          >
                            Delete
                          </ConfirmSubmit>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {coupons.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-ink/50">
                  No coupons yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* New coupon */}
      <div className="mt-8 max-w-3xl border border-line bg-paper p-5">
        <h2 className="smallcaps text-brass-deep">New coupon</h2>
        <form action={createCoupon} className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="smallcaps mb-1 block text-brass-deep">Code</label>
            <input name="code" required placeholder="WELCOME10" className={`${fieldCls} w-full uppercase`} />
          </div>
          <div>
            <label className="smallcaps mb-1 block text-brass-deep">Type</label>
            <select name="type" className={`${fieldCls} w-full`} defaultValue="PERCENT">
              <option value="PERCENT">Percent off (%)</option>
              <option value="FIXED">Fixed amount off (₹)</option>
            </select>
          </div>
          <div>
            <label className="smallcaps mb-1 block text-brass-deep">Value <span className="text-ink/45">(% or ₹)</span></label>
            <input name="value" type="number" step="0.01" min={0} required className={`${fieldCls} w-full`} />
          </div>
          <div>
            <label className="smallcaps mb-1 block text-brass-deep">Min order ₹ <span className="text-ink/45">(optional)</span></label>
            <input name="minOrderRupees" type="number" step="0.01" min={0} placeholder="0" className={`${fieldCls} w-full`} />
          </div>
          <div>
            <label className="smallcaps mb-1 block text-brass-deep">Max uses <span className="text-ink/45">(blank = ∞)</span></label>
            <input name="maxUses" type="number" min={1} placeholder="Unlimited" className={`${fieldCls} w-full`} />
          </div>
          <div>
            <label className="smallcaps mb-1 block text-brass-deep">Expires <span className="text-ink/45">(optional)</span></label>
            <input name="expiresAt" type="date" className={`${fieldCls} w-full`} />
          </div>
          <div className="sm:col-span-2">
            <button className="smallcaps bg-forest px-5 py-2 text-bone btn-fill-forest">Create coupon</button>
            <p className="mt-2 text-xs text-ink/55">
              Value is a percentage for “Percent off”, or a rupee amount for “Fixed amount off”. Discounts apply to the goods subtotal, never to delivery.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
