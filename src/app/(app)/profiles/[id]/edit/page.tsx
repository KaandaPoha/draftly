import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { ProfileForm } from "../../profile-form";

// Reads the session cookie and the database — render per-request.
export const instant = false;

export default async function EditProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const { error } = await searchParams;

  const profile = await prisma.brandProfile.findFirst({
    where: { id, userId: user.id, isTemporary: false },
  });
  if (!profile) notFound();

  return (
    <>
      <PageHeader
        title={`Edit “${profile.name}”`}
        subtitle="Fields are optional except the name. Adding sample posts re-runs the style analysis."
      />
      <ProfileForm
        mode="edit"
        profileId={profile.id}
        error={error ?? null}
        values={{
          name: profile.name,
          description: profile.description ?? "",
          niche: profile.niche ?? "",
          offerings: profile.offerings ?? "",
          audience: profile.audience ?? "",
          platforms: profile.platforms ?? "",
          language: profile.language ?? "",
          tone: profile.tone ?? "",
          wordsToUse: profile.wordsToUse ?? "",
          wordsToAvoid: profile.wordsToAvoid ?? "",
          guidelines: profile.guidelines ?? "",
          colors: profile.colors ?? "",
        }}
      />
    </>
  );
}
