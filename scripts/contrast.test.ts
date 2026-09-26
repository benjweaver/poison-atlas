// Every colour used for text is readable: at least 4.5:1 (WCAG AA) against
// each background it can sit on, in both themes. The colours are the tokens in
// src/style.css, and the components are scanned for the tokens they colour text
// with, so a new text colour can't skip the check.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const css = readFileSync(join(ROOT, 'src', 'style.css'), 'utf8')

/** The custom properties declared in the block that starts with `selector`. */
function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`)
  if (start < 0) throw new Error(`style.css has no "${selector}" block`)
  const body = css.slice(start, css.indexOf('}', start))
  return Object.fromEntries(
    [...body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})\s*;/g)].map((m) => [m[1], m[2]]),
  )
}

const THEMES = {
  light: block(':root'),
  dark: { ...block(':root'), ...block(":root[data-theme='dark']") },
}

// WCAG 2 relative luminance and contrast ratio.
function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// Text sits on the page, panels and chips...
const SURFACES = ['bg', 'surface', 'surface-2']
// ...in these colours.
const TEXT = [
  'ink',
  'muted',
  'accent',
  'introduced-ink',
  'map-records',
  ...[1, 2, 3, 4, 5].map((n) => `danger-${n}-ink`),
]
// Text on a coloured fill: [text, background].
const PAIRS: [string, string][] = [
  ['on-accent', 'accent'], // a selected filter
  ['surface', 'ink'], // tooltips
]

describe('text contrast', () => {
  for (const [theme, colours] of Object.entries(THEMES)) {
    const colour = (token: string) => {
      const hex = colours[token]
      if (!hex) throw new Error(`--${token} is not defined for the ${theme} theme`)
      return hex
    }
    for (const text of TEXT) {
      it(`${theme}: --${text} is readable on every surface`, () => {
        for (const surface of SURFACES) {
          expect(
            contrast(colour(text), colour(surface)),
            `--${text} on --${surface}`,
          ).toBeGreaterThanOrEqual(4.5)
        }
      })
    }
    for (const [text, background] of PAIRS) {
      it(`${theme}: --${text} is readable on --${background}`, () => {
        expect(contrast(colour(text), colour(background))).toBeGreaterThanOrEqual(4.5)
      })
    }
  }
})

describe('components', () => {
  function vueFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory()
        ? vueFiles(join(dir, e.name))
        : e.name.endsWith('.vue')
          ? [join(dir, e.name)]
          : [],
    )
  }

  it('only colour text with checked tokens', () => {
    const allowed = new Set([...TEXT, ...PAIRS.map(([text]) => text)])
    const used = new Set<string>()
    for (const file of vueFiles(join(ROOT, 'src'))) {
      const source = readFileSync(file, 'utf8')
      // Tailwind classes (text-(--muted), placeholder:text-(--muted)) and
      // style bindings (color: 'var(--accent)'). A token built from a number,
      // like `--danger-${level}-ink`, stands for each level.
      for (const m of source.matchAll(/text-\(--([a-z0-9-]+)\)/g)) used.add(m[1])
      for (const m of source.matchAll(
        /color:\s*[`'"]?var\(--([a-z0-9-]+(?:\$\{[^}]+\}[a-z0-9-]*)?)\)/g,
      )) {
        const token = m[1]
        if (token.includes('${')) {
          for (const n of [1, 2, 3, 4, 5]) used.add(token.replace(/\$\{[^}]+\}/, String(n)))
        } else used.add(token)
      }
    }
    expect([...used].filter((token) => !allowed.has(token)).sort()).toEqual([])
  })
})
