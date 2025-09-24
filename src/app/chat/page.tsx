// src/app/chat/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createChat, listChats } from "@/app/actions/chat";

type ChatRow = {
  id: string;
  title: string | null;
  startedAt: string | Date;
  updatedAt: string | Date;
};

// --- helpers to decode server-action payloads ---
function decodeDate(v: unknown): Date | string {
  if (typeof v === "string") {
    // Next.js Server Actions encode Date as "$D<iso>"
    if (v.startsWith("$D")) return new Date(v.slice(2));
    // or sometimes plain ISO string
    const d = new Date(v);
    return isNaN(d.getTime()) ? v : d;
  }
  return v as any;
}

function normalizeChats(payload: any): ChatRow[] {
  // Your action returns { ok, items }, but in dev you pasted a tuple-ish dump.
  // Prefer items if present; otherwise try the second element as in your sample.
  const rawList =
    (payload && Array.isArray(payload.items) && payload.items) ||
    (Array.isArray(payload) && payload[1]) ||
    [];

  return (rawList as any[]).map((c) => ({
    id: c.id,
    title: c.title ?? null,
    startedAt: decodeDate(c.startedAt),
    updatedAt: decodeDate(c.updatedAt),
  }));
}

export default function StartChatPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [chats, setChats] = useState<ChatRow[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [chatErr, setChatErr] = useState<string | null>(null);

  async function loadChats() {
    setLoadingChats(true);
    setChatErr(null);
    try {
      const res = await listChats(); // server action result
      const normalized = normalizeChats(res); // <- decode here
      setChats(normalized);
    } catch (e: any) {
      setChatErr(e?.message ?? "Could not load chats.");
    } finally {
      setLoadingChats(false);
    }
  }

  useEffect(() => {
    loadChats();
  }, []);

  async function start() {
    setLoading(true);
    setErr(null);
    try {
      const res = await createChat({
        title: title.trim() || "New Chat",
        initialMessages: [],
        initialRoadmap: null,
      });
      if (!res?.ok) throw new Error("Failed to create chat");
      router.push(`/chat/${res.chatId}`);
    } catch (e: any) {
      setErr(e?.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid grid-cols-12 bg-neutral-950 text-neutral-100">
      {/* Sidebar */}
      <aside className="col-span-12 md:col-span-4 lg:col-span-3 border-r border-neutral-900">
        <div className="p-4 border-b border-neutral-900">
          <h2 className="text-sm font-semibold text-neutral-200">Your Chats</h2>
          <p className="text-[11px] text-neutral-500">Newest first</p>
        </div>
        <div className="p-2 space-y-1 overflow-y-auto max-h-[calc(100vh-70px)]">
          {loadingChats && (
            <div className="text-xs text-neutral-500 px-2 py-2">Loading…</div>
          )}
          {chatErr && (
            <div className="text-xs text-red-400 px-2 py-2">{chatErr}</div>
          )}
          {!loadingChats && !chatErr && chats.length === 0 && (
            <div className="text-xs text-neutral-500 px-2 py-2">
              No chats yet. Create one →
            </div>
          )}
          {chats.map((c) => (
            <Link
              key={c.id}
              href={`/chat/${c.id}`}
              className="block rounded-md px-3 py-2 text-sm hover:bg-neutral-900 border border-transparent hover:border-neutral-800"
            >
              <div className="truncate">{c.title || "Untitled chat"}</div>
              <div className="text-[10px] text-neutral-500">
                Updated: {new Date(c.updatedAt as any).toLocaleString()}
              </div>
            </Link>
          ))}
        </div>
      </aside>

      {/* Main */}
      <main className="col-span-12 md:col-span-8 lg:col-span-9 flex items-center justify-center">
        <div className="w-full max-w-md rounded-xl border border-neutral-800 bg-neutral-900 p-5 space-y-3">
          <h1 className="text-lg font-semibold">Start a new chat</h1>
          <input
            className="w-full rounded border border-neutral-700 bg-neutral-950 p-2 text-sm outline-none focus:border-orange-500"
            placeholder="Chat title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <button
            onClick={start}
            disabled={loading}
            className={`w-full rounded-md py-2 text-sm font-medium ${
              !loading
                ? "bg-orange-500 text-white hover:bg-orange-600"
                : "bg-neutral-800 text-neutral-500 cursor-not-allowed"
            }`}
          >
            {loading ? "Creating…" : "Start Chat"}
          </button>
          {err && <p className="text-xs text-red-400">{err}</p>}
          <p className="text-[11px] text-neutral-500">
            A chat will be created and you’ll be taken to the conversation page.
          </p>
        </div>
      </main>
    </div>
  );
}
