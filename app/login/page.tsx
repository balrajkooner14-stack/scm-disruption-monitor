"use client"
export const dynamic = "force-dynamic"
import { useState } from "react"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Logo from "@/components/ui/Logo"
import { BRAND } from "@/lib/brand"
import { ui } from "@/lib/ui"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setIsLoading(false)
    } else {
      router.push("/")
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[400px] bg-paper-raised border border-line rounded-xl p-8 space-y-6">
        <div className="space-y-4">
          <Link href="/" aria-label="Home" className="inline-block">
            <Logo />
          </Link>
          <div className="space-y-1">
            <h1 className={ui.h2}>Sign in</h1>
            <p className={ui.meta}>{BRAND.descriptor}</p>
          </div>
        </div>

        {error && <p className={ui.errorBox}>{error}</p>}

        <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="login-email" className={`block ${ui.label}`}>Email</label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@company.com"
                className={ui.input}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="login-password" className={`block ${ui.label}`}>Password</label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className={ui.input}
              />
            </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`${ui.btnPrimary} w-full py-3 disabled:cursor-not-allowed`}
          >
            {isLoading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="text-sm text-ink-2">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-ember transition-colors hover:text-ember-deep">
            Sign up
          </Link>
        </p>

        <p className="text-xs text-ink-3">
          Your data is stored securely in Supabase and syncs across all your devices
        </p>
      </div>
    </div>
  )
}
