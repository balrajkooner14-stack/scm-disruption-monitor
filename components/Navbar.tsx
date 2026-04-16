"use client"

import { useEffect, useState } from "react"

export default function Navbar() {
  const [isDark, setIsDark] = useState(false)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const saved = localStorage.getItem("theme")
    if (saved === "dark") {
      document.documentElement.classList.add("dark")
      setIsDark(true)
    }
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const dateStr = now.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })

  function toggleDark() {
    const next = !isDark
    setIsDark(next)
    if (next) {
      document.documentElement.classList.add("dark")
      localStorage.setItem("theme", "dark")
    } else {
      document.documentElement.classList.remove("dark")
      localStorage.setItem("theme", "light")
    }
  }

  return (
    <nav className="sticky top-0 z-50 w-full bg-slate-900 border-b border-slate-700 py-4 px-8 flex flex-row items-center justify-between">
      {/* Left: Logo + title + subtitle */}
      <div className="flex items-center gap-3">
        <span className="text-2xl">📡</span>
        <div className="flex flex-col">
          <div className="flex items-baseline gap-0">
            <span className="text-blue-400 font-black text-xl leading-none">SCM</span>
            <span className="text-white font-light text-xl leading-none"> Disruption Monitor</span>
          </div>
          <span className="text-slate-500 text-xs mt-0.5">Real-time global supply chain intelligence</span>
        </div>
      </div>

      {/* Right: LIVE + separator + date + toggle */}
      <div className="flex flex-row items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
          </span>
          <span className="text-green-400 text-sm font-bold tracking-widest">LIVE</span>
        </div>

        <div className="w-px h-5 bg-slate-600 mx-1" />

        <span className="hidden sm:block text-slate-300 text-sm">{dateStr} · {timeStr}</span>

        <button
          onClick={toggleDark}
          className="text-slate-400 hover:text-white transition text-lg ml-1"
          aria-label="Toggle dark mode"
        >
          {isDark ? "☀️" : "🌙"}
        </button>
      </div>
    </nav>
  )
}
