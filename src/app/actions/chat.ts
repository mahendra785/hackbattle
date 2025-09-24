// src/app/actions/chat.ts
"use server";

import { auth } from "../api/auth/auth";
import { prisma } from "@/lib/prisma";

export async function createChat({ title }: { title: string }) {
  const session = await auth();
  const userId = session?.user?.id ?? (await ensureGuestUserId());
  const chat = await prisma.chat.create({ data: { userId, title } });
  return { ok: true, chatId: chat.id };
}

async function ensureGuestUserId() {
  const g = await prisma.user.upsert({
    where: { email: "guest@example.com" },
    update: {},
    create: { email: "guest@example.com", name: "Guest" },
  });
  return g.id;
}
