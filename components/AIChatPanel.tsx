"use client"

import { useState, useRef, useEffect } from "react"
import { useCompanyProfile } from "@/hooks/useCompanyProfile"
import type { ScoredEvent } from "@/lib/scoreEvents"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  isStreaming?: boolean
}

interface AIChatPanelProps {
  events: ScoredEvent[]
}

const STARTER_QUESTIONS_WITH_PROFILE = [
  "Which disruptions should I act on today?",
  "How does the current situation affect my inventory?",
  "What's my biggest supply chain risk right now?",
  "Should I contact any of my suppliers today?",
  "Which of my trade lanes are most at risk?",
]

const STARTER_QUESTIONS_NO_PROFILE = [
  "What are the most critical disruptions today?",
  "Which regions are most affected right now?",
  "What should a supply chain manager prioritize today?",
  "Are there any port closures I should know about?",
  "What's the tariff situation looking like?",
]

export default function AIChatPanel({ events }: AIChatPanelProps) {
  const { profile } = useCompanyProfile()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const starterQuestions = profile
    ? STARTER_QUESTIONS_WITH_PROFILE
    : STARTER_QUESTIONS_NO_PROFILE

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Keyboard shortcut: "/" to open, Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isTyping =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable

      if (e.key === "/" && !isTyping) {
        e.preventDefault()
        setIsOpen(true)
        setTimeout(() => inputRef.current?.focus(), 150)
      }

      if (e.key === "Escape" && isOpen) {
        setIsOpen(false)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isOpen])

  const sendMessage = async (text: string) => {
    if (!text.trim() || isStreaming) return

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      role: "user",
      content: text.trim(),
    }

    const assistantId = `assistant_${Date.now()}`
    const assistantMessage: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      isStreaming: true,
    }

    const updatedMessages = [...messages, userMessage]
    setMessages([...updatedMessages, assistantMessage])
    setInput("")
    setIsStreaming(true)

    abortRef.current = new AbortController()

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages,
          profile,
          events,
        }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) throw new Error("Chat request failed")
      if (!res.body) throw new Error("No response body")

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        accumulated += chunk

        setMessages(prev =>
          prev.map(m =>
            m.id === assistantId
              ? { ...m, content: accumulated, isStreaming: true }
              : m
          )
        )
      }

      // Mark streaming complete
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId ? { ...m, isStreaming: false } : m
        )
      )
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? {
                ...m,
                content:
                  "Sorry, I couldn't process that request. Please try again.",
                isStreaming: false,
              }
            : m
        )
      )
    } finally {
      setIsStreaming(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const clearChat = () => {
    if (isStreaming) abortRef.current?.abort()
    setMessages([])
    setIsStreaming(false)
  }

  // Collapsed — floating button
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2
                   bg-blue-600 hover:bg-blue-500 text-white font-medium
                   px-4 py-3 rounded-full shadow-lg shadow-blue-900/40
                   transition-all duration-200 hover:scale-105"
      >
        <span className="text-lg">💬</span>
        <span className="text-sm">Ask AI Analyst</span>
        {profile && (
          <span className="text-xs bg-blue-500 px-1.5 py-0.5 rounded-full">
            {profile.companyName}
          </span>
        )}
      </button>
    )
  }

  // Expanded chat panel
  return (
    <div
      className="fixed bottom-6 right-6 z-40 w-[420px] max-w-[calc(100vw-3rem)]
                 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl
                 shadow-black/50 flex flex-col"
      style={{ height: "520px" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3
                      border-b border-slate-700 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-base">🤖</span>
          <div>
            <p className="text-sm font-semibold text-white">
              AI Supply Chain Analyst
            </p>
            <p className="text-xs text-slate-500">
              {profile
                ? `Personalized for ${profile.companyName}`
                : "Set up a profile for personalized answers"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="text-xs text-slate-500 hover:text-slate-300
                         transition-colors px-2 py-1"
            >
              Clear
            </button>
          )}
          <button
            onClick={() => setIsOpen(false)}
            className="text-slate-400 hover:text-white text-lg
                       leading-none transition-colors px-1"
          >
            ×
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.length === 0 ? (
          <div>
            <p className="text-slate-500 text-xs text-center mb-4">
              Ask me anything about your supply chain
            </p>
            <div className="space-y-2">
              {starterQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(q)}
                  className="w-full text-left text-sm text-slate-300
                             bg-slate-800 hover:bg-slate-700 border
                             border-slate-700 hover:border-slate-500
                             rounded-lg px-3 py-2 transition-all duration-150"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map(msg => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed
                  ${msg.role === "user"
                    ? "bg-blue-600 text-white rounded-br-md"
                    : "bg-slate-800 text-slate-200 rounded-bl-md border border-slate-700"
                  }`}
              >
                {msg.content}
                {msg.isStreaming && (
                  <span className="inline-block w-1.5 h-3.5 bg-blue-400
                                   ml-0.5 animate-pulse rounded-sm align-middle" />
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-slate-700 p-3 flex-shrink-0">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={
              isStreaming
                ? "AI is responding..."
                : "Ask about your supply chain..."
            }
            disabled={isStreaming}
            className="flex-1 bg-slate-800 border border-slate-600 rounded-xl
                       px-3 py-2 text-sm text-slate-200 placeholder-slate-500
                       focus:outline-none focus:border-blue-500
                       disabled:opacity-50 transition-colors"
          />
          <button
            type="submit"
            disabled={!input.trim() || isStreaming}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40
                       disabled:cursor-not-allowed text-white px-3 py-2
                       rounded-xl transition-colors text-sm font-medium
                       flex items-center gap-1"
          >
            {isStreaming ? (
              <span className="animate-spin text-xs inline-block">↻</span>
            ) : (
              "↑"
            )}
          </button>
        </form>
        <p className="text-xs text-slate-600 mt-1.5 text-center">
          Powered by Gemini 2.5 Flash · {events.length} live events as context
        </p>
      </div>
    </div>
  )
}
