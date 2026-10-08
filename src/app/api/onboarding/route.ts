import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  role: z.string().min(1, "Choose who you are"),
  goals: z.array(z.string()).min(1, "Choose at least one goal"),
  platforms: z.array(z.string()).min(1, "Choose at least one platform"),
  language: z.string().min(1),
  tone: z.string().min(1),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const data = {
    role: parsed.data.role,
    goals: parsed.data.goals.join(","),
    platforms: parsed.data.platforms.join(","),
    language: parsed.data.language,
    tone: parsed.data.tone,
  };

  await prisma.userPreferences.upsert({
    where: { userId: user.id },
    update: data,
    create: { userId: user.id, ...data },
  });

  return NextResponse.json({ ok: true });
}
