/**
 * Demo data for Phase 1.
 * Clearly-labeled sample data — no real analytics or AI output yet.
 * Will be replaced by real per-user data in later phases.
 */

export const demoData = {
  user: { firstName: "there" }, // unused now — dashboard reads the signed-in name

  stats: {
    drafts: 12,
    profiles: 3,
    campaigns: 2,
    scheduled: 4,
  },

  recentDrafts: [
    {
      id: "d1",
      title: "Launch teaser — chocolate protein drink",
      excerpt:
        "Hook: \"Your gym bag called. It wants something better than water.\" Short-form script for Reels with a 3-shot visual plan.",
      platform: "Instagram",
      profile: "FitBite Foods",
      status: "ready",
      date: "Oct 7",
    },
    {
      id: "d2",
      title: "LinkedIn thought-leadership post",
      excerpt:
        "A story-first post about our transition to carbon-neutral packaging, ending with a question CTA to drive comments.",
      platform: "LinkedIn",
      profile: "FitBite Foods",
      status: "draft",
      date: "Oct 6",
    },
    {
      id: "d3",
      title: "Carousel outline — 5 meal-prep myths",
      excerpt:
        "Slide-by-slide outline with a contrarian hook on slide 1 and a save-worthy checklist on the final slide.",
      platform: "Instagram",
      profile: "Coach Aarav",
      status: "ready",
      date: "Oct 5",
    },
    {
      id: "d4",
      title: "YouTubeShorts hook variants",
      excerpt:
        "Three alternative 3-second hooks for the recipe shortcut video, each tested against our hook-clarity checklist.",
      platform: "YouTube",
      profile: "Coach Aarav",
      status: "draft",
      date: "Oct 4",
    },
  ],

  recommendations: [
    {
      title: "Try a myth-busting carousel",
      detail:
        "Your education-focused audience responds well to corrective content — outline a 6-slide myth vs. reality format.",
    },
    {
      title: "Repurpose your launch teaser",
      detail:
        "The FitBite Reel script can be adapted into a LinkedIn post with a founder-story angle.",
    },
    {
      title: "Batch a questions series",
      detail:
        "Collect 5 audience questions and answer one per week to fill your schedule consistently.",
    },
  ],

  upcoming: [
    { when: "Tue 09:30", what: "Launch teaser Reel" },
    { when: "Wed 18:00", what: "Myth-busting carousel" },
    { when: "Fri 08:30", what: "LinkedIn founder post" },
  ],
} as const;
