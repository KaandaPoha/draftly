import { PageHeader, Card } from "@/components/ui";
import { MessageSquare, Info } from "lucide-react";

const EXAMPLES = [
  "What should my brand post this week?",
  "How can I make this draft more engaging?",
  "Convert this Instagram idea into a LinkedIn post.",
  "Suggest campaign ideas for our upcoming launch.",
];

export default function AssistantPage() {
  return (
    <>
      <PageHeader
        title="AI Assistant"
        subtitle="A strategy and content partner that knows your brand profiles."
      />
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-5 py-8 md:px-10">
        <Card className="flex gap-3 border-accent/30 bg-accent-soft">
          <Info size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />
          <p className="text-sm leading-relaxed">
            The live assistant arrives in Phase 6. Until then, here are the kinds
            of questions it will answer using your saved profile context.
          </p>
        </Card>
        <div className="flex flex-col gap-3">
          {EXAMPLES.map((q) => (
            <Card key={q} className="flex items-center gap-3">
              <MessageSquare size={16} className="shrink-0 text-text-faint" aria-hidden />
              <span className="text-sm text-text-muted">{q}</span>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
