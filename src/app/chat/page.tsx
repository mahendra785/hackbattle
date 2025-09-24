"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { Send, BookOpen, Play, FileText, ExternalLink } from "lucide-react";

/* =========================
   Types
========================= */
type ChatMessage = {
  id: string;
  type: "user" | "ai";
  content: string;
  timestamp: number;
};

type RoadmapSubtopic = { type: "SUBTOPIC"; name: string };
type RoadmapTopic = {
  type: "TOPIC";
  name: string;
  subtopics: RoadmapSubtopic[];
};
type Roadmap = RoadmapTopic[];

/* =========================
   Config
========================= */
const API_BASE = "https://retiform-leonida-stifledly.ngrok-free.dev";

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

/* =========================
   Header Component
========================= */
import { useSession } from "next-auth/react";
function Header() {
  const { data: session, status } = useSession();
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
   Chat Messages Component
========================= */
function ChatMessages({
  messages,
  isTyping,
}: {
  messages: ChatMessage[];
  isTyping: boolean;
}) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  return (
    <div className="space-y-6">
      {messages.map((m) => (
        <div key={m.id} className="flex">
          {m.type === "ai" ? (
            <div className="flex gap-3 w-full">
              <div className="h-8 w-8 rounded-full bg-neutral-800 grid place-items-center flex-shrink-0">
                <span className="text-orange-400 text-xs font-semibold">
                  AI
                </span>
              </div>
              <div className="flex-1 rounded-2xl bg-neutral-900 border border-neutral-800 px-4 py-3 leading-relaxed whitespace-pre-wrap">
                {(() => {
                  // Hide JSON roadmap data from display
                  const roadmapMatch = tryExtractRoadmapFromText(m.content);
                  if (roadmapMatch) {
                    const first = m.content.indexOf("[");
                    const last = m.content.lastIndexOf("]");
                    if (first !== -1 && last !== -1 && last > first) {
                      const beforeJson = m.content.slice(0, first).trim();
                      const afterJson = m.content.slice(last + 1).trim();
                      const cleanContent = [beforeJson, afterJson]
                        .filter(Boolean)
                        .join("\n\n")
                        .trim();

                      if (cleanContent) {
                        return cleanContent;
                      } else {
                        return "I've created an interactive roadmap for you below. Click on any topic circle to explore its subtopics.";
                      }
                    }
                  }
                  return m.content;
                })()}
              </div>
            </div>
          ) : (
            <div className="ml-auto max-w-[80%] rounded-2xl bg-orange-500 text-white px-4 py-3 leading-relaxed whitespace-pre-wrap">
              {m.content}
            </div>
          )}
        </div>
      ))}
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
   D3 Interactive Roadmap Component
========================= */
function InteractiveRoadmap({
  roadmap,
  onSubtopicClick,
}: {
  roadmap: Roadmap;
  onSubtopicClick: (topicName: string, subtopicName: string) => void;
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

      n.push({
        id: topicId,
        label: topic.name,
        index: i,
        x,
        y: centerY,
      });

      // Connect topics in sequence
      if (i > 0) {
        l.push({ source: `topic_${i - 1}`, target: topicId });
      }
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

    // Arrow marker
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

    // Zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 2])
      .on("zoom", (e) => g.attr("transform", e.transform));
    svg.call(zoom as any);

    // Links
    g.selectAll("line.link")
      .data(links)
      .enter()
      .append("line")
      .attr("class", "link")
      .attr("stroke", "#f97316")
      .attr("stroke-width", 2)
      .attr("marker-end", "url(#arrow)")
      .attr("x1", (d) => {
        const source = nodes.find((n) => n.id === d.source)!;
        return source.x + 35; // radius + some padding
      })
      .attr("y1", (d) => nodes.find((n) => n.id === d.source)!.y)
      .attr("x2", (d) => {
        const target = nodes.find((n) => n.id === d.target)!;
        return target.x - 35; // radius + some padding
      })
      .attr("y2", (d) => nodes.find((n) => n.id === d.target)!.y);

    // Node groups
    const nodeGroup = g
      .selectAll("g.node")
      .data(nodes)
      .enter()
      .append("g")
      .attr("class", "node")
      .attr("transform", (d) => `translate(${d.x}, ${d.y})`);

    // Circles
    nodeGroup
      .append("circle")
      .attr("r", 35)
      .attr("fill", (d) => (selectedTopic === d.index ? "#f97316" : "#111827"))
      .attr("stroke", "#f97316")
      .attr("stroke-width", 2)
      .style("cursor", "pointer")
      .on("mouseover", function (event, d) {
        d3.select(this).attr("fill", "#f97316").attr("r", 38);
      })
      .on("mouseout", function (event, d) {
        d3.select(this)
          .attr("fill", selectedTopic === d.index ? "#f97316" : "#111827")
          .attr("r", 35);
      })
      .on("click", function (event, d) {
        setSelectedTopic(selectedTopic === d.index ? null : d.index);
      });

    // Text labels
    nodeGroup
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("font-size", "11px")
      .attr("fill", "#ffffff")
      .attr("font-weight", "500")
      .style("pointer-events", "none")
      .each(function (d) {
        const text = d3.select(this);
        const words = d.label.split(/\s+/);

        if (words.length === 1 && d.label.length <= 12) {
          // Single word, short enough
          text.text(d.label);
        } else if (words.length <= 2) {
          // Two words or less
          text.selectAll("tspan").remove();
          words.forEach((word, i) => {
            text
              .append("tspan")
              .attr("x", 0)
              .attr("dy", i === 0 ? "-0.3em" : "1.2em")
              .text(word.length > 10 ? word.slice(0, 8) + "..." : word);
          });
        } else {
          // Multiple words - show first word + "..."
          text.text(
            words[0].length > 8
              ? words[0].slice(0, 6) + "..."
              : words[0] + "..."
          );
        }
      });

    // Auto-center the view with horizontal scrolling
    const totalWidth =
      nodes.length > 0 ? Math.max(...nodes.map((n) => n.x)) + 100 : width;
    if (totalWidth > width) {
      // Enable horizontal scrolling by setting a larger viewBox width
      svg.attr("viewBox", `0 0 ${totalWidth} ${height}`);

      // Add scroll functionality
      let isScrolling = false;
      let startX = 0;
      let scrollLeft = 0;

      const handleStart = (clientX: number) => {
        isScrolling = true;
        startX = clientX;
        const viewBox = svg.attr("viewBox").split(" ");
        scrollLeft = parseFloat(viewBox[0]);
        svg.style("cursor", "grabbing");
      };

      const handleMove = (clientX: number) => {
        if (!isScrolling) return;
        const x = clientX;
        const walk = (x - startX) * 2; // Scroll speed
        const newScrollLeft = Math.max(
          0,
          Math.min(totalWidth - width, scrollLeft - walk)
        );
        svg.attr("viewBox", `${newScrollLeft} 0 ${width} ${height}`);
      };

      const handleEnd = () => {
        isScrolling = false;
        svg.style("cursor", "grab");
      };

      svg
        .style("cursor", "grab")
        .on("mousedown", (e) => handleStart(e.clientX))
        .on("mousemove", (e) => handleMove(e.clientX))
        .on("mouseup", handleEnd)
        .on("mouseleave", handleEnd);
    } else {
      svg.attr("viewBox", `0 0 ${width} ${height}`);
    }

    // Handle resize
    const onResize = () => {
      const w = wrapper.clientWidth;
      svg.attr("viewBox", `0 0 ${w} ${height}`);
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

      {/* Subtopics panel */}
      {selectedTopic !== null && roadmap[selectedTopic] && (
        <div className="rounded-xl border border-orange-500/20 bg-gradient-to-br from-neutral-900 to-neutral-950 shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-orange-500/10 to-transparent p-4 border-b border-orange-500/20">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
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
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-400 group-hover:bg-orange-300 transition-colors duration-200 flex-shrink-0"></div>
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
   Learning Content Component
========================= */
function LearningContent({
  topicName,
  subtopicName,
  onClose,
}: {
  topicName: string;
  subtopicName: string;
  onClose: () => void;
}) {
  return (
    <div className="h-full bg-gradient-to-br from-neutral-900 to-neutral-950 border-l border-neutral-800 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-neutral-800 bg-gradient-to-r from-orange-500/10 to-transparent">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
          <div>
            <h2 className="font-semibold text-orange-400">{subtopicName}</h2>
            <p className="text-xs text-neutral-500">from {topicName}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-neutral-500 hover:text-neutral-300 text-sm font-medium px-2 py-1 rounded hover:bg-neutral-800 transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Overview Card */}
        <div className="bg-neutral-800/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen size={16} className="text-orange-400" />
            <h3 className="font-medium text-neutral-200">Overview</h3>
          </div>
          <p className="text-sm text-neutral-400 leading-relaxed">
            This is a comprehensive guide to understanding{" "}
            <strong className="text-orange-400">{subtopicName}</strong> in the
            context of {topicName}. We'll cover the fundamental concepts,
            practical applications, and key insights you need to master this
            topic.
          </p>
        </div>

        {/* Quick Start */}
        <div className="bg-neutral-800/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Play size={16} className="text-green-400" />
            <h3 className="font-medium text-neutral-200">Quick Start</h3>
          </div>
          <ul className="space-y-2 text-sm text-neutral-400">
            <li className="flex items-start gap-2">
              <div className="w-1 h-1 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
              <span>Understand the core principles of {subtopicName}</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-1 h-1 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
              <span>Learn practical applications and use cases</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-1 h-1 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
              <span>Practice with hands-on examples</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-1 h-1 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
              <span>Test your understanding with exercises</span>
            </li>
          </ul>
        </div>

        {/* Key Concepts */}
        <div className="bg-neutral-800/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <FileText size={16} className="text-blue-400" />
            <h3 className="font-medium text-neutral-200">Key Concepts</h3>
          </div>
          <div className="grid gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-neutral-800 rounded-lg p-3 border border-neutral-700"
              >
                <h4 className="font-medium text-neutral-200 mb-1">
                  Concept {i}
                </h4>
                <p className="text-xs text-neutral-500">
                  Important aspect of {subtopicName} that builds foundational
                  understanding.
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Resources */}
        <div className="bg-neutral-800/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <ExternalLink size={16} className="text-purple-400" />
            <h3 className="font-medium text-neutral-200">
              Additional Resources
            </h3>
          </div>
          <div className="space-y-2">
            {[
              "Documentation",
              "Video Tutorial",
              "Interactive Examples",
              "Practice Problems",
            ].map((resource, i) => (
              <button
                key={i}
                className="w-full text-left text-sm text-neutral-400 hover:text-purple-400 p-2 rounded hover:bg-neutral-800 transition-colors flex items-center gap-2"
              >
                <ExternalLink size={12} />
                {resource} for {subtopicName}
              </button>
            ))}
          </div>
        </div>

        {/* Coming Soon Notice */}
        <div className="bg-gradient-to-r from-orange-500/10 to-purple-500/10 rounded-lg p-4 border border-orange-500/20">
          <div className="text-center">
            <div className="text-orange-400 font-medium mb-1">
              🚀 Coming Soon
            </div>
            <p className="text-xs text-neutral-500">
              Interactive lessons, code examples, and personalized learning
              paths will be integrated here.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================
   Chat Input Component
========================= */
function ChatInput({
  currentMessage,
  setCurrentMessage,
  onSend,
  disabled,
}: {
  currentMessage: string;
  setCurrentMessage: (message: string) => void;
  onSend: () => void;
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
              onSend();
            }
          }}
        />
        <div className="flex items-center justify-end px-2 pb-2">
          <button
            onClick={onSend}
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
        Ask for learning roadmaps and I'll create interactive visualizations for
        you
      </p>
    </div>
  );
}

/* =========================
   Main Page Component
========================= */
export default function Page() {
  const [currentMessage, setCurrentMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: crypto.randomUUID(),
      type: "ai",
      content:
        "Hi! I'm your learning copilot. Ask anything.\nTip: Ask for a roadmap in JSON (TOPIC/SUBTOPIC) and I'll render it as an interactive graph.",
      timestamp: Date.now(),
    },
  ]);
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [selectedLearningTopic, setSelectedLearningTopic] = useState<{
    topicName: string;
    subtopicName: string;
  } | null>(null);

  async function callBackend(q: string): Promise<string> {
    const url = `${API_BASE}/ask?q=${encodeURIComponent(
      q
    )}&_ngrok_skip_browser_warning=true`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "ngrok-skip-browser-warning": "true",
        Accept: "text/plain, application/json;q=0.9",
        "Cache-Control": "no-cache",
      },
      mode: "cors",
    });
    const ct = res.headers.get("content-type") || "";
    const text = await res.text();
    if (ct.includes("text/html") || text.includes("ERR_NGROK_6024")) {
      throw new Error("Ngrok splash intercepted the request.");
    }
    if (!res.ok) throw new Error(`Backend error ${res.status}`);
    return text;
  }

  async function handleSend() {
    const content = currentMessage.trim();
    if (!content) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      type: "user",
      content,
      timestamp: Date.now(),
    };

    setMessages((m) => [...m, userMsg]);
    setCurrentMessage("");
    setIsTyping(true);

    try {
      const reply = await callBackend(content);
      const aiMsg: ChatMessage = {
        id: crypto.randomUUID(),
        type: "ai",
        content: reply,
        timestamp: Date.now(),
      };
      setMessages((m) => [...m, aiMsg]);

      const plan = tryExtractRoadmapFromText(reply);
      setRoadmap(plan ?? null);
    } catch (e: any) {
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          type: "ai",
          content: `Could not reach server: ${e?.message ?? "Unknown error"}`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  }

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
        {/* Chat Section */}
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
            <ChatMessages messages={messages} isTyping={isTyping} />

            {/* Interactive Roadmap */}
            {roadmap && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 px-1">
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium text-neutral-200">
                    Learning Roadmap
                  </span>
                </div>
                <InteractiveRoadmap
                  roadmap={roadmap}
                  onSubtopicClick={handleSubtopicClick}
                />
              </div>
            )}
          </main>

          <ChatInput
            currentMessage={currentMessage}
            setCurrentMessage={setCurrentMessage}
            onSend={handleSend}
            disabled={!currentMessage.trim()}
          />
        </div>

        {/* Learning Content Section */}
        {isLearningMode && selectedLearningTopic && (
          <div className="w-1/2 h-full">
            <LearningContent
              topicName={selectedLearningTopic.topicName}
              subtopicName={selectedLearningTopic.subtopicName}
              onClose={closeLearningContent}
            />
          </div>
        )}
      </div>
    </div>
  );
}
