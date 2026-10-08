import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ProfileForm } from "../profile-form";

// Reads the session cookie — render per-request.
export const instant = false;

export default async function NewProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; field?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { error } = await searchParams;

  return (
    <>
      <PageHeader
        title="New brand profile"
        subtitle="Fields are optional except the name. Sample posts power the style analysis."
      />
      <ProfileForm mode="create" values={{
        name: "",
        description: "",
        niche: "",
        offerings: "",
        audience: "",
        platforms: "",
        language: "English",
        tone: "",
        wordsToUse: "",
        wordsToAvoid: "",
        guidelines: "",
        colors: "",
      }} error={error ?? null} />
    </>
  );
}
