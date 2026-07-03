import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Seeds the store-authored "common questions" (isFaq=true, published) that show
// on each product page from day one — before any customer has asked. Content is
// written to match the compliance-safe claims already on the PDPs (see
// catalog.ts): no germ-kill / disinfectant claims, and the toilet cleaner's
// safety answers mirror its on-page caution note verbatim in spirit.
//
// Idempotent: it deletes existing FAQ rows for each product and recreates them,
// so re-running just refreshes the copy. Customer-asked questions (isFaq=false)
// are never touched.
const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

type Faq = { question: string; answer: string };

const FAQ: Record<string, Faq[]> = {
  "dishwash-gel-lime": [
    {
      question: "Is this gentle enough to use on my hands every day?",
      answer:
        "Yes. It's built to cut grease while staying kind to the hands you use all day, without the harsh, drying chemicals many dishwashes rely on. If your skin is very sensitive, a quick rinse after a long wash-up is all you'll need.",
    },
    {
      question: "How much do I need per wash — does one bottle last?",
      answer:
        "A little goes a long way. Squeeze a small amount onto a wet sponge, or straight into a sink of warm water, and you're set. An 820ml bottle lasts a typical kitchen a good while.",
    },
    {
      question: "Will it leave a film on my glasses and dishes?",
      answer:
        "No — it's designed to rinse away clean with no filmy residue, so glassware comes up clear and dishes squeaky.",
    },
    {
      question: "Is the lime scent strong or artificial?",
      answer:
        "It's a fresh, light lime scent that lifts away with the suds. It's there to make washing-up pleasant, not to linger on your dishes.",
    },
    {
      question: "What makes it “plant-powered”?",
      answer:
        "The cleaning comes from a plant-powered formula — gentler, plant-derived ingredients rather than the harshest petrochemical detergents — which is also why it's kinder to your skin.",
    },
    {
      question: "Can I use it for anything other than dishes?",
      answer:
        "It's made for dishes, glassware and cookware, so we'd keep it to the sink rather than surfaces or food, and always rinse well.",
    },
  ],

  "floor-cleaner": [
    {
      question: "How much should I add to a bucket of water?",
      answer:
        "Add 1–2 capfuls to a bucket of water and mop as usual. There's no need to rinse — just let the floor air-dry to a clean, streak-free finish.",
    },
    {
      question: "Is it safe for homes with kids and pets?",
      answer:
        "Yes — it's made to be family- and pet-friendly, with no harsh, lingering fumes hanging in the air after you mop. As always, let the floor dry before little ones and pets pad across it.",
    },
    {
      question: "Which floors can I use it on?",
      answer:
        "It's made for sealed floors — tiles, sealed stone, vinyl and the like. For delicate, waxed or unsealed wood, test a small hidden patch first.",
    },
    {
      question: "Does it leave streaks or a dull residue?",
      answer:
        "No — it's formulated for a streak-free, residue-free shine, so you get a clean finish rather than a cloudy film.",
    },
    {
      question: "What's the difference between Jasmine, Lavender and Lemongrass?",
      answer:
        "Only the scent — all three clean identically. Lavender is the softest and most calming, Lemongrass the brightest and zesty, Jasmine gently floral. Pick whichever you'd most like your home to smell of.",
    },
    {
      question: "Which size should I buy — 500ml, 1L or 2L?",
      answer:
        "Since you only dilute 1–2 capfuls per bucket, every size goes a long way. The 500ml is a great way to try a fragrance, the 1L suits most homes, and the 2L is the best value for larger homes or frequent mopping.",
    },
  ],

  "toilet-cleaner": [
    {
      question: "How long should I leave it before scrubbing?",
      answer:
        "Squeeze it around and under the rim, leave it 5–10 minutes to work on stains and limescale, then scrub with a toilet brush and flush.",
    },
    {
      question: "Does it deal with hard-water limescale and tough stains?",
      answer:
        "Yes — this is the powerful end of the Klenich range, made to cling to the bowl and lift tough stains and limescale build-up. For heavy build-up, a second application with a slightly longer dwell time helps.",
    },
    {
      question: "Is there anything I should be careful about when using it?",
      answer:
        "It contains acidic cleaning agents, so it's for toilet use only. Keep it out of reach of children, avoid contact with skin and eyes (rinse thoroughly with water if that happens), and never mix it with other cleaning products.",
    },
    {
      question: "Can I mix it with bleach or another cleaner for extra power?",
      answer:
        "Please don't — never mix it with bleach or other cleaning products, as that can create hazardous fumes. It's designed to work well on its own.",
    },
    {
      question: "Is it fine for regular use in my plumbing?",
      answer:
        "Used as directed — a normal dose, left a few minutes, then flushed — it's fine for everyday use. We wouldn't recommend leaving it in the bowl for hours or using far more than needed.",
    },
    {
      question: "Why doesn't it come in a fragrance like the floor cleaner?",
      answer:
        "This one is formulated to clean hard and leave the bowl fresh rather than perfumed — it's the tough-job product in the range.",
    },
  ],
};

async function main() {
  for (const [slug, faqs] of Object.entries(FAQ)) {
    const product = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
    if (!product) {
      console.log(`✗ ${slug} — NOT FOUND in DB, skipped`);
      continue;
    }

    // Refresh: drop existing store FAQ for this product, leave customer Q&A alone.
    await prisma.productQuestion.deleteMany({ where: { productId: product.id, isFaq: true } });

    await prisma.productQuestion.createMany({
      data: faqs.map((f, i) => ({
        productId: product.id,
        question: f.question,
        answer: f.answer,
        answeredAt: new Date(),
        published: true,
        isFaq: true,
        sortOrder: i,
      })),
    });
    console.log(`✓ ${slug} — ${faqs.length} FAQ seeded`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
