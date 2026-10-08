"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, hashPassword } from "@/lib/auth";

export type SignupState = { error: string | null };

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

export async function signupAction(
  _prev: SignupState,
  formData: FormData
): Promise<SignupState> {
  const parsed = schema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with this email already exists" };
  }

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email,
      passwordHash: await hashPassword(parsed.data.password),
    },
  });

  await createSession(user.id);
  redirect("/onboarding");
}
