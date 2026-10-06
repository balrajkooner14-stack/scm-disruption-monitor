"use client"

import { useState, useRef, useEffect } from "react"
import { useCompanyProfile } from "@/hooks/useCompanyProfile"
import type { ScoredEvent } from "@/lib/scoreEvents"
import { ui } from "@/lib/ui"

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

  // Collapsed — floating launcher
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={`${ui.btnPrimary} fixed bottom-6 right-6 z-40 rounded-full px-4 py-2.5 shadow-lg`}
      >
        Ask the analyst
      </button>
    )
  }

  // Expanded chat panel
  return (
    <div
      role="dialog"
      aria-label="Ask the analyst"
      className="fixed bottom-6 right-6 z-40 w-[420px] max-w-[calc(100vw-3rem)]
                 bg-paper-raised border border-line rounded-xl shadow-lg flex flex-col"
      style={{ height: "520px" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-line-soft flex-shrink-0">
        <div className="min-w-0">
          <h2 className={ui.h3}>Ask the analyst</h2>
          <p className="text-xs text-ink-3 truncate">
            {profile
              ? `Personalized for ${profile.companyName}`
              : "Set up a profile for personalized answers"}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {messages.length > 0 && (
            <button onClick={clearChat} className={ui.btnGhost}>
              Clear
            </button>
          )}
          <button
            onClick={() => setIsOpen(false)}
            aria-label="Close chat"
            className="rounded-lg p-2 text-ink-3 transition-colors hover:text-ink"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M6 6 L18 18 M18 6 L6 18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.length === 0 ? (
          <div>
            <p className={`${ui.meta} text-center mb-4`}>
              Ask anything about your supply chain
            </p>
            <div className="space-y-2">
              {starterQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(q)}
                  className="w-full text-left text-sm text-ink-2 bg-surface border border-line-soft
                             hover:border-ink rounded-lg px-3 py-2 transition-colors"
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
                className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm leading-relaxed
                  ${msg.role === "user"
                    ? "bg-ink text-paper"
                    : "bg-surface border border-line-soft text-ink"
                  }`}
              >
                {msg.content}
                {msg.isStreaming && (
                  <span className="inline-block w-1.5 h-3.5 bg-ink-3 ml-0.5 rounded-sm align-middle" aria-hidden="true" />
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-line-soft p-3 flex-shrink-0">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={
              isStreaming
                ? "The analyst is responding…"
                : "Ask about your supply chain…"
            }
            aria-label="Message"
            disabled={isStreaming}
            className={`${ui.input} flex-1 disabled:opacity-50`}
          />
          <button
            type="submit"
            disabled={!input.trim() || isStreaming}
            className={`${ui.btnPrimary} disabled:cursor-not-allowed`}
          >
            Send
          </button>
        </form>
        <p className={`${ui.help} mt-1.5 text-center`}>
          Google Gemini 2.5 Flash · {events.length} live events as context · press / to open
        </p>
      </div>
    </div>
  )
}
