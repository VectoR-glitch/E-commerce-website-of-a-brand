import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Seeds a couple of real, published launch posts so the Journal isn't empty
// on day one. Content matches the compliance-safe claims already on the PDPs
// (see catalog.ts) — no germ-kill/disinfectant claims. Idempotent: upserts by
// slug, so re-running just refreshes the copy.
const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

type Post = { slug: string; title: string; excerpt: string; body: string };

const POSTS: Post[] = [
  {
    slug: "why-plant-powered-cleaning",
    title: "Why We Chose Plant-Powered Over Harsh Chemicals",
    excerpt:
      "The warning labels on an ordinary bottle of cleaner made us stop and ask why “strong” and “safe” can't be the same thing.",
    body: `Most cleaning products are sold on strength — the sharper the fumes, the more we're told to trust they're working. Somewhere along the way, we quietly agreed that a clean home and a safe one were two different things, and that getting one meant making peace with the other.

We didn't accept that trade. “Plant-powered” isn't a marketing word for us — it's a formulation choice. Wherever we can, we build our cleaners around naturally-derived surfactants and fragrances instead of the harshest petrochemical ingredients most cleaners default to. That's what lets our Dishwash Gel cut through grease without stripping the hands that use it every day, and lets our Floor Cleaner leave a streak-free shine without the harsh, lingering fumes that hang in the air long after you've finished mopping.

Gentle doesn't mean weak, though. Some jobs are genuinely tough, and we don't pretend otherwise — our Toilet Cleaner is formulated to cling to the bowl and lift real stains and limescale, because a home also deserves a cleaner that's honest about what it takes to do that job properly. The difference is that toughness is placed exactly where it's needed, instead of dosed into every bottle by default.

A small habit we'd recommend to anyone, with any brand: read the back of the bottle before the front. The front sells a feeling; the back tells you what you're actually bringing into your home. If a label reads like a hazard warning, that's worth noticing.

That's the standard we hold ourselves to — a home that's cared for and clean, without having to choose between the two.`,
  },
  {
    slug: "streak-free-floor-cleaning-tips",
    title: "The Gentle Way to a Streak-Free Floor",
    excerpt:
      "A few small habits separate a floor that looks clean from one that actually is — no harsh fumes required.",
    body: `A streaky floor usually isn't a strength problem — it's a technique one. Here's what actually makes the difference, using our own Floor Cleaner as the example, though most of this holds for any plant-powered floor cleaner.

Get the dilution right. More product doesn't mean more clean — it usually means more residue left behind to dry into streaks. 1–2 capfuls in a full bucket of water is the sweet spot for our formula; resist the urge to add “a bit extra for good measure.”

Wring the mop properly. A mop that's too wet just pushes dirty water around instead of lifting it. Wring until the mop is damp, not dripping, and change the bucket water once it starts looking cloudy rather than pushing through to the end with dirty water.

Let it air-dry. Our Floor Cleaner is designed so there's no need to rinse after mopping — the residue-free formula is part of what makes the finish streak-free. Going back over it with a second rinse pass usually reintroduces streaks rather than removing them.

Pick your fragrance for the room. Jasmine and Lavender both read as soft, calming scents — Lavender leans a touch more relaxing, Jasmine slightly more floral. Lemongrass is the brightest and zestiest of the three, and tends to suit kitchens and high-traffic areas well. All three clean identically, so this one's purely about what you'd like your home to smell like.

Mop with the light, not against it. It sounds like a small thing, but mopping toward a window or doorway makes it much easier to actually see the streaks you're trying to avoid, rather than discovering them after the floor's dry.

None of this requires harsh fumes or elbow grease beyond the ordinary — just a little attention to how the clean actually happens, not just what's in the bottle.`,
  },
];

async function main() {
  for (const p of POSTS) {
    await prisma.blogPost.upsert({
      where: { slug: p.slug },
      update: { title: p.title, excerpt: p.excerpt, body: p.body },
      create: {
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt,
        body: p.body,
        published: true,
        publishedAt: new Date(),
      },
    });
    console.log(`✓ ${p.slug}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
