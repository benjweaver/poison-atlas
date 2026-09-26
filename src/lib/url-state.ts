// The selected place, species and filters live in the URL query string, so
// every view is a shareable link and the back button works — without a router
// or server-side rewrites, which keeps the site deployable to any static host.
//
//   ?r=US-AZ              a country or state
//   ?s=crotalus-atrox     a species
//   ?g=snake,spider       group filter
//   ?q=widow              search text
//   ?d=4                  only danger 4 and up
import { reactive, watch } from 'vue'

import { GROUPS, type Danger, type Group } from '@/data/taxonomy'

export interface ViewState {
  region: string | null
  species: string | null
  groups: Group[]
  query: string
  /** Only species at least this dangerous (1 shows everything). */
  minDanger: Danger
}

function read(): ViewState {
  const p = new URLSearchParams(location.search)
  const groups = (p.get('g') ?? '')
    .split(',')
    .filter((g): g is Group => (GROUPS as readonly string[]).includes(g))
  const d = Number(p.get('d'))
  const minDanger = (d >= 1 && d <= 5 ? Math.floor(d) : 1) as Danger
  return { region: p.get('r'), species: p.get('s'), groups, query: p.get('q') ?? '', minDanger }
}

function toSearch(state: ViewState): string {
  const p = new URLSearchParams()
  if (state.region) p.set('r', state.region)
  if (state.species) p.set('s', state.species)
  if (state.groups.length) p.set('g', state.groups.join(','))
  if (state.query) p.set('q', state.query)
  if (state.minDanger > 1) p.set('d', String(state.minDanger))
  const s = p.toString()
  return s ? `?${s}` : location.pathname
}

export function useUrlState(): ViewState {
  const state = reactive(read())
  let fromHistory = false

  // Navigating (place or species) adds a history entry; typing in the search
  // box or toggling filters replaces the current one, so Back doesn't replay
  // every keystroke.
  watch(
    () => [state.region, state.species] as const,
    () => {
      if (!fromHistory) history.pushState(null, '', toSearch(state))
    },
  )
  watch(
    () => [state.groups.join(','), state.query, state.minDanger] as const,
    () => {
      if (!fromHistory) history.replaceState(null, '', toSearch(state))
    },
  )

  addEventListener('popstate', () => {
    fromHistory = true
    Object.assign(state, read())
    // Watchers run after this tick; clear the flag once they have.
    queueMicrotask(() => (fromHistory = false))
  })

  return state
}
