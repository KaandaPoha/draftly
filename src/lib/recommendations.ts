/**
 * Content recommendations derived from the user's real data:
 * preferences, profiles, drafts, and calendar usage.
 * Every recommendation explains why it appears. Label: AI-generated ideas,
 * not trend data; posting times are estimates.
 */

export type Recommendation = {
  title: string;
  detail: string;
  reason: string; // why this appears for this user
  cta?: { href: string; label: string };
};

type Input = {
  goals: string; // comma string from preferences
  platforms: string; // comma string
  profiles: Array<{ name: string; niche: string | null; audience: string | null }>;
  drafts: Array<{
    title: string;
    platform: string;
    goal: string | null;
    format: string | null;
    isPersonalized: boolean;
    createdAt: Date;
  }>;
};

export function recommend(input: Input): Recommendation[] {
  const recs: Recommendation[] = [];
  const goals = input.goals.split(",").map((g) => g.trim()).filter(Boolean);
  const platforms = input.platforms.split(",").map((p) => p.trim()).filter(Boolean);
  const drafts = input.drafts;

  // 1 — formats not yet used
  const usedFormats = new Set(drafts.map((d) => d.format));
  const allFormats = ["captions", "hooks", "video_script", "carousel", "reel", "post"];
  const unused = allFormats.filter((f) => !usedFormats.has(f));
  if (drafts.length > 0 && unused.length > 0) {
    const label = unused[0] === "video_script" ? "a short video script" : `a ${unused[0]} draft`;
    recs.push({
      title: unused[0] === "video_script" ? "Try a short video script" : `Try a ${unused[0]} draft`,
      detail: `You haven't created ${label} yet. Different formats reach different audience habits — scripts especially tend to open reach.`,
      reason: "Based on your draft history: formats you haven't used yet.",
      cta: { href: "/create", label: "Open studio" },
    });
  }

  // 2 — repurpose a personalized draft across platforms
  const personalized = drafts.filter((d) => d.isPersonalized);
  if (personalized.length > 0 && platforms.length > 1) {
    const d = personalized[0];
    const other = platforms.find((p) => p !== d.platform);
    if (other) {
      recs.push({
        title: `Repurpose “${d.title.slice(0, 40)}” to ${other}`,
        detail: `This personalized draft was built for ${d.platform}. The same idea usually adapts well to ${other} with a change of format and length.`,
        reason: "Based on your profiles and the platforms you use.",
        cta: { href: "/create", label: "Adapt it" },
      });
    }
  }

  // 3 — engagement goal nudge
  if (goals.some((g) => /engagement/i.test(g))) {
    const engagementDrafts = drafts.filter((d) => /engagement/i.test(d.goal ?? ""));
    if (engagementDrafts.length < 2) {
      recs.push({
        title: "Batch a questions series",
        detail: "You listed engagement as a goal. A weekly audience-question post is the most consistent engagement driver — collect 5 questions and answer one per week.",
        reason: "You listed “increase engagement” as a goal and have few engagement-goal drafts.",
        cta: { href: "/create", label: "Start one" },
      });
    }
  }

  // 4 — launch goal nudge
  if (goals.some((g) => /launch/i.test(g))) {
    recs.push({
      title: "Plan a 5-post launch countdown",
      detail: "You have a product launch goal. A countdown sequence (tease → reveal → proof → CTA → recap) fits it — create a campaign to group these posts.",
      reason: "You listed “launch a product” as a goal.",
      cta: { href: "/campaigns", label: "New campaign" },
    });
  }

  // 5 — consistency nudge
  if (goals.some((g) => /consisten/i.test(g))) {
    recs.push({
      title: "Schedule two posts this week",
      detail: "You want to publish consistently. Put two drafts on the calendar — even mid-quality consistency beats occasional perfection.",
      reason: "You listed “publish consistently” as a goal.",
      cta: { href: "/planner", label: "Open planner" },
    });
  }

  // 6 — generic fallback: education content
  if (recs.length < 3) {
    recs.push({
      title: "Answer your audience's #1 question",
      detail: "The most reliably valuable post is a clear answer to the question your audience asks most. Carousel or caption format works well.",
      reason: "A steady default when your other signals are still building.",
      cta: { href: "/create", label: "Draft it" },
    });
  }

  return recs.slice(0, 4);
}

/** Suggested posting slots — estimates, clearly labeled as such. */
export function suggestedSlots(platforms: string[]): Array<{ when: string; platform: string; note: string }> {
  const p = platforms[0]?.trim().toLowerCase() || "instagram";
  const table: Record<string, Array<{ when: string; platform: string; note: string }>> = {
    instagram: [
      { when: "Tue 11:00", platform: "Instagram", note: "late-morning engagement window" },
      { when: "Fri 18:30", platform: "Instagram", note: "evening scroll time" },
    ],
    linkedin: [
      { when: "Wed 08:30", platform: "LinkedIn", note: "commute + coffee window" },
      { when: "Thu 17:00", platform: "LinkedIn", note: "end-of-workday read" },
    ],
    youtube: [{ when: "Sat 10:00", platform: "YouTube", note: "weekend watch time" }],
    facebook: [{ when: "Sun 19:00", platform: "Facebook", note: "family-hours browsing" }],
    x: [{ when: "Wed 12:00", platform: "X", note: "lunchtime discussion peak" }],
  };
  return table[p] ?? table.instagram;
}
