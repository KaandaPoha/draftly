import type { ContentDraft } from "@prisma/client";

/** Assemble a draft's full text for checks and exports. */
export function draftFullText(d: ContentDraft): string {
  return [
    d.hook ?? "",
    d.body ?? "",
    d.caption ?? "",
    d.cta ?? "",
    d.visualNotes ?? "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export type ExportFormat = "markdown" | "json" | "text";

/** Build a downloadable/copyable document from a draft. */
export function draftToExport(
  d: ContentDraft,
  format: ExportFormat,
  profileName?: string | null
): string {
  const hashtags = (d.hashtags ?? "").split(",").map((h) => h.trim()).filter(Boolean);
  const meta = {
    title: d.title,
    platform: d.platform,
    format: d.format,
    goal: d.goal,
    audience: d.audience,
    profile: profileName ?? null,
    status: d.status,
    exportedAt: new Date().toISOString(),
  };

  if (format === "json") {
    return JSON.stringify(
      {
        ...meta,
        hook: d.hook,
        body: d.body,
        caption: d.caption,
        hashtags,
        cta: d.cta,
        visualDirection: d.visualNotes,
      },
      null,
      2
    );
  }

  if (format === "markdown") {
    return [
      `# ${d.title}`,
      ``,
      `> ${meta.platform} · ${meta.format ?? "post"} · ${meta.goal ?? "no goal"}`,
      profileName ? `> Brand voice: ${profileName}` : `> Generic draft (no profile)`,
      ``,
      `## Hook`,
      d.hook ?? "",
      ``,
      `## Content`,
      d.body ?? "",
      ``,
      `## Caption`,
      d.caption ?? "",
      ``,
      `## Call to action`,
      d.cta ?? "",
      ``,
      `## Hashtags`,
      hashtags.join(" "),
      ``,
      `## Visual direction`,
      d.visualNotes ?? "",
    ].join("\n");
  }

  // plain text
  return [
    d.hook,
    "",
    d.body,
    "",
    d.caption,
    "",
    hashtags.join(" "),
    "",
    d.cta,
  ]
    .filter((x) => x !== undefined && x !== "")
    .join("\n\n");
}
