"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import type { AuthError } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase"
import { AUTH, SETUP_CALL_URL } from "@/lib/authProviders"
import { postAuthPath, safeNextPath } from "@/lib/authRouting"
import { BRAND } from "@/lib/brand"
import { ui } from "@/lib/ui"

// Shared by /signup and /login (spec 5.2): provider buttons, the 6-digit email
// code flow, and (login only) the password fallback with reset.

type Mode = "signup" | "login"
type Provider = "google" | "azure"
type Step = "email" | "code"

const CODE_LENGTH = 6
const RESEND_AFTER_S = 30
const RATE_LIMIT_COPY = "Too many attempts. Wait a minute and try again."
const BAD_CODE_COPY = "That code didn't work. Check it or send a new one."

const providerButton =
  "flex h-12 w-full items-center justify-center gap-2.5 rounded-lg border border-line-strong bg-surface text-[15px] font-semibold text-ink transition-colors hover:border-ink disabled:opacity-50"

function isRateLimited(err: AuthError): boolean {
  return (
    err.status === 429 ||
    err.code === "over_email_send_rate_limit" ||
    err.code === "over_request_rate_limit"
  )
}

// shouldCreateUser: false on an unknown email comes back as "Signups not
// allowed for otp" (code otp_disabled).
function isUnknownUser(err: AuthError): boolean {
  return err.code === "otp_disabled" || /signups not allowed/i.test(err.message)
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z" fill="#4285F4" />
      <path d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" fill="#34A853" />
      <path d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2L6.4 14z" fill="#FBBC05" />
      <path d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10c.8-2.3 3-4.1 5.6-4.1z" fill="#EA4335" />
    </svg>
  )
}

function MicrosoftMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="1" y="1" width="10.5" height="10.5" fill="#F25022" />
      <rect x="12.5" y="1" width="10.5" height="10.5" fill="#7FBA00" />
      <rect x="1" y="12.5" width="10.5" height="10.5" fill="#00A4EF" />
      <rect x="12.5" y="12.5" width="10.5" height="10.5" fill="#FFB900" />
    </svg>
  )
}

const linkClass = "text-ember transition-colors hover:text-ember-deep"

export default function AuthPanel({ mode, next: nextProp }: { mode: Mode; next?: string }) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = safeNextPath(nextProp ?? searchParams.get("next"))

  const [email, setEmail] = useState(() => searchParams.get("email") ?? "")
  const [step, setStep] = useState<Step>("email")
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [unknownEmail, setUnknownEmail] = useState(false)
  const [busy, setBusy] = useState(false)
  const [redirecting, setRedirecting] = useState<Provider | null>(null)
  const [resendIn, setResendIn] = useState(0)

  // Login-only password fallback
  const [showPassword, setShowPassword] = useState(false)
  const [password, setPassword] = useState("")
  const [resetSent, setResetSent] = useState(false)

  const verifyingRef = useRef(false)

  useEffect(() => {
    if (resendIn <= 0) return
    const t = setTimeout(() => setResendIn(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resendIn])

  const routeAfterAuth = async (userId: string) => {
    const destination = next ?? (await postAuthPath(supabase, userId))
    router.replace(destination)
    router.refresh()
  }

  const clearMessages = () => {
    setError(null)
    setUnknownEmail(false)
    setResetSent(false)
  }

  const handleProvider = async (provider: Provider) => {
    clearMessages()
    setRedirecting(provider)
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next ?? "")}`,
        ...(provider === "azure" ? { scopes: "email" } : {}),
      },
    })
    // On success the browser is already navigating away; only errors return.
    if (oauthError) {
      setError(isRateLimited(oauthError) ? RATE_LIMIT_COPY : oauthError.message)
      setRedirecting(null)
    }
  }

  const sendCode = async () => {
    clearMessages()
    setBusy(true)
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: mode === "signup" },
    })
    setBusy(false)
    if (otpError) {
      if (mode === "login" && isUnknownUser(otpError)) setUnknownEmail(true)
      else setError(isRateLimited(otpError) ? RATE_LIMIT_COPY : otpError.message)
      return
    }
    setCode("")
    setStep("code")
    setResendIn(RESEND_AFTER_S)
  }

  const verifyCode = async (token: string) => {
    if (verifyingRef.current) return
    verifyingRef.current = true
    clearMessages()
    setBusy(true)
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token,
      type: "email",
    })
    if (verifyError || !data.user) {
      setError(verifyError && isRateLimited(verifyError) ? RATE_LIMIT_COPY : BAD_CODE_COPY)
      setBusy(false)
      verifyingRef.current = false
      return
    }
    await routeAfterAuth(data.user.id)
  }

  const handleCodeChange = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, CODE_LENGTH)
    setCode(digits)
    if (digits.length === CODE_LENGTH) void verifyCode(digits)
  }

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    clearMessages()
    setBusy(true)
    const { data, error: pwError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (pwError || !data.user) {
      setError(pwError ? (isRateLimited(pwError) ? RATE_LIMIT_COPY : pwError.message) : "Sign-in failed.")
      setBusy(false)
      return
    }
    await routeAfterAuth(data.user.id)
  }

  const handleForgotPassword = async () => {
    clearMessages()
    if (!email.trim()) {
      setError("Enter your email above first.")
      return
    }
    setBusy(true)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${location.origin}/auth/callback?next=/reset-password`,
    })
    setBusy(false)
    if (resetError) {
      setError(isRateLimited(resetError) ? RATE_LIMIT_COPY : resetError.message)
      return
    }
    setResetSent(true)
  }

  const anyProvider = AUTH.google || AUTH.microsoft
  const providerBusy = redirecting !== null

  return (
    <div className="flex flex-col gap-2.5">
      {AUTH.google && (
        <button
          type="button"
          onClick={() => handleProvider("google")}
          disabled={providerBusy}
          className={providerButton}
        >
          <GoogleMark />
          {redirecting === "google" ? "Opening Google…" : "Continue with Google"}
        </button>
      )}
      {AUTH.microsoft && (
        <button
          type="button"
          onClick={() => handleProvider("azure")}
          disabled={providerBusy}
          className={providerButton}
        >
          <MicrosoftMark />
          {redirecting === "azure" ? "Opening Microsoft…" : "Continue with Microsoft"}
        </button>
      )}

      {anyProvider && (
        <div className="flex items-center gap-3 py-1.5 text-[13px] text-ink-3">
          <span className="h-px flex-1 bg-line" aria-hidden="true" />
          or with your work email
          <span className="h-px flex-1 bg-line" aria-hidden="true" />
        </div>
      )}

      {error && <p className={ui.errorBox} role="alert">{error}</p>}
      {unknownEmail && (
        <p className={ui.errorBox} role="alert">
          We don&apos;t have an account for that email.{" "}
          <Link href={`/signup?email=${encodeURIComponent(email.trim())}`} className="font-semibold underline">
            Create one?
          </Link>
        </p>
      )}
      {resetSent && (
        <p className="rounded-lg bg-moss-tint px-4 py-3 text-sm text-moss-deep" role="status">
          Check your email for a reset link.
        </p>
      )}

      {step === "email" ? (
        <form
          onSubmit={e => {
            e.preventDefault()
            if (showPassword) return
            void sendCode()
          }}
          className="flex flex-col gap-2.5"
        >
          <label htmlFor="auth-email" className={`flex flex-col gap-1.5 ${ui.label}`}>
            Work email
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@company.com"
              className={`${ui.input} h-[46px]`}
            />
          </label>
          {!showPassword && (
            <button
              type="submit"
              disabled={busy || !email.trim()}
              className={`${ui.btnPrimary} h-12 text-[15px] disabled:cursor-not-allowed`}
            >
              {busy ? "Sending…" : "Email me a 6-digit code"}
            </button>
          )}
        </form>
      ) : (
        <div className="flex flex-col gap-2.5">
          <label htmlFor="auth-code" className={`flex flex-col gap-1.5 ${ui.label}`}>
            Enter the code we sent to {email.trim()}
            <input
              id="auth-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={CODE_LENGTH}
              value={code}
              onChange={e => handleCodeChange(e.target.value)}
              disabled={busy}
              autoFocus
              className={`${ui.input} h-14 text-center text-2xl tracking-[0.5em]`}
            />
          </label>
          <p className={ui.meta} aria-live="polite">
            {busy ? "Checking…" : `The code expires in an hour.`}
          </p>
          <div className="flex items-center justify-between text-[13px]">
            <button
              type="button"
              onClick={() => {
                clearMessages()
                setStep("email")
                setCode("")
              }}
              className={ui.btnGhost}
            >
              Use a different email
            </button>
            <button
              type="button"
              onClick={() => void sendCode()}
              disabled={resendIn > 0 || busy}
              className={`${ui.btnGhost} disabled:text-ink-3 disabled:hover:text-ink-3`}
            >
              {resendIn > 0 ? `Resend code in ${resendIn} s` : "Resend code"}
            </button>
          </div>
        </div>
      )}

      {mode === "login" && step === "email" && (
        showPassword ? (
          <form onSubmit={handlePasswordSignIn} className="flex flex-col gap-2.5">
            <label htmlFor="auth-password" className={`flex flex-col gap-1.5 ${ui.label}`}>
              Password
              <input
                id="auth-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className={`${ui.input} h-[46px]`}
              />
            </label>
            <button
              type="submit"
              disabled={busy || !email.trim() || !password}
              className={`${ui.btnPrimary} h-12 text-[15px] disabled:cursor-not-allowed`}
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <div className="flex items-center justify-between">
              <button type="button" onClick={handleForgotPassword} disabled={busy} className={ui.btnGhost}>
                Forgot password?
              </button>
              <button
                type="button"
                onClick={() => {
                  clearMessages()
                  setShowPassword(false)
                }}
                className={ui.btnGhost}
              >
                Use an email code instead
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => {
              clearMessages()
              setShowPassword(true)
            }}
            className={`${ui.btnGhost} self-start`}
          >
            Sign in with a password instead
          </button>
        )
      )}

      <div className="mt-2 text-[13px] leading-relaxed text-ink-3">
        {mode === "signup" ? (
          <p>
            Already have an account?{" "}
            <Link href="/login" className={linkClass}>Sign in</Link>
          </p>
        ) : (
          <p>
            New to {BRAND.name}?{" "}
            <Link href="/signup" className={linkClass}>Create an account</Link>
          </p>
        )}
        {SETUP_CALL_URL && (
          <p>
            Prefer a walkthrough?{" "}
            <a href={SETUP_CALL_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
              Book a 15-minute setup call
            </a>{" "}
            and we&apos;ll set it up with you.
          </p>
        )}
        <p>
          <Link href="/onboarding" className={linkClass}>Try it without an account</Link>
        </p>
      </div>
    </div>
  )
}
