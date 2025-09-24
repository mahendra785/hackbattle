// src/app/chat/[id]/page.tsx
"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { Send } from "lucide-react";
import { useSession } from "next-auth/react";
import { saveChatSnapshot } from "@/app/actions/chat";
import { savePlanAsPathway } from "@/app/actions/pathway";
import { classifyPrompt } from "@/app/actions/nlu";
import {
  generatePractice,
  type GeneratedMCQ,
  type GeneratedTextQ,
} from "@/app/actions/quiz";
import { useParams } from "next/navigation";
import MCQCard from "../../../components/mcq";
import TextAnswerCard from "../../../components/Text";
import YoutubeRecs from "../../../components/YoutubeRecs";

/* =========================
   Types
========================= */
type BaseMessage = { id: string; timestamp: number };
type TextMessage = BaseMessage & { type: "user" | "ai"; content: string };

type RoadmapSubtopic = { type: "SUBTOPIC"; name: string };
type RoadmapTopic = {
  type: "TOPIC";
  name: string;
  subtopics: RoadmapSubtopic[];
};
type Roadmap = RoadmapTopic[];

type RoadmapMessage = BaseMessage & {
  type: "roadmap";
  plan: Roadmap;
  note?: string;
};
type ChatMessage = TextMessage | RoadmapMessage;

type ContentItem = { type: string; content: string };

/* =========================
   Config
========================= */
const API_BASE = "https://retiform-leonida-stifledly.ngrok-free.dev";
const ROADMAP_GET = (q: string) =>
  `${API_BASE}/ask?q=${encodeURIComponent(q)}&_ngrok_skip_browser_warning=true`;
const CHAT_POST = `${API_BASE}/general`;

/* =========================
   Helpers
========================= */
function tryExtractRoadmapFromText(text: string): Roadmap | null {
  const first = text.indexOf("[");
  const last = text.lastIndexOf("]");
  if (first === -1 || last === -1 || last <= first) return null;
  try {
    const json = text.slice(first, last + 1).trim();
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return null;
    const ok = parsed.every(
      (t: any) =>
        t?.type === "TOPIC" &&
        typeof t.name === "string" &&
        Array.isArray(t.subtopics) &&
        t.subtopics.every(
          (s: any) => s?.type === "SUBTOPIC" && typeof s.name === "string"
        )
    );
    return ok ? (parsed as Roadmap) : null;
  } catch {
    return null;
  }
}
function stripRoadmapJsonFromText(text: string): string {
  const first = text.indexOf("[");
  const last = text.lastIndexOf("]");
  if (first === -1 || last === -1 || last <= first) return text;
  const before = text.slice(0, first).trim();
  const after = text.slice(last + 1).trim();
  return [before, after].filter(Boolean).join("\n\n").trim();
}
function roadmapLeadIn(plan: Roadmap): string {
  const topics = plan.map((t) => t.name).slice(0, 6);
  const tail = plan.length > 6 ? "…" : "";
  return `I created a roadmap (${topics.join(
    " → "
  )}${tail}). Click a topic to explore subtopics.`;
}
function buildMetadata(messages: ChatMessage[], latestPlan?: Roadmap | null) {
  return {
    events: [],
    roadmap: latestPlan ?? [],
    messages: messages
      .filter((m): m is TextMessage => m.type === "user" || m.type === "ai")
      .map((m) => ({
        id: m.id,
        type: m.type,
        content: (m as TextMessage).content,
        timestamp: m.timestamp,
      })),
  };
}

/* =========================
   Header
========================= */
function Header() {
  const { data: session } = useSession();
  return (
    <header className="sticky top-0 z-10 border-b border-neutral-900 bg-neutral-950/80 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-orange-500 grid place-items-center">
            <span className="text-xs font-semibold">AI</span>
          </div>
          <span className="text-sm text-neutral-300">Learning Copilot</span>
        </div>
        {session?.user ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-300">
              {session.user.name}
            </span>
            <Image
              src={session.user.image || "/default-avatar.png"}
              alt={session.user.name || "User"}
              width={28}
              height={28}
              className="rounded-full"
            />
          </div>
        ) : (
          <Image
            src="/default-avatar.png"
            alt="Guest"
            width={28}
            height={28}
            className="rounded-full"
          />
        )}
      </div>
    </header>
  );
}

/* =========================
   Learning Content (RIGHT PANEL)
/* pulls /content/?q=... and shows above practice */
function LearningContent({ query }: { query: string }) {
  const [items, setItems] = useState<ContentItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!query) return;
    let alive = true;
    (async () => {
      setLoading(true);
      setErr(null);
      setItems(null);
      try {
        const url = `${API_BASE}/content/?q=${encodeURIComponent(
          query
        )}&_ngrok_skip_browser_warning=true`;
        const res = await fetch(url, {
          method: "GET",
          mode: "cors",
          headers: {
            "ngrok-skip-browser-warning": "true",
            Accept: "application/json,text/plain;q=0.9",
            "Cache-Control": "no-cache",
          },
        });
        const ct = res.headers.get("content-type") || "";
        const bodyText = await res.text();
        if (ct.includes("text/html") || bodyText.includes("ERR_NGROK_6024")) {
          throw new Error("Ngrok splash intercepted the request.");
        }
        if (!res.ok) throw new Error(`Backend error ${res.status}`);
        const parsed = JSON.parse(bodyText);
        if (!Array.isArray(parsed))
          throw new Error("Unexpected /content shape.");
        if (alive) setItems(parsed as ContentItem[]);
      } catch (e: any) {
        if (alive) setErr(e?.message ?? "Failed to load content.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [query]);

  if (loading) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
        <div className="flex items-center gap-2 text-sm text-neutral-400">
          <div className="h-2 w-2 rounded-full bg-neutral-500 animate-pulse" />
          Loading study materials…
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="rounded-xl border border-red-900/40 bg-red-950/40 p-4 text-sm text-red-300">
        {err}
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-sm text-neutral-400">
        No study materials found for this topic.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-800 bg-neutral-900/60">
        <div className="text-sm font-semibold text-neutral-100">
          Study materials
        </div>
        <div className="text-xs text-neutral-500">{query}</div>
      </div>
      <div className="divide-y divide-neutral-800">
        {items.map((it, idx) => (
          <div key={idx} className="p-4 space-y-1.5">
            <div className="text-[11px] uppercase tracking-wide text-neutral-400">
              {it.type}
            </div>
            <div className="text-sm whitespace-pre-wrap text-neutral-200">
              {it.content}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* =========================
   D3 Roadmap (unchanged)
========================= */
function InteractiveRoadmap({
  roadmap,
  onSubtopicClick,
}: {
  roadmap: Roadmap;
  onSubtopicClick: (topicName: string, subtopic: string) => void;
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<number | null>(null);

  const { nodes, links } = useMemo(() => {
    type Node = {
      id: string;
      label: string;
      index: number;
      x: number;
      y: number;
    };
    type Link = { source: string; target: string };
    const n: Node[] = [];
    const l: Link[] = [];
    const gapX = 180;
    const centerY = 100;

    roadmap.forEach((topic, i) => {
      const topicId = `topic_${i}`;
      const x = 100 + i * gapX;
      n.push({ id: topicId, label: topic.name, index: i, x, y: centerY });
      if (i > 0) l.push({ source: `topic_${i - 1}`, target: topicId });
    });

    return { nodes: n, links: l };
  }, [roadmap]);

  useEffect(() => {
    if (!wrapperRef.current) return;
    const wrapper = wrapperRef.current;
    const width = wrapper.clientWidth;
    const height = 200;

    let svg = d3.select(svgRef.current);
    if (svg.empty()) {
      svg = d3
        .select(wrapper)
        .append("svg")
        .attr("ref", (el) => (svgRef.current = el as any));
    }
    svg
      .attr("width", "100%")
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`);
    svg.selectAll("*").remove();

    svg
      .append("defs")
      .append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 45)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#f97316");

    const g = svg.append("g");
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 2])
      .on("zoom", (e) => g.attr("transform", e.transform));
    svg.call(zoom as any);

    g.selectAll("line.link")
      .data(links)
      .enter()
      .append("line")
      .attr("class", "link")
      .attr("stroke", "#f97316")
      .attr("stroke-width", 2)
      .attr("marker-end", "url(#arrow)")
      .attr("x1", (d) => nodes.find((n) => n.id === d.source)!.x + 35)
      .attr("y1", (d) => nodes.find((n) => n.id === d.source)!.y)
      .attr("x2", (d) => nodes.find((n) => n.id === d.target)!.x - 35)
      .attr("y2", (d) => nodes.find((n) => n.id === d.target)!.y);

    const nodeGroup = g
      .selectAll("g.node")
      .data(nodes)
      .enter()
      .append("g")
      .attr("class", "node")
      .attr("transform", (d) => `translate(${d.x}, ${d.y})`);

    nodeGroup
      .append("circle")
      .attr("r", 35)
      .attr("fill", (d) => (selectedTopic === d.index ? "#f97316" : "#111827"))
      .attr("stroke", "#f97316")
      .attr("stroke-width", 2)
      .style("cursor", "pointer")
      .on("mouseover", function () {
        d3.select(this).attr("fill", "#f97316").attr("r", 38);
      })
      .on("mouseout", function (_e, d: any) {
        d3.select(this)
          .attr("fill", selectedTopic === d.index ? "#f97316" : "#111827")
          .attr("r", 35);
      })
      .on("click", function (_e, d: any) {
        setSelectedTopic(selectedTopic === d.index ? null : d.index);
      });

    nodeGroup
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("font-size", "11px")
      .attr("fill", "#ffffff")
      .attr("font-weight", "500")
      .style("pointer-events", "none")
      .each(function (d: any) {
        const text = d3.select(this);
        const words = String(d.label).split(/\s+/);
        if (words.length === 1 && d.label.length <= 12) text.text(d.label);
        else if (words.length <= 2) {
          text.selectAll("tspan").remove();
          words.forEach((word: string, i: number) =>
            text
              .append("tspan")
              .attr("x", 0)
              .attr("dy", i === 0 ? "-0.3em" : "1.2em")
              .text(word.length > 10 ? word.slice(0, 8) + "..." : word)
          );
        } else {
          text.text(
            words[0].length > 8
              ? words[0].slice(0, 6) + "..."
              : words[0] + "..."
          );
        }
      });

    const totalWidth =
      nodes.length > 0 ? Math.max(...nodes.map((n) => n.x)) + 100 : width;
    if (totalWidth > width) {
      svg.attr("viewBox", `0 0 ${totalWidth} ${height}`);
      let isScrolling = false,
        startX = 0,
        scrollLeft = 0;
      const handleStart = (x: number) => {
        isScrolling = true;
        startX = x;
        scrollLeft = parseFloat(
          (svg.attr("viewBox") || "0 0 0 0").split(" ")[0]
        );
        svg.style("cursor", "grabbing");
      };
      const handleMove = (x: number) => {
        if (!isScrolling) return;
        const walk = (x - startX) * 2;
        const newLeft = Math.max(
          0,
          Math.min(totalWidth - width, scrollLeft - walk)
        );
        svg.attr("viewBox", `${newLeft} 0 ${width} ${height}`);
      };
      const handleEnd = () => {
        isScrolling = false;
        svg.style("cursor", "grab");
      };
      svg
        .style("cursor", "grab")
        .on("mousedown", (e: any) => handleStart(e.clientX))
        .on("mousemove", (e: any) => handleMove(e.clientX))
        .on("mouseup", handleEnd)
        .on("mouseleave", handleEnd);
    } else {
      svg.attr("viewBox", `0 0 ${width} ${height}`);
    }

    const onResize = () => {
      svg.attr("viewBox", `0 0 ${wrapper.clientWidth} ${height}`);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [nodes, links, selectedTopic]);

  return (
    <div className="space-y-4">
      <div
        ref={wrapperRef}
        className="w-full h-48 overflow-hidden rounded-xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950 shadow-lg"
      />
      {selectedTopic !== null && roadmap[selectedTopic] && (
        <div className="rounded-xl border border-orange-500/20 bg-gradient-to-br from-neutral-900 to-neutral-950 shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-orange-500/10 to-transparent p-4 border-b border-orange-500/20">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-orange-500 rounded-full" />
              <h3 className="font-semibold text-orange-400">
                {roadmap[selectedTopic].name}
              </h3>
              <span className="text-xs text-neutral-500 ml-2">
                {roadmap[selectedTopic].subtopics.length} subtopics
              </span>
            </div>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {roadmap[selectedTopic].subtopics.map((subtopic, i) => (
                <div
                  key={i}
                  className="group flex items-center gap-3 text-sm text-neutral-300 bg-neutral-800/50 hover:bg-neutral-800 rounded-lg px-3 py-2.5 transition-colors duration-200 cursor-pointer"
                  onClick={() =>
                    onSubtopicClick(roadmap[selectedTopic].name, subtopic.name)
                  }
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-400 group-hover:bg-orange-300 transition-colors duration-200 flex-shrink-0" />
                  <span className="group-hover:text-neutral-200 transition-colors duration-200">
                    {subtopic.name}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-neutral-800">
              <div className="text-xs text-neutral-500">
                💡 Click subtopics to learn more • Click the circle again to
                collapse
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================
   Chat Messages (supports roadmap)
========================= */
function ChatMessages({
  messages,
  isTyping,
  onSubtopicClick,
}: {
  messages: ChatMessage[];
  isTyping: boolean;
  onSubtopicClick: (topic: string, subtopic: string) => void;
}) {
  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  return (
    <div className="space-y-6">
      {messages.map((m) => {
        if (m.type === "roadmap") {
          const rm = m as RoadmapMessage;
          return (
            <div key={m.id} className="space-y-2">
              {rm.note && (
                <div className="flex gap-3 w-full">
                  <div className="h-8 w-8 rounded-full bg-neutral-800 grid place-items-center flex-shrink-0">
                    <span className="text-orange-400 text-xs font-semibold">
                      AI
                    </span>
                  </div>
                  <div className="flex-1 rounded-2xl bg-neutral-900 border border-neutral-800 px-4 py-3 leading-relaxed whitespace-pre-wrap">
                    {rm.note}
                  </div>
                </div>
              )}
              <InteractiveRoadmap
                roadmap={rm.plan}
                onSubtopicClick={onSubtopicClick}
              />
            </div>
          );
        }

        const tm = m as TextMessage;
        return tm.type === "ai" ? (
          <div key={m.id} className="flex gap-3 w-full">
            <div className="h-8 w-8 rounded-full bg-neutral-800 grid place-items-center flex-shrink-0">
              <span className="text-orange-400 text-xs font-semibold">AI</span>
            </div>
            <div className="flex-1 rounded-2xl bg-neutral-900 border border-neutral-800 px-4 py-3 leading-relaxed whitespace-pre-wrap">
              {tm.content}
            </div>
          </div>
        ) : (
          <div
            key={m.id}
            className="ml-auto max-w-[80%] rounded-2xl bg-orange-500 text-white px-4 py-3 leading-relaxed whitespace-pre-wrap"
          >
            {tm.content}
          </div>
        );
      })}
      {isTyping && (
        <div className="flex gap-3 items-center text-neutral-400">
          <div className="h-2 w-2 rounded-full bg-neutral-500 animate-pulse" />
          <div className="text-sm">AI is typing…</div>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}

/* =========================
   Chat Input
========================= */
function ChatInput({
  currentMessage,
  setCurrentMessage,
  onSend,
  disabled,
}: {
  currentMessage: string;
  setCurrentMessage: (message: string) => void;
  onSend: (text: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="border-t border-neutral-800 bg-gradient-to-t from-neutral-950 via-neutral-950/95 to-transparent p-4">
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900 focus-within:ring-1 focus-within:ring-orange-500">
        <textarea
          rows={1}
          className="w-full resize-none bg-transparent px-4 py-3 outline-none"
          placeholder='Ask anything… e.g. "Create a learning roadmap for Machine Learning"'
          value={currentMessage}
          onChange={(e) => setCurrentMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              const text = currentMessage.trim();
              if (text) onSend(text);
            }
          }}
        />
        <div className="flex items-center justify-end px-2 pb-2">
          <button
            onClick={() => {
              const text = currentMessage.trim();
              if (text) onSend(text);
            }}
            disabled={disabled}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
              !disabled
                ? "bg-orange-500 text-white hover:bg-orange-600"
                : "bg-neutral-800 text-neutral-500 cursor-not-allowed"
            }`}
          >
            <Send size={16} />
            Send
          </button>
        </div>
      </div>
      <p className="text-[11px] text-neutral-500 mt-2 text-center">
        Ask for learning roadmaps and I’ll create interactive visualizations for
        you
      </p>
    </div>
  );
}

/* =========================
   Main Page (Chat by ID)
========================= */
export default function ChatByIdPage() {
  const params = useParams<{ id: string }>();
  const chatId = params?.id ?? null;

  const [currentMessage, setCurrentMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: crypto.randomUUID(),
      type: "ai",
      content:
        "Hi! I'm your learning copilot. Ask anything.\nTip: Ask for a roadmap in JSON (TOPIC/SUBTOPIC) and I'll render it as an interactive graph.",
      timestamp: Date.now(),
    } as TextMessage,
  ]);

  const [selectedLearningTopic, setSelectedLearningTopic] = useState<{
    topicName: string;
    subtopicName: string;
  } | null>(null);

  // Dynamic practice state (Gemini)
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [practiceErr, setPracticeErr] = useState<string | null>(null);
  const [genMcqs, setGenMcqs] = useState<GeneratedMCQ[]>([]);
  const [genTexts, setGenTexts] = useState<GeneratedTextQ[]>([]);

  // --- helpers for HTTP ---
  async function getAskRaw(query: string): Promise<string> {
    const res = await fetch(ROADMAP_GET(query), {
      method: "GET",
      headers: {
        "ngrok-skip-browser-warning": "true",
        Accept: "text/plain, application/json;q=0.9",
        "Cache-Control": "no-cache",
      },
      mode: "cors",
    });
    const text = await res.text();
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("text/html") || text.includes("ERR_NGROK_6024")) {
      throw new Error("Ngrok splash intercepted the request.");
    }
    if (!res.ok) {
      throw new Error(`Backend error ${res.status}: ${text.substring(0, 200)}`);
    }
    return text;
  }

  async function postJSON<T = any>(url: string, body: unknown): Promise<T> {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "ngrok-skip-browser-warning": "true",
        Accept: "application/json,text/plain;q=0.9",
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
      mode: "cors",
      body: JSON.stringify(body),
    });
    const text = await res.text();
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("text/html") || text.includes("ERR_NGROK_6024")) {
      throw new Error("Ngrok splash intercepted the request.");
    }
    if (!res.ok) {
      throw new Error(`Backend error ${res.status}: ${text.substring(0, 200)}`);
    }
    try {
      return JSON.parse(text);
    } catch {
      return text as any;
    }
  }

  // --- send handler (unchanged routing) ---
  async function handleSend(text: string) {
    if (!chatId) return;
    setCurrentMessage("");

    const userMsg: TextMessage = {
      id: crypto.randomUUID(),
      type: "user",
      content: text,
      timestamp: Date.now(),
    };

    let afterUser: ChatMessage[] = [];
    setMessages((prev) => (afterUser = [...prev, userMsg]));

    setIsTyping(true);
    try {
      const verdict = await classifyPrompt(text);

      let finalArray: ChatMessage[] = afterUser;
      let latestPlan: Roadmap | null = null;

      if (verdict.type === "roadmap") {
        const raw = await getAskRaw(text);
        const plan = tryExtractRoadmapFromText(raw);

        if (!plan) {
          const fallbackAI: TextMessage = {
            id: crypto.randomUUID(),
            type: "ai",
            content: raw,
            timestamp: Date.now(),
          };
          setMessages((prev) => (finalArray = [...prev, fallbackAI]));
        } else {
          latestPlan = plan;

          const lead: TextMessage = {
            id: crypto.randomUUID(),
            type: "ai",
            content: roadmapLeadIn(plan),
            timestamp: Date.now(),
          };
          const road: RoadmapMessage = {
            id: crypto.randomUUID(),
            type: "roadmap",
            plan,
            timestamp: Date.now(),
          };
          setMessages((prev) => (finalArray = [...prev, lead, road]));

          await savePlanAsPathway({
            plan,
            title: "Learning Path",
            chatId,
            status: "ACTIVE",
          });
        }
      } else {
        const metadata = buildMetadata(afterUser, null);
        const result = await postJSON<any>(CHAT_POST, {
          metadata,
          query: text,
        });

        const raw =
          typeof result === "string"
            ? result
            : result?.text ?? JSON.stringify(result);
        const possiblePlan = tryExtractRoadmapFromText(raw);
        const cleaned = stripRoadmapJsonFromText(raw);

        const aiText: TextMessage = {
          id: crypto.randomUUID(),
          type: "ai",
          content: cleaned || raw,
          timestamp: Date.now(),
        };
        setMessages((prev) => (finalArray = [...prev, aiText]));

        if (possiblePlan) {
          latestPlan = possiblePlan;
          const road: RoadmapMessage = {
            id: crypto.randomUUID(),
            type: "roadmap",
            plan: possiblePlan,
            note: roadmapLeadIn(possiblePlan),
            timestamp: Date.now(),
          };
          setMessages((prev) => (finalArray = [...prev, road]));
          await savePlanAsPathway({
            plan: possiblePlan,
            title: "Learning Path",
            chatId,
            status: "ACTIVE",
          });
        }
      }

      await saveChatSnapshot({
        chatId,
        messages: finalArray.filter(
          (m): m is TextMessage => m.type === "user" || m.type === "ai"
        ),
        roadmap: latestPlan ?? null,
        titleFallback: afterUser.length <= 2 ? text.slice(0, 60) : null,
      });
    } catch (e: any) {
      const aiErr: TextMessage = {
        id: crypto.randomUUID(),
        type: "ai",
        content: `Could not reach server:\n\n${e?.message ?? "Unknown error"}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, aiErr]);
      await saveChatSnapshot({
        chatId,
        messages: [...messages, userMsg, aiErr].filter(
          (m): m is TextMessage => m.type === "user" || m.type === "ai"
        ),
      });
    } finally {
      setIsTyping(false);
    }
  }

  // Generate practice whenever a subtopic is selected (and we have a roadmap)
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!selectedLearningTopic) return;
      // find the latest roadmap in the chat to pass as context
      const latestRoadmap = [...messages]
        .reverse()
        .find((m): m is RoadmapMessage => m.type === "roadmap")?.plan;

      setPracticeLoading(true);
      setPracticeErr(null);
      setGenMcqs([]);
      setGenTexts([]);
      try {
        const res = await generatePractice({
          topic: selectedLearningTopic.topicName,
          subtopic: selectedLearningTopic.subtopicName,
          roadmap: latestRoadmap ?? [],
          numMcqs: 3,
          numTexts: 2,
        });
        if (!alive) return;
        setGenMcqs(res.mcqs || []);
        setGenTexts(res.texts || []);
      } catch (e: any) {
        if (!alive) return;
        setPracticeErr(e?.message ?? "Failed to generate practice.");
      } finally {
        if (alive) setPracticeLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [selectedLearningTopic, messages]);

  function handleSubtopicClick(topicName: string, subtopicName: string) {
    setSelectedLearningTopic({ topicName, subtopicName });
  }
  function closeLearningContent() {
    setSelectedLearningTopic(null);
  }

  const isLearningMode = selectedLearningTopic !== null;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      <Header />

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Chat */}
        <div
          className={`${
            isLearningMode ? "w-1/2" : "w-full"
          } flex flex-col transition-all duration-300`}
        >
          <main
            className={`flex-1 overflow-y-auto ${
              isLearningMode ? "max-w-none" : "mx-auto max-w-3xl"
            } px-4 py-6 space-y-6`}
          >
            <ChatMessages
              messages={messages}
              isTyping={isTyping}
              onSubtopicClick={handleSubtopicClick}
            />
          </main>

          <ChatInput
            currentMessage={currentMessage}
            setCurrentMessage={setCurrentMessage}
            onSend={handleSend}
            disabled={!currentMessage.trim() || !chatId}
          />
        </div>

        {/* Right: Practice Panel WITH /content + Gemini-generated practice */}
        {isLearningMode && selectedLearningTopic && (
          <div className="w-1/2 h-full overflow-y-auto border-l border-neutral-800 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-neutral-200">
                {selectedLearningTopic.subtopicName}
              </h3>
              <button
                onClick={closeLearningContent}
                className="text-neutral-500 hover:text-neutral-300 text-sm px-2 py-1 rounded hover:bg-neutral-800"
              >
                ✕ Close
              </button>
            </div>

            {/* Study content pulled from /content API (above practice) */}
            <LearningContent query={selectedLearningTopic.subtopicName} />

            {/* Gemini-generated practice */}
            {practiceLoading && (
              <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-sm text-neutral-300">
                Generating practice…
              </div>
            )}
            {practiceErr && (
              <div className="rounded-xl border border-red-900/40 bg-red-950/40 p-4 text-sm text-red-300">
                {practiceErr}
              </div>
            )}

            {/* MCQs */}
            {(genMcqs.length
              ? genMcqs
              : [
                  // Fallback MCQ if Gemini returns nothing
                  {
                    question: `Which statement about ${selectedLearningTopic.subtopicName} is true?`,
                    options: [
                      "It is unrelated to React rendering.",
                      `It helps organize ${selectedLearningTopic.subtopicName} for maintainability.`,
                      "It always slows down performance.",
                      "It cannot be used with TypeScript.",
                    ],
                    correctIndex: 1,
                  },
                ]
            ).map((q, idx) => (
              <MCQCard
                key={`mcq-${idx}`}
                question={q.question}
                options={q.options}
                correctIndex={q.correctIndex}
                explanation={q.explanation}
              />
            ))}

            {/* Short-answer prompts */}
            {(genTexts.length
              ? genTexts
              : [
                  // Fallback text prompt
                  {
                    prompt: `In 3–5 sentences, explain how you would apply ${selectedLearningTopic.subtopicName} within ${selectedLearningTopic.topicName} and mention one common pitfall to avoid.`,
                    context: `Topic: ${selectedLearningTopic.topicName}. Subtopic: ${selectedLearningTopic.subtopicName}. Audience: beginner.`,
                  },
                ]
            ).map((t, idx) => (
              <TextAnswerCard
                key={`textq-${idx}`}
                prompt={t.prompt}
                context={t.context}
              />
            ))}

            {/* Optional: YouTube */}
            <YoutubeRecs topic={selectedLearningTopic.subtopicName} />
          </div>
        )}
      </div>
    </div>
  );
}
