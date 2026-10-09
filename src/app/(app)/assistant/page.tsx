import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageSquare, Info, Plus, Trash2, ArrowUpRight, Sparkles } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, Badge } from "@/components/ui";
import { aiConfigured } from "@/lib/llm";
import { sendMessage, deleteConversation, createIdea } from "./actions";

// Reads the session cookie and the database — render per-request.
export const instant = false;

const STARTERS = [
  "What should my brand post this week?",
  "What content could appeal to my audience?",
  "How can I make this draft more engaging?",
  "Suggest campaign ideas for our upcoming launch.",
  "How is my brand voice profile set up?",
];

export default async function AssistantPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Reads cookies + DB per request.
  const instant = false;
  void instant;

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const conversationId = sp.c ? String(sp.c) : null;
  const ai = aiConfigured();

  const conversations = await prisma.chatConversation.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { _count: { select: { messages: true } } },
  });

  const active = conversationId
    ? await prisma.chatConversation.findFirst({
        where: { id: conversationId, userId: user.id },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      })
    : null;

  const lastReply = active?.messages.filter((m) => m.role === "assistant").at(-1);

  return (
    <>
      <PageHeader
        title="AI Assistant"
        subtitle="Strategy help that knows your profiles, goals, and recent drafts."
      />

      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-5 py-8 md:px-10">
        {ai ? (
            <Card className="flex gap-3 border-accent/30 bg-accent-soft">
              <Sparkles size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />
              <p className="text-sm leading-relaxed text-text-muted">
                <strong className="text-text">Live AI assistant.</strong> Replies come
                from your configured AI provider, generated server-side using your real
                profiles, goals and recent drafts. Your API key never reaches the
                browser.
              </p>
            </Card>
          ) : (
            <Card className="flex gap-3 border-warning/30 bg-warning/5">
          <Info size={18} className="mt-0.5 shrink-0 text-warning" aria-hidden />
          <p className="text-sm leading-relaxed text-text-muted">
            <strong className="text-text">Demo assistant.</strong> No AI key is
            configured, so replies come from scenario templates filled with your
            real profile context. Connect a provider key to unlock free-form AI
            chat — the interface stays the same.
          </p>
        </Card>
          )}

        {/* Composer + suggestions */}
        <Card className="flex flex-col gap-4">
          <form action={sendMessage} className="flex flex-col gap-3">
            <input type="hidden" name="conversationId" value={conversationId ?? ""} />
            <label htmlFor="message" className="text-sm font-medium">
              {active ? "Reply in this conversation" : "Ask the assistant"}
            </label>
            <textarea
              id="message"
              name="message"
              rows={2}
              required
              maxLength={4000}
              placeholder="e.g. What should my brand post this week?"
              className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <p className="text-xs text-text-faint">
              One question is enough — the assistant reads your profiles, goals
              and recent drafts for context. Tap a suggestion below to send it
              without typing.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-background hover:bg-accent-strong"
              >
                <MessageSquare size={15} aria-hidden /> Send
              </button>
              {active && (
                <Link
                  href="/assistant"
                  className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-line px-3 text-sm text-text-muted hover:text-text"
                >
                  <Plus size={14} aria-hidden /> New conversation
                </Link>
              )}
            </div>
          </form>

          {!active && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-text-faint">
                Or tap a question to send it instantly
              </span>
              <div className="flex flex-wrap gap-2">
                {STARTERS.map((s) => (
                  <form key={s} action={sendMessage}>
                    <input type="hidden" name="conversationId" value="" />
                    <input type="hidden" name="message" value={s} />
                    <button
                      type="submit"
                      className="rounded-full border border-line bg-surface-2 px-3 py-1.5 text-xs text-text-muted transition-colors hover:border-accent hover:text-text"
                    >
                      {s}
                    </button>
                  </form>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Conversation history list */}
        {conversations.length > 0 && (
          <Card className="flex flex-col gap-3">
            <h2 className="font-display font-semibold">Conversations</h2>
            <ul className="flex flex-col gap-2">
              {conversations.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2">
                  <Link href={`/assistant?c=${c.id}`} className="min-w-0 flex-1">
                    <p className={`truncate text-sm ${c.id === conversationId ? "font-medium text-accent" : "text-text"}`}>
                      {c.title ?? "Conversation"}
                    </p>
                    <p className="text-xs text-text-faint">
                      {c._count.messages} messages
                    </p>
                  </Link>
                  <form action={deleteConversation}>
                    <input type="hidden" name="conversationId" value={c.id} />
                    <button
                      type="submit"
                      aria-label={`Delete conversation: ${c.title ?? "untitled"}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:bg-danger/10 hover:text-danger"
                    >
                      <Trash2 size={14} aria-hidden />
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {/* Active conversation transcript */}
        {active && (
          <Card className="flex flex-col gap-4">
            <h2 className="font-display font-semibold">{active.title ?? "Conversation"}</h2>
            <div className="flex flex-col gap-4">
              {active.messages.map((m) => (
                <div
                  key={m.id}
                  className={`rounded-lg px-4 py-3 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "ml-8 bg-accent-soft text-text"
                      : "mr-8 border border-line bg-surface-2"
                  }`}
                >
                  <span className="mb-1 block text-xs font-medium text-text-faint">
                    {m.role === "user"
                        ? "You"
                        : m.source === "ai"
                          ? "Assistant (AI)"
                          : m.source === "demo"
                            ? "Assistant (built-in)"
                            : "Assistant"}
                  </span>
                  <p className="whitespace-pre-line">{m.content}</p>
                    {m.role !== "user" && m.notice && (
                      <p className="mt-2 border-t border-line pt-2 text-xs text-warning">
                        {m.notice}
                      </p>
                    )}
                </div>
              ))}
            </div>

            {/* Contextual action: turn the last assistant reply into an idea */}
            {lastReply && (
              <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
                <form action={createIdea} className="flex items-center gap-2">
                  <input type="hidden" name="idea" value={active.title ?? "Content idea from assistant"} />
                  <button
                    type="submit"
                    className="inline-flex h-10 items-center gap-2 rounded-lg border border-accent px-4 text-sm font-medium text-accent hover:bg-accent-soft"
                  >
                    <ArrowUpRight size={15} aria-hidden /> Create this idea
                  </button>
                </form>
                <Link href="/drafts" className="text-sm text-text-muted hover:text-text">
                  Or improve an existing draft in your library →
                </Link>
              </div>
            )}
          </Card>
        )}

        <div className="flex flex-wrap gap-2">
          <Badge tone="accent">Uses your real profiles</Badge>
          <Badge>Posting times are estimates</Badge>
          <Badge tone="warning">Ideas are AI-generated, not trend data</Badge>
          {ai && <Badge tone="success">Live provider connected</Badge>}
        </div>
      </div>
    </>
  );
}
