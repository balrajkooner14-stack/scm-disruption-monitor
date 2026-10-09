// Sample-company (demo) mode (spec 4.7). A sessionStorage flag, so it ends
// with the tab and never touches the user's saved data. Every accessor is
// wrapped: private windows and blocked storage just mean "not in demo".

export const DEMO_STORAGE_KEY = "foreglow_demo"

export function isDemoMode(): boolean {
  try {
    return typeof window !== "undefined" && window.sessionStorage.getItem(DEMO_STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

export function enterDemoMode(): void {
  try {
    window.sessionStorage.setItem(DEMO_STORAGE_KEY, "1")
  } catch {}
}

export function exitDemoMode(): void {
  try {
    window.sessionStorage.removeItem(DEMO_STORAGE_KEY)
  } catch {}
}
