import Link from "next/link"
import Logo from "@/components/ui/Logo"
import { ui } from "@/lib/ui"

export const metadata = { title: "Sign-in link didn't work" }

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[400px] bg-paper-raised border border-line rounded-xl p-8 space-y-6">
        <Link href="/" aria-label="Home" className="inline-block">
          <Logo />
        </Link>
        <div className="space-y-2">
          <h1 className={ui.h2}>That sign-in link didn&apos;t work</h1>
          <p className={ui.body}>
            It may have expired or already been used. Corporate email scanners sometimes open
            links before you do.
          </p>
        </div>
        <Link href="/login" className={`${ui.btnPrimary} w-full py-3`}>
          Try again
        </Link>
      </div>
    </div>
  )
}
