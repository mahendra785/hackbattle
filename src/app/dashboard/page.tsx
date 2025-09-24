"use client";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import {
  Bot,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  Brain,
  Send,
  Circle,
} from "lucide-react";

function Dashboard() {
  const { data: session, status } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentMessage, setCurrentMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [chatSessions, setChatSessions] = useState([
    {
      id: 1,
      title: "Calculus Integration Help",
      lastMessage: "Thanks for explaining derivatives!",
      timestamp: "2 hours ago",
      messageCount: 15,
      isActive: true,
    },
    {
      id: 2,
      title: "Linear Algebra Questions",
      lastMessage: "How do eigenvalues work?",
      timestamp: "1 day ago",
      messageCount: 8,
      isActive: false,
    },
  ]);

  const [messages, setMessages] = useState([
    {
      id: 1,
      type: "ai",
      content:
        "Hello! I'm your adaptive learning AI assistant. I can help you with mathematics, physics, chemistry, and adapt my explanations to your learning style. What would you like to learn about today?",
      timestamp: new Date(Date.now() - 1800000),
      suggestions: [
        "Help with calculus",
        "Explain physics concepts",
        "Chemistry problems",
        "Study planning",
      ],
    },
  ]);

  const messagesEndRef = useRef(null);
  const chatInputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!currentMessage.trim()) return;

    const userMessage = {
      id: messages.length + 1,
      type: "user",
      content: currentMessage,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setCurrentMessage("");
    setIsTyping(true);

    setTimeout(() => {
      const aiResponse = {
        id: messages.length + 2,
        type: "ai",
        content:
          "I understand you're asking about that topic. Let me provide a detailed explanation adapted to your visual learning style with step-by-step breakdowns and examples.",
        timestamp: new Date(),
        suggestions: [
          "More examples",
          "Related concepts",
          "Practice problems",
          "Next topic",
        ],
      };
      setMessages((prev) => [...prev, aiResponse]);
      setIsTyping(false);
    }, 2000);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (status === "loading") {
    return (
      <div className="flex justify-center items-center h-screen bg-black">
        <div className="w-20 h-20 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-black text-white flex font-[Inter]">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? "w-80" : "w-16"
        } bg-neutral-900 border-r border-neutral-800 transition-all duration-300 flex flex-col`}
      >
        {/* Header */}
        <div className="p-6 border-b border-neutral-800">
          <div className="flex items-center justify-between">
            <div
              className={`flex items-center gap-3 ${
                !sidebarOpen && "justify-center"
              }`}
            >
              <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
                <Bot className="text-white" size={20} />
              </div>
              {sidebarOpen && (
                <div>
                  <h1 className="text-xl font-bold text-white">AI Assistant</h1>
                  <p className="text-xs text-gray-400">Adaptive Learning</p>
                </div>
              )}
            </div>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-neutral-800"
            >
              {sidebarOpen ? (
                <ChevronLeft className="text-gray-400" size={18} />
              ) : (
                <ChevronRight className="text-gray-400" size={18} />
              )}
            </button>
          </div>

          {sidebarOpen && (
            <button
              onClick={() => {}}
              className="w-full mt-4 bg-orange-500 text-white px-4 py-3 rounded-xl font-semibold hover:bg-orange-600 transition"
            >
              <div className="flex items-center justify-center gap-2">
                <PlusCircle size={18} />
                New Chat
              </div>
            </button>
          )}
        </div>

        {/* Chat Sessions */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {chatSessions.map((chat) => (
            <button
              key={chat.id}
              className={`w-full p-4 rounded-xl text-left transition ${
                chat.isActive
                  ? "bg-neutral-800 border border-orange-500"
                  : "bg-neutral-900 hover:bg-neutral-800"
              }`}
            >
              <div className="font-medium text-white truncate mb-1">
                {chat.title}
              </div>
              {sidebarOpen && (
                <div className="text-xs text-gray-400 truncate">
                  {chat.lastMessage}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-neutral-900 border-b border-neutral-800 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center">
                <Bot className="text-white" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold">AI Learning Assistant</h2>
                <p className="text-sm text-gray-400">
                  Online • Adaptive • Personalized
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-neutral-800 px-4 py-2 rounded-full">
              <Brain className="text-orange-500" size={16} />
              <span className="text-sm">Adaptation: 85%</span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.type === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`flex gap-4 max-w-3xl ${
                  message.type === "user" ? "flex-row-reverse" : ""
                }`}
              >
                {/* Avatar */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    message.type === "user" ? "bg-orange-500" : "bg-neutral-800"
                  }`}
                >
                  {message.type === "user" ? (
                    <Image
                      src={session?.user?.image ?? "/default-avatar.png"}
                      width={32}
                      height={32}
                      alt="User"
                      className="rounded-full"
                    />
                  ) : (
                    <Bot className="text-orange-500" size={18} />
                  )}
                </div>

                {/* Message */}
                <div
                  className={`px-6 py-4 rounded-2xl shadow ${
                    message.type === "user"
                      ? "bg-orange-500 text-white"
                      : "bg-neutral-800 text-white"
                  }`}
                >
                  {message.content}
                </div>
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex items-center gap-2 text-gray-400">
              <Circle className="animate-pulse" size={10} />
              <span>AI is typing...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="bg-neutral-900 border-t border-neutral-800 p-6">
          <div className="flex gap-4 items-end max-w-3xl mx-auto">
            <textarea
              ref={chatInputRef}
              value={currentMessage}
              onChange={(e) => setCurrentMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me anything..."
              className="flex-1 px-6 py-4 rounded-2xl border border-neutral-700 bg-black text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
              rows={1}
            />
            <button
              onClick={handleSendMessage}
              disabled={!currentMessage.trim()}
              className={`w-14 h-14 rounded-2xl flex items-center justify-center transition ${
                currentMessage.trim()
                  ? "bg-orange-500 text-white hover:bg-orange-600"
                  : "bg-neutral-800 text-gray-500 cursor-not-allowed"
              }`}
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
