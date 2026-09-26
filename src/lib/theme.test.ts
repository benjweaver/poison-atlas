import { nextTick } from 'vue'

// theme.ts reads the system setting when it loads, and jsdom has no
// matchMedia, so each test stubs it and imports a fresh copy of the module.
async function load(systemDark: boolean) {
  vi.resetModules()
  vi.stubGlobal('matchMedia', () => ({ matches: systemDark, addEventListener: () => {} }))
  return import('./theme')
}

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('theme', () => {
  it('follows the system until a choice is made', async () => {
    const { theme } = await load(true)
    expect(theme.preference).toBe('system')
    expect(theme.resolved).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('cycles system → light → dark → system and remembers the choice', async () => {
    const { theme, cycleTheme } = await load(true)
    cycleTheme()
    await nextTick()
    expect(theme.resolved).toBe('light')
    expect(localStorage.getItem('theme')).toBe('light')
    cycleTheme()
    await nextTick()
    expect(theme.resolved).toBe('dark')
    cycleTheme()
    await nextTick()
    expect(theme.preference).toBe('system')
    expect(localStorage.getItem('theme')).toBeNull()
  })

  it('starts from a remembered choice', async () => {
    localStorage.setItem('theme', 'light')
    const { theme } = await load(true)
    expect(theme.resolved).toBe('light')
  })

  it('still works when storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const { theme, cycleTheme } = await load(false)
    expect(theme.resolved).toBe('light')
    cycleTheme()
    await nextTick()
    expect(theme.resolved).toBe('light') // system was light, so "light" looks the same
    cycleTheme()
    await nextTick()
    expect(theme.resolved).toBe('dark')
  })
})
