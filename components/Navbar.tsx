"use client"

import { useEffect, useState } from "react"

export default function Navbar() {
  const [isDark, setIsDark] = useState(false)
  const dateString = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })

  useEffect(() => {
    const saved = localStorage.getItem("theme")
    if (saved === "dark") {
      document.documentElement.classList.add("dark")
      setIsDark(true)
    }
  }, [])

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
    <nav className="sticky top-0 z-50 w-full bg-slate-900 py-3 px-6 flex flex-row items-center justify-between">
      <span className="text-white font-bold text-lg">
        📡 SCM Disruption Monitor
      </span>

      <div className="flex flex-row gap-4 items-center">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
        </span>
        <span className="text-green-400 text-xs font-bold tracking-widest">LIVE</span>
        <span className="hidden sm:block text-slate-400 text-sm">{dateString}</span>
        <button
          onClick={toggleDark}
          className="text-slate-400 hover:text-white transition text-lg"
          aria-label="Toggle dark mode"
        >
          {isDark ? "☀️" : "🌙"}
        </button>
      </div>
    </nav>
  )
}
