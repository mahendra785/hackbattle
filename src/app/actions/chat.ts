// src/app/actions/chat.ts
"use server";

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";

/**
 * Resolve a DB user id from NextAuth session, preferring email.
 * If there's no email, we fall back to `name`: find or create a user with that name.
 * (Still stores the *id* into Chat.userId, to match your schema.)
 */
async function resolveUserIdFromSession(): Promise<string> {
  const session = await getServerSession(); // If your app needs options, pass them here.
  const email = session?.user?.email?.trim() || null;
  const name  = session?.user?.name?.trim() || null;

  // 1) Prefer email (unique, stable)
  if (email) {
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        // keep name fresh if provided
        ...(name ? { name } : {}),
      },
      create: {
        email,
        name: name ?? undefined,
      },
      select: { id: true },
    });
    return user.id;
  }

  // 2) Fallback to name (not guaranteed unique -> findFirst or create)
  if (name) {
    const existing = await prisma.user.findFirst({
      where: { name },
      select: { id: true },
      orderBy: { createdAt: "desc" }, // choose most recent if multiple
    });
    if (existing) return existing.id;

    // Create a new user row with this display name.
    // Email is left null (allowed by your schema).
    const created = await prisma.user.create({
      data: { name },
      select: { id: true },
    });
    return created.id;
  }

  // 3) Final fallback: guest
  return ensureGuestUserId();
}

/**
 * Create a persistent guest user and return its id.
 */
async function ensureGuestUserId(): Promise<string> {
  const g = await prisma.user.upsert({
    where: { email: "guest@example.com" },
    update: {},
    create: { email: "guest@example.com", name: "Guest" },
    select: { id: true },
  });
  return g.id;
}

/**
 * Create a chat for the current user (resolved from session by name/email).
 * Optionally seed meta with the initial snapshot of messages/roadmap.
 */
export async function createChat(params: {
  title?: string | null;
  userSubjectId?: string | null;
  initialMessages?: Array<{ id: string; type: "user" | "ai"; content: string; timestamp: number }>;
  initialRoadmap?: unknown;
}) {
  const userId = await resolveUserIdFromSession();

  const chat = await prisma.chat.create({
    data: {
      userId,
      title: params.title ?? null,
      userSubjectId: params.userSubjectId ?? null,
      meta: {
        messages: params.initialMessages ?? [],
        roadmap: params.initialRoadmap ?? null,
      },
    },
    select: { id: true, title: true },
  });

  return { ok: true as const, chatId: chat.id };
}

/**
 * Overwrite (or create) a compact transcript snapshot in Chat.meta.
 * You can call this after each turn to persist messages & roadmap.
 */
export async function saveChatSnapshot(params: {
  chatId: string;
  messages: Array<{ id: string; type: "user" | "ai"; content: string; timestamp: number }>;
  roadmap?: unknown;
  titleFallback?: string | null;
}) {
  const userId = await resolveUserIdFromSession();

  // Ownership check
  const chat = await prisma.chat.findUnique({
    where: { id: params.chatId },
    select: { userId: true, title: true },
  });
  if (!chat || chat.userId !== userId) {
    return { ok: false as const, error: "Chat not found or not owned by user." };
  }

  // Optional title backfill once
  const updateData: any = {
    meta: {
      messages: params.messages,
      roadmap: params.roadmap ?? null,
    },
  };
  if (params.titleFallback && !chat.title) {
    updateData.title = params.titleFallback;
  }

  await prisma.chat.update({
    where: { id: params.chatId },
    data: updateData,
  });

  return { ok: true as const };
}
