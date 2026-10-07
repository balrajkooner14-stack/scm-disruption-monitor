"use client"
export const dynamic = "force-dynamic"
import { useState } from "react"
import { createClient } from "@/lib/supabase"
import Link from "next/link"
import Logo from "@/components/ui/Logo"
import { BRAND } from "@/lib/brand"
import { ui } from "@/lib/ui"

export default function SignupPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const supabase = createClient()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.")
      return
    }

    setIsLoading(true)

    const { error } = await supabase.auth.signUp({ email, password })

    if (error) {
      setError(error.message)
      setIsLoading(false)
    } else {
      setSuccess(true)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[400px] bg-paper-raised border border-line rounded-xl p-8 space-y-6">
        <div className="space-y-4">
          <Link href="/" aria-label="Home" className="inline-block">
            <Logo />
          </Link>
          <div className="space-y-1">
            <h1 className={ui.h2}>Check your email</h1>
            <p className={ui.meta}>{BRAND.descriptor}</p>
          </div>
        </div>

        <p className="rounded-lg bg-moss-tint px-4 py-3 text-sm text-moss-deep">
          ✓ Check your email to confirm your account, then sign in.
        </p>
        <Link href="/login" className={`${ui.btnPrimary} w-full py-3`}>
          Go to sign in
        </Link>
      </div>
    </div>
    )
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[400px] bg-paper-raised border border-line rounded-xl p-8 space-y-6">
        <div className="space-y-4">
          <Link href="/" aria-label="Home" className="inline-block">
            <Logo />
          </Link>
          <div className="space-y-1">
            <h1 className={ui.h2}>Create your account</h1>
            <p className={ui.meta}>{BRAND.descriptor}</p>
          </div>
        </div>

        {error && <p className={ui.errorBox}>{error}</p>}

        <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="signup-email" className={`block ${ui.label}`}>Email</label>
              <input
                id="signup-email"
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
              <label htmlFor="signup-password" className={`block ${ui.label}`}>Password</label>
              <input
                id="signup-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="••••••••"
                className={ui.input}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="signup-confirm" className={`block ${ui.label}`}>Confirm password</label>
              <input
                id="signup-confirm"
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="••••••••"
                className={ui.input}
              />
            </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`${ui.btnPrimary} w-full py-3 disabled:cursor-not-allowed`}
          >
            {isLoading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="text-sm text-ink-2">
          Already have an account?{" "}
          <Link href="/login" className="text-ember transition-colors hover:text-ember-deep">
            Sign in
          </Link>
        </p>

        <p className="text-xs text-ink-3">
          Your data is stored securely in Supabase and syncs across all your devices
        </p>
      </div>
    </div>
  )
}
