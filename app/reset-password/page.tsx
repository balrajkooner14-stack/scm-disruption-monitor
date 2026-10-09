"use client"
import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import Logo from "@/components/ui/Logo"
import { createClient } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import { ui } from "@/lib/ui"

const MIN_LENGTH = 8

// Reached via /auth/callback?next=/reset-password after a recovery email: the
// callback has already exchanged the recovery code, so a session exists here.
export default function ResetPasswordPage() {
  const { user, isLoading } = useAuth()
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < MIN_LENGTH) {
      setError(`Use at least ${MIN_LENGTH} characters.`)
      return
    }
    if (password !== confirm) {
      setError("The two passwords don't match.")
      return
    }
    setIsSaving(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message)
      setIsSaving(false)
      return
    }
    router.push("/")
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[400px] bg-paper-raised border border-line rounded-xl p-8 space-y-6">
        <Link href="/" aria-label="Home" className="inline-block">
          <Logo />
        </Link>

        {isLoading ? (
          <div className="space-y-3" aria-label="Loading">
            <div className={`${ui.skeleton} h-7 w-2/3`} />
            <div className={`${ui.skeleton} h-11 w-full`} />
            <div className={`${ui.skeleton} h-11 w-full`} />
          </div>
        ) : !user ? (
          <div className="space-y-4">
            <h1 className={ui.h2}>This reset link has expired</h1>
            <p className={ui.body}>
              Reset links work once, in the browser you requested them from. Ask for a new one
              from the sign-in page.
            </p>
            <Link href="/login" className={`${ui.btnPrimary} w-full py-3`}>
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-1">
              <h1 className={ui.h2}>Set a new password</h1>
              <p className={ui.meta}>For {user.email}</p>
            </div>

            {error && <p className={ui.errorBox}>{error}</p>}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="new-password" className={`block ${ui.label}`}>New password</label>
                <input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={MIN_LENGTH}
                  autoComplete="new-password"
                  autoFocus
                  className={ui.input}
                />
                <p className={ui.help}>At least {MIN_LENGTH} characters.</p>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="confirm-password" className={`block ${ui.label}`}>Confirm new password</label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                  className={ui.input}
                />
              </div>
              <button
                type="submit"
                disabled={isSaving}
                className={`${ui.btnPrimary} w-full py-3 disabled:cursor-not-allowed`}
              >
                {isSaving ? "Saving…" : "Save password"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
