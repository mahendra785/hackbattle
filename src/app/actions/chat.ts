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
console.log("Session user:", { email, name });  
  // 1) Prefer email (unique, stable)
  if (email) {
    const user = await prisma.user.findFirst({
      where: { email },
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

export type ChatMessage = {
  id: string;
  type: "user" | "ai";
  content: string;
  timestamp: number;
};

type ChatMeta = {
  messages?: ChatMessage[];
  roadmap?: unknown;
  ui?: Record<string, unknown>;
  events?: Array<{ type: string; ts: number; data?: any }>;
};

/* ------------------ helpers ------------------ */
async function whoami(): Promise<string> {
  const session = await getServerSession();
  return session?.user?.name ? await resolveUserIdFromSession() : ensureGuestUserId();
}


async function assertOwnChat(chatId: string, userId: string) {
  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    select: { userId: true },
  });
  if (!chat || chat.userId !== userId) {
    throw new Error("Chat not found or not owned by user.");
  }
}

/* ------------------ create / list ------------------ */
export async function createChat(params: {
  title?: string | null;
  userSubjectId?: string | null;
  initialMessages?: ChatMessage[];
  initialRoadmap?: unknown;
}) {
  const userId = await whoami();

  const chat = await prisma.chat.create({
    data: {
      userId,
      title: params.title ?? null,
      userSubjectId: params.userSubjectId ?? null,
      meta: {
        messages: params.initialMessages ?? [],
        roadmap: params.initialRoadmap ?? null,
        events: [{ type: "createChat", ts: Date.now() }],
      } as ChatMeta,
    },
    select: { id: true, title: true },
  });

  return { ok: true as const, chatId: chat.id };
}

export async function listChats() {
  const userId = await whoami();
  const items = await prisma.chat.findMany({
    where: { userId, deletedAt: null },
    select: { id: true, title: true, updatedAt: true, startedAt: true },
    orderBy: { updatedAt: "desc" },
  });
  return { ok: true as const, items };
}

/* ------------------ load / save turn ------------------ */
export async function getChatSnapshot(chatId: string) {
  const userId = await whoami();
  await assertOwnChat(chatId, userId);

  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    select: { id: true, title: true, meta: true, updatedAt: true, startedAt: true },
  });

  const meta = (chat?.meta ?? {}) as ChatMeta;

  return {
    ok: true as const,
    chat: {
      id: chat!.id,
      title: chat!.title ?? null,
      messages: meta.messages ?? [],
      roadmap: meta.roadmap ?? null,
      updatedAt: chat!.updatedAt,
      startedAt: chat!.startedAt,
    },
  };
}

export async function appendTurn(params: {
  chatId: string;
  userMsg: ChatMessage;
  aiMsg: ChatMessage;
  roadmap?: unknown | null;
  uiPatch?: Record<string, unknown>;
}) {
  const userId = await whoami();
  await assertOwnChat(params.chatId, userId);

  await prisma.$transaction(async (tx) => {
    const current = await tx.chat.findUnique({
      where: { id: params.chatId },
      select: { meta: true, title: true },
    });

    const meta = (current?.meta ?? {}) as ChatMeta;
    const messages = [...(meta.messages ?? []), params.userMsg, params.aiMsg];

    const nextMeta: ChatMeta = {
      ...meta,
      messages,
      ...(params.roadmap !== undefined ? { roadmap: params.roadmap } : {}),
      ...(params.uiPatch ? { ui: { ...(meta.ui ?? {}), ...params.uiPatch } } : {}),
      events: [
        ...(meta.events ?? []),
        { type: "appendTurn", ts: Date.now(), data: { len: params.userMsg.content.length } },
      ],
    };

    const maybeTitle =
      !current?.title && messages.length
        ? messages.find((m) => m.type === "user")?.content.slice(0, 60) ?? null
        : undefined;

    await tx.chat.update({
      where: { id: params.chatId },
      data: { ...(maybeTitle !== undefined ? { title: maybeTitle } : {}), meta: nextMeta as any },
    });
  });

  return { ok: true as const };
}

/* ------------------ optional utilities ------------------ */
export async function renameChat(params: { chatId: string; title: string }) {
  const userId = await whoami();
  await assertOwnChat(params.chatId, userId);
  await prisma.chat.update({ where: { id: params.chatId }, data: { title: params.title } });
  return { ok: true as const };
}

export async function deleteChat(params: { chatId: string }) {
  const userId = await whoami();
  await assertOwnChat(params.chatId, userId);
  await prisma.chat.update({ where: { id: params.chatId }, data: { deletedAt: new Date() } });
  return { ok: true as const };
}


type RoadmapSubtopic = { type: "SUBTOPIC"; name: string };
type RoadmapTopic = { type: "TOPIC"; name: string; subtopics: RoadmapSubtopic[] };
type Roadmap = RoadmapTopic[];

export async function savePlanAsPathway(params: {
  chatId: string;
  plan: Roadmap;
  title?: string | null;
  status?: "DRAFT" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
}) {
  const session = await getServerSession();
  const userId = session?.user?.email
    ? (await prisma.user.findFirst({ where: { email: session.user.email }, select: { id: true } }))?.id
    : (await prisma.user.upsert({
        where: { email: "guest@example.com" },
        update: {},
        create: { email: "guest@example.com", name: "Guest" },
        select: { id: true },
      }))!.id;

  // Ownership check (optional but recommended)
  const chat = await prisma.chat.findUnique({ where: { id: params.chatId }, select: { userId: true } });
  if (!chat || chat.userId !== userId) {
    return { ok: false as const, error: "Chat not found or not owned by user." };
  }

  // If a pathway already exists for this chat, update it; else create it.
  const existing = await prisma.pathway.findUnique({
    where: { chatId: params.chatId },
    select: { id: true },
  });

  if (existing) {
    await prisma.pathway.update({
      where: { id: existing.id },
      data: {
        title: params.title ?? undefined,
        status: (params.status as any) ?? undefined,
        planSpec: params.plan as any,
      },
    });
    return { ok: true as const, pathwayId: existing.id, created: false as const };
  } else {
    const created = await prisma.pathway.create({
      data: {
        userId,
        chatId: params.chatId,
        title: params.title ?? null,
        status: (params.status as any) ?? "DRAFT",
        planSpec: params.plan as any,
      },
      select: { id: true },
    });
    return { ok: true as const, pathwayId: created.id, created: true as const };
  }
}
