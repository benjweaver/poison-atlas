/// <reference types="vite/client" />

/** Countries and territories on the world map (vite.config.ts). */
declare const __MAP_COUNTRIES__: number

declare module 'virtual:species' {
  import type { Species } from '@/data/schema'
  const species: Species[]
  export default species
}
