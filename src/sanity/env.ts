// Sanity environment config.
// TODO: create the Klenich Sanity project (under the Bharat Bliss org) and set
// these in .env.local. The placeholder keeps builds working until then.

export const apiVersion =
  process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2026-02-01";

export const dataset =
  process.env.NEXT_PUBLIC_SANITY_DATASET || "production";

export const projectId =
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "placeholder";