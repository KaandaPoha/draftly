/**
 * Brand safety checks — transparent rule-based review of draft copy.
 *
 * Detects: unsupported claims, absolute/misleading language, offensive or
 * exclusionary wording, urgency/manipulation pressure, and conflicts with
 * the user's own brand guidelines (words to avoid).
 *
 * Verdicts are advisory, never guarantees: high-risk drafts are flagged
 * for human review, and the panel states this explicitly.
 */

export type SafetyLevel = "safe" | "review" | "risk";

export type SafetyFinding = {
  severity: SafetyLevel;
  title: string;
  excerpt: string; // the matching text
  explanation: string;
};

export type SafetyReport = {
  level: SafetyLevel;
  findings: SafetyFinding[];
  checkedAt: string; // ISO
};

const CLAIM_PATTERNS: Array<{ re: RegExp; title: string; explanation: string }> = [
  {
    re: /\b(cures?|heals?|reverses?|guaranteed results?)\b/i,
    title: "Health/medical claim",
    explanation:
      "Words like “cures” or “reverses” make medical claims that usually require evidence or disclaimers. Consider softer, verifiable wording like “supports” or “designed to help”.",
  },
  {
    re: /\b(guarantee|guaranteed|100% (?:safe|effective|guaranteed))\b/i,
    title: "Absolute guarantee",
    explanation:
      "Guarantees are hard to honor and can mislead readers. If you do guarantee something, state exactly what the guarantee covers.",
  },
  {
    re: /\b(#1|number one|the best|the only)\b/i,
    title: "Unverifiable superlative",
    explanation:
      "Claims like “the best” or “the only” are puffery unless you can cite a source. Consider what you can actually support.",
  },
  {
    re: /\b(clinically proven|scientifically proven|studies show)\b/i,
    title: "Evidence claim",
    explanation:
      "Citing proof invites scrutiny. If you reference research, link the actual study in the post or soften to “research suggests”.",
  },
  {
    re: /\b(loss|lost) (?:weight|pounds|kg)\b.*\b(fast|quick|instant|overnight)\b/i,
    title: "Rapid-outcome claim",
    explanation:
      "Promising fast physical outcomes is a common misleading-claim pattern. Focus on process instead of speed of results.",
  },
];

const PRESSURE_PATTERNS: Array<{ re: RegExp; title: string; explanation: string }> = [
  {
    re: /\b(last chance|final hours|expires? (?:today|tonight|soon)|act now|don'?t miss out)\b/i,
    title: "Urgency pressure",
    explanation:
      "False or heavy urgency erodes trust and may violate platform ad policies. If the deadline is real, state the actual date and time.",
  },
  {
    re: /\b(before it'?s (?:too late|gone))\b/i,
    title: "Scarcity pressure",
    explanation:
      "Scarcity only works (and stays honest) if it's real. If stock or availability is genuinely limited, say which product and until when.",
  },
];

const OFFENSIVE_PATTERNS: Array<{ re: RegExp; title: string; explanation: string }> = [
  {
    re: /\b(stupid|idiot|dumb|pathetic|loser)\b/i,
    title: "Insulting wording",
    explanation:
      "Name-calling (even about “others”) can read as hostile and may be flagged by platform moderation or your own audience.",
  },
];

export function checkBrandSafety(
  text: string,
  guidelines?: { wordsToAvoid?: string | null }
): SafetyReport {
  const findings: SafetyFinding[] = [];
  const t = text || "";

  function add(severity: SafetyLevel, title: string, match: string, explanation: string) {
    if (findings.some((f) => f.title === title && f.excerpt === match)) return;
    findings.push({ severity, title, excerpt: match, explanation });
  }

  CLAIM_PATTERNS.forEach((p) => {
    const m = t.match(p.re);
    if (m) add("risk", p.title, m[0], p.explanation);
  });

  PRESSURE_PATTERNS.forEach((p) => {
    const m = t.match(p.re);
    if (m) add("review", p.title, m[0], p.explanation);
  });

  OFFENSIVE_PATTERNS.forEach((p) => {
    const m = t.match(p.re);
    if (m) add("risk", p.title, m[0], p.explanation);
  });


  // Words the user's own profile says to avoid.
  const avoid = (guidelines?.wordsToAvoid ?? "")
    .split(/[,;]/)
    .map((w) => w.trim())
    .filter((w) => w.length > 1);
  avoid.forEach((word) => {
    const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    const m = t.match(re);
    if (m) {
      add(
        "review",
        "Conflicts with your profile",
        m[0],
        `Your brand profile lists “${word}” as a word to avoid. Replace it with a preferred alternative to stay on-voice.`
      );
    }
  });

  // Verdict: risk > review > safe.
  const level: SafetyLevel = findings.some((f) => f.severity === "risk")
    ? "risk"
    : findings.some((f) => f.severity === "review")
    ? "review"
    : "safe";

  return { level, findings, checkedAt: new Date().toISOString() };
}
