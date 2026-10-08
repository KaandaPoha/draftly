import { PageHeader, Card } from "@/components/ui";

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Account and preferences. Authentication arrives in Phase 2."
      />
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-5 py-8 md:px-10">
        <Card className="flex flex-col gap-2">
          <h2 className="font-medium">Account</h2>
          <p className="text-sm leading-relaxed text-text-muted">
            You are browsing Draftly in demo mode. Sign-up, login, and personal
            data isolation are built in Phase 2 with Auth.js.
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
