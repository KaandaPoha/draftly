"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assistantReply, buildChatPrompt, type AssistantContext } from "@/lib/assistant";

/** Send a message: stores it, generates a reply, returns to the conversation. */
export async function sendMessage(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const conversationId = String(formData.get("conversationId") ?? "");
  const message = String(formData.get("message") ?? "").trim().slice(0, 4000);

  if (!message) redirect(`/assistant?c=${conversationId}`);

  // Build real context from the user's data.
  const [preferences, profiles, recentDrafts] = await Promise.all([
    prisma.userPreferences.findUnique({ where: { userId: user.id } }),
    prisma.brandProfile.findMany({
      where: { userId: user.id, isTemporary: false },
      select: { name: true, niche: true, tone: true, audience: true, wordsToUse: true },
      take: 3,
    }),
    prisma.contentDraft.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { title: true, platform: true, goal: true },
    }),
  ]);

  const ctx: AssistantContext = {
    userName: user.name,
    preferences,
    profiles,
    recentDrafts,
  };

  // Demo engine (or future LLM call using the same context block).
  void buildChatPrompt(message, ctx); // built now; used when the LLM transport lands
  const reply = assistantReply(message, ctx);

  // Persist conversation.
  let convId = conversationId;
  if (!convId) {
    const conv = await prisma.chatConversation.create({
      data: {
        userId: user.id,
        title: message.slice(0, 60),
        messages: {
          create: [
            { role: "user", content: message },
            { role: "assistant", content: reply.text },
          ],
        },
      },
    });
    convId = conv.id;
  } else {
    const owned = await prisma.chatConversation.findFirst({
      where: { id: convId, userId: user.id },
    });
    if (!owned) redirect("/assistant");

    await prisma.chatMessage.createMany({
      data: [
        { conversationId: convId, role: "user", content: message },
        { conversationId: convId, role: "assistant", content: reply.text },
      ],
    });
  }

  revalidatePath("/assistant");
  redirect(`/assistant?c=${convId}`);
}

/** Start a new conversation. */
export async function newConversation() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect("/assistant");
}

/** Delete a conversation. */
export async function deleteConversation(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const id = String(formData.get("conversationId") ?? "");
  await prisma.chatConversation.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/assistant");
  redirect("/assistant");
}

/**
 * Contextual action: "Create this idea" — sends the idea to the studio
 * by redirecting with the idea pre-filled (state travels in the URL, no JS).
 */
export async function createIdea(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const idea = String(formData.get("idea") ?? "");
  const q = new URLSearchParams({ step: "0", idea });

  redirect(`/create?${q.toString()}`);
}
