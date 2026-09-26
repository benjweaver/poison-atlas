/// <reference types="vite/client" />

declare module 'virtual:species' {
  import type { Species } from '@/data/schema'
  const species: Species[]
  export default species
}
