import { ShieldCheck, ShieldAlert, Shield } from "lucide-react";
import { Card, Badge } from "@/components/ui";
import type { SafetyReport } from "@/lib/brand-safety";

const LEVEL_META: Record<string, { label: string; tone: "success" | "warning" | "danger"; icon: typeof Shield }> = {
  safe: { label: "Safe — nothing flagged", tone: "success", icon: ShieldCheck },
  review: { label: "Needs review", tone: "warning", icon: Shield },
  risk: { label: "Potential risk — human review required", tone: "danger", icon: ShieldAlert },
};

/**
 * Server-rendered brand safety panel (no client JS).
 * `expanded` lets the page default it open when there are findings.
 */
export function SafetyPanel({
  report,
  expanded = false,
}: {
  report: SafetyReport;
  expanded?: boolean;
}) {
  const meta = LEVEL_META[report.level];
  const Icon = meta.icon;
  const open = expanded || report.level !== "safe";

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Icon
          size={17}
          className={
            report.level === "safe"
              ? "text-success"
              : report.level === "review"
              ? "text-warning"
              : "text-danger"
          }
          aria-hidden
        />
        <h2 className="font-display font-semibold">Brand safety</h2>
        <Badge tone={meta.tone}>{meta.label}</Badge>
      </div>

      {open && report.findings.length === 0 && (
        <p className="text-sm text-text-muted">
          No claims, pressure tactics, offensive wording, or profile conflicts
          detected in this draft.
        </p>
      )}

      {open && report.findings.length > 0 && (
        <ul className="flex flex-col gap-3">
          {report.findings.map((f, i) => (
            <li
              key={i}
              className="rounded-lg border border-line bg-surface-2 px-3 py-2.5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={f.severity === "risk" ? "danger" : "warning"}>
                  {f.title}
                </Badge>
                <code className="truncate font-mono text-xs text-text-muted">
                  “{f.excerpt}”
                </code>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-text-muted">
                {f.explanation}
              </p>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-text-faint">
        Automated checks are advisory, not a guarantee that every issue is
        caught. Anything marked “risk” should get a human read before posting.
      </p>
    </Card>
  );
}
