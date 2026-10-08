/**
 * Client-safe helpers for the draft page's copy/export buttons and the
 * regenerate-with-instruction form.
 *
 * Pure string building — no server imports — so it can be used from both the
 * server page and a small client component.
 */

/** Build the clipboard text for one part of a draft (or the whole thing). */
export function draftCopyText(part: {
  title?: string | null;
  hook?: string | null;
  body?: string | null;
  caption?: string | null;
  hashtags?: string | null;
  cta?: string | null;
}): string {
  const lines: string[] = [];
  if (part.title?.trim()) lines.push(part.title.trim());
  if (part.hook?.trim()) lines.push(part.hook.trim());
  if (part.body?.trim()) lines.push(part.body.trim());
  if (part.caption?.trim()) lines.push(part.caption.trim());
  if (part.hashtags?.trim()) lines.push(part.hashtags.trim());
  if (part.cta?.trim()) lines.push(part.cta.trim());
  return lines.join("\n\n");
}

/**
 * Turn a free-text revision instruction into an appended idea for
 * regeneration. Returns the original idea unchanged when the instruction is
 * empty or too short to act on.
 */
export function withRevision(
  idea: string | null | undefined,
  instruction: string | null | undefined
): string {
  const note = (instruction ?? "").trim();
  if (note.length < 3) return idea ?? "";
  const base = (idea ?? "").trim();
  return base ? `${base}\n\nRevision request: ${note}` : `Revision request: ${note}`;
}
