import { Card, Badge } from "@/components/ui";
import { Gauge } from "lucide-react";
import { applyTransform } from "./actions";
import type { QualityReport } from "@/lib/quality";

const TONE: Record<number, string> = {
  0: "border-danger/40 bg-danger/10 text-danger",
  1: "border-warning/40 bg-warning/10 text-warning",
  2: "border-line bg-surface-2 text-text-muted",
  3: "border-success/40 bg-success/10 text-success",
};

const WORD: Record<number, string> = {
  0: "Needs work",
  1: "Weak",
  2: "Fair",
  3: "Strong",
};

/**
 * Transparent draft evaluation. Heuristic and labelled as such — these are not
 * measurements of engagement, and the copy says so.
 */
export function QualityPanel({
  report,
  draftId,
}: {
  report: QualityReport;
  draftId: string;
}) {
  const improvements = report.dimensions.filter((d) => d.action);

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display font-semibold">
          <Gauge size={17} className="text-accent" aria-hidden />
          Draft evaluation
        </h2>
        <Badge tone="warning">Heuristic, not a prediction</Badge>
      </div>

      <p className="text-sm leading-relaxed text-text-muted">
        Scored from the structure of this draft — length, framing, and how it
        matches {report.lengthUse}. These are editorial checks, not forecasts of
        reach or engagement.
      </p>

      <ul className="flex flex-col divide-y divide-line">
        {report.dimensions.map((d) => (
          <li key={d.key} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">{d.label}</span>
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONE[d.score]}`}
              >
                {WORD[d.score]}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-text-muted">{d.why}</p>
            {d.fix && (
              <p className="text-sm leading-relaxed text-text-faint">
                <span className="font-medium text-text-muted">Try:</span> {d.fix}
              </p>
            )}
          </li>
        ))}
      </ul>

      {improvements.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-line pt-4">
          <p className="text-xs font-medium uppercase tracking-wider text-text-faint">
            Apply a suggested fix
          </p>
          <div className="flex flex-wrap gap-2">
            {improvements.map((d) => (
              <form key={d.key} action={applyTransform}>
                <input type="hidden" name="id" value={draftId} />
                <input type="hidden" name="kind" value={d.action} />
                <button
                  type="submit"
                  className="inline-flex h-9 items-center rounded-lg border border-line px-3 text-sm font-medium text-text-muted hover:bg-surface-2 hover:text-text"
                >
                  {d.action === "shorter"
                    ? "Make it shorter"
                    : d.action === "better_cta"
                      ? "Improve the CTA"
                      : d.action === "new_hook"
                        ? "New hook"
                        : "More professional"}
                </button>
              </form>
            ))}
          </div>
          <p className="text-xs text-text-faint">
            Each fix saves a new version — the current text is never overwritten.
          </p>
        </div>
      )}
    </Card>
  );
}