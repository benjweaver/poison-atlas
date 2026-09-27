// "Harmful if eaten, touched, or breathed in": how a species harms, in words,
// for the species list.
import type { Route } from '@/data/taxonomy'

const PHRASES: Record<Route, string> = {
  eaten: 'eaten',
  skin: 'touched',
  inhaled: 'breathed in',
  eyes: 'in the eyes',
  sunlight: 'on skin in sunlight',
}

export function harmfulIf(routes: readonly Route[]): string {
  const parts = routes.map((r) => PHRASES[r])
  if (parts.length < 3) return `Harmful if ${parts.join(' or ')}`
  return `Harmful if ${parts.slice(0, -1).join(', ')}, or ${parts.at(-1)}`
}
