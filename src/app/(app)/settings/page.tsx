import { cookies } from "next/headers";
import { PageHeader, Card } from "@/components/ui";
import { ThemeLinks } from "@/components/theme-links";

export const instant = false; // reads the theme cookie per-request

export default async function SettingsPage() {
  const theme = (await cookies()).get("draftly-theme")?.value === "light" ? "light" : "dark";

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Account and preferences."
      />
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
        <Card className="flex flex-col gap-2">
          <h2 className="font-medium">Account</h2>
          <p className="text-sm leading-relaxed text-text-muted">
            Your account is protected with a hashed password and a server-side
            session. Sign-up and login are rate-limited, and every page here is
            private to your account.
          </p>
        </Card>
        <Card className="flex flex-col gap-2">
          <h2 className="font-medium">AI provider</h2>
          <p className="text-sm leading-relaxed text-text-muted">
            No API key is configured, so all AI features run in clearly-labeled
            demo mode. Add a provider key to a <code className="font-mono text-xs">.env</code>{" "}
            file later to enable live generation — keys stay server-side.
          </p>
        </Card>
        <Card className="flex flex-col gap-2">
          <h2 className="font-medium">Connected platforms</h2>
          <p className="text-sm leading-relaxed text-text-muted">
            None connected. Direct publishing will only be enabled where official
            platform APIs permit it — Draftly never asks for your social passwords.
          </p>
        </Card>
      </div>
    </>
  );
}
