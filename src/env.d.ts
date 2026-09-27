/// <reference types="vite/client" />

declare module 'virtual:species' {
  import type { Species } from '@/data/schema'
  const species: Species[]
  export default species
}

declare module 'virtual:poison-centres' {
  import type { PoisonCentre } from '@/data/schema'
  const centres: Record<string, PoisonCentre>
  export default centres
}
