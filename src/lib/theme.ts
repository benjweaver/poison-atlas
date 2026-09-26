// Light, dark, or whatever the system says. The choice is remembered per
// browser, and the resolved theme is written to <html data-theme>, which
// style.css keys the dark palette off. index.html runs the same logic inline
// before first paint, so a dark-mode visitor never sees a flash of light.
import { reactive, watch } from 'vue'

export type ThemePreference = 'system' | 'light' | 'dark'
export type Theme = 'light' | 'dark'

const KEY = 'theme'
const system = matchMedia('(prefers-color-scheme: dark)')

function stored(): ThemePreference {
  try {
    const value = localStorage.getItem(KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system' // storage blocked (private mode, site data off)
  }
}

export const theme = reactive({
  preference: stored(),
  /** What's showing now: the preference, or the system theme when it's "system". */
  resolved: 'light' as Theme,
})

function resolve(): Theme {
  if (theme.preference !== 'system') return theme.preference
  return system.matches ? 'dark' : 'light'
}

function apply() {
  theme.resolved = resolve()
  const root = document.documentElement
  root.dataset.theme = theme.resolved
  // The browser's toolbar and the installed app's title bar follow the page.
  const bar = getComputedStyle(root).getPropertyValue('--surface').trim()
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    meta.content = bar
  }
}

apply()
system.addEventListener('change', apply)
watch(
  () => theme.preference,
  (preference) => {
    try {
      if (preference === 'system') localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, preference)
    } catch {
      // Not remembered, but still applied for this visit.
    }
    apply()
  },
)

const ORDER: ThemePreference[] = ['system', 'light', 'dark']
export function cycleTheme() {
  theme.preference = ORDER[(ORDER.indexOf(theme.preference) + 1) % ORDER.length]!
}
