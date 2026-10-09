import { Suspense } from "react"
import Link from "next/link"
import Logo from "@/components/ui/Logo"
import AuthPanel from "@/components/auth/AuthPanel"
import LiveEventsPanel from "@/components/auth/LiveEventsPanel"
import type { DisruptionEvent } from "@/lib/types"
import { ui } from "@/lib/ui"

// Screen 1 layout shared by /signup and /login (spec 5.3): form column on the
// left, today's live events on the right.

const COPY = {
  signup: {
    headline: (
      <>
        See what today&apos;s news means for <em className="italic text-ember">your</em> suppliers.
      </>
    ),
    sub: "Free to try. Set-up takes about 4 minutes, and you'll see your first exposure before you finish.",
  },
  login: {
    headline: <>Welcome back.</>,
    sub: "Sign in to see what's touching your supply chain today.",
  },
} as const

export default function AuthScreen({
  mode,
  events,
}: {
  mode: "signup" | "login"
  events: DisruptionEvent[]
}) {
  const copy = COPY[mode]
  return (
    <main className="flex min-h-screen bg-paper text-ink">
      <section className="flex w-full shrink-0 flex-col justify-between gap-10 px-6 py-12 sm:px-[72px] lg:w-[600px]">
        <Link href="/" aria-label="Home" className="self-start">
          <Logo />
        </Link>

        <div className="flex flex-col gap-7">
          <div className="flex flex-col gap-3">
            <h1 className="font-serif text-[46px] font-normal leading-[1.08]">{copy.headline}</h1>
            <p className="text-[17px] leading-relaxed text-ink-2">{copy.sub}</p>
          </div>
          {/* AuthPanel reads ?email= and ?next= via useSearchParams, which needs
              a Suspense boundary on a statically rendered page. */}
          <Suspense fallback={<AuthPanelSkeleton />}>
            <AuthPanel mode={mode} />
          </Suspense>
        </div>

        <p className="text-xs text-ink-3">Your supplier data stays private to your account.</p>
      </section>

      <LiveEventsPanel events={events} />
    </main>
  )
}

function AuthPanelSkeleton() {
  return (
    <div className="flex flex-col gap-2.5" aria-label="Loading sign-in options">
      <div className={`${ui.skeleton} h-12 rounded-lg`} />
      <div className={`${ui.skeleton} h-12 rounded-lg`} />
      <div className={`${ui.skeleton} h-12 rounded-lg`} />
    </div>
  )
}
