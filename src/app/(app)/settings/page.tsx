import { cookies } from "next/headers";
import { PageHeader, Card, Badge, SecondaryButton } from "@/components/ui";
import { ThemeLinks } from "@/components/theme-links";
import { providerConfig, aiConfigured, testConnection } from "@/lib/llm";
import { testProvider } from "./actions";

export const instant = false; // reads the theme cookie per-request

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const theme = (await cookies()).get("draftly-theme")?.value === "light" ? "light" : "dark";
  const cfg = providerConfig();
  const configured = aiConfigured();

  // Only actually call the provider when the user pressed the test button —
  // never on page load, so opening Settings can't burn quota.
  const tested = sp.test === "1" ? await testConnection() : null;

  return (
    <>
      <PageHeader title="Settings" subtitle="Account, appearance, and AI provider." />
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-5 py-8 md:px-10">
        <Card className="flex flex-col gap-2">
          <h2 className="font-medium">Appearance</h2>
          <p className="text-sm leading-relaxed text-text-muted">
            Choose how Draftly looks on this device. The choice is remembered in
            this browser and applied before the page renders — it works even
            with JavaScript disabled.
          </p>
          <ThemeLinks current={theme} />
        </Card>

        <Card className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-medium">AI provider</h2>
            {configured ? (
              <Badge tone="success">Configured</Badge>
            ) : (
              <Badge tone="warning">Not configured — demo mode</Badge>
            )}
          </div>

          {configured ? (
            <>
              <dl className="flex flex-col gap-1.5 text-sm">
                <Row label="Provider" value={cfg!.kind === "anthropic" ? "Anthropic" : "OpenAI-compatible"} />
                <Row label="Model" value={cfg!.model} />
                <Row label="Endpoint" value={cfg!.baseUrl} />
              </dl>
              <p className="text-sm leading-relaxed text-text-muted">
                Draftly sends your idea, brand voice, audience, platform and goal
                to this provider server-side. Your API key never reaches the
                browser.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <form action={testProvider}>
                  <SecondaryButton type="submit">Test connection</SecondaryButton>
                </form>
                {tested && (
                  <span
                    role="status"
                    className={`text-sm ${tested.ok ? "text-success" : "text-danger"}`}
                  >
                    {tested.ok ? `✓ Working — ${tested.model}` : `✗ ${tested.error}`}
                  </span>
                )}
              </div>
              <p className="text-xs text-text-faint">
                The test makes one real, tiny request to the provider. It is not
                run automatically.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm leading-relaxed text-text-muted">
                Draftly is running on its <strong>built-in generator</strong>. It
                follows your brand voice, audience and platform inputs precisely,
                and it produces storyboards, a real generated artboard image, and
                an animated preview — but it is a deterministic generator, not a
                language model.
              </p>
              <div className="rounded-lg border border-line bg-surface-2 px-4 py-3">
                <p className="text-sm font-medium">Enable real AI generation</p>
                <p className="mt-1 text-sm text-text-muted">
                  Add these to a <code className="font-mono text-xs">.env</code> file
                  in the project root and restart the server. The key stays on the
                  server.
                </p>
                <pre className="mt-3 overflow-x-auto rounded-lg bg-background px-3 py-2 text-xs text-text-muted">
{`# Any OpenAI-compatible endpoint (OpenAI, Groq, OpenRouter,
# Together, DeepSeek, local Ollama/vLLM, ...)
AI_PROVIDER=openai
AI_API_KEY=sk-...
AI_MODEL=gpt-4o-mini

# ...or Anthropic
AI_PROVIDER=anthropic
AI_API_KEY=sk-ant-...
AI_MODEL=claude-sonnet-4-20250514

# Optional: custom endpoint
AI_BASE_URL=https://api.openai.com/v1`}
                </pre>
              </div>
              <p className="text-xs text-text-faint">
                Nothing is ever labelled &ldquo;AI&rdquo; unless it genuinely came from the
                provider. If a configured provider fails or rate-limits, the draft
                falls back to the built-in generator and says so.
              </p>
            </>
          )}
        </Card>

          <Card className="flex flex-col gap-2">
          <h2 className="font-medium">Account</h2>
          <p className="text-sm leading-relaxed text-text-muted">
            Your account is protected with a hashed password and a server-side
            session. Sign-up and login are rate-limited, and every page here is
            private to your account.
          </p>
        </Card>

        <Card className="flex flex-col gap-2">
          <h2 className="font-medium">Connected platforms</h2>
          <p className="text-sm leading-relaxed text-text-muted">
            None connected. Direct publishing will only be enabled where official
            platform APIs permit it — Draftly never asks for your social passwords
            and never shows a post as published unless it actually was.
          </p>
        </Card>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
      <dt className="w-28 shrink-0 text-text-faint">{label}</dt>
      <dd className="break-all font-mono text-xs text-text-muted">{value}</dd>
    </div>
  );
}