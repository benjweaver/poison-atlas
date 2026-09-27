// Exposes the validated species list to the app as `virtual:species`, and
// writes sitemap.xml for the build: every species and every place with one.
//
// Validation happens inside the build, so bad data fails `vite build` (and
// shows Vite's error overlay in dev) instead of shipping. Editing a YAML file
// reloads the page.
import type { Plugin } from 'vite'

import {
  CENTRES_FILE,
  GBIF_FILE,
  GRID_DIR,
  IMAGES_FILE,
  loadPoisonCentres,
  loadSpecies,
  SPECIES_DIR,
  speciesFiles,
  TDWG_FILE,
} from './species-loader.ts'

// Everything the data modules are built from. A change to any of them rebuilds them.
const INPUTS = [SPECIES_DIR, IMAGES_FILE, GBIF_FILE, GRID_DIR, TDWG_FILE, CENTRES_FILE]

// Where the site is served; the sitemap needs absolute addresses.
const SITE = 'https://poison-atlas.benjweaver.dev'

const ID = 'virtual:species'
const RESOLVED = '\0' + ID
const CENTRES_ID = 'virtual:poison-centres'
const CENTRES_RESOLVED = '\0' + CENTRES_ID

export function speciesPlugin(): Plugin {
  return {
    name: 'poison-atlas:species',
    resolveId(id) {
      if (id === ID) return RESOLVED
      if (id === CENTRES_ID) return CENTRES_RESOLVED
      return undefined
    },
    load(id) {
      if (id === CENTRES_RESOLVED) {
        this.addWatchFile(CENTRES_FILE)
        return `export default ${JSON.stringify(loadPoisonCentres())}`
      }
      if (id !== RESOLVED) return
      // Files, not the directory: Vite resolves watched paths as imports in dev.
      // Added and deleted files are caught by the server watcher below.
      for (const file of speciesFiles()) this.addWatchFile(file)
      this.addWatchFile(IMAGES_FILE)
      this.addWatchFile(GBIF_FILE)
      this.addWatchFile(TDWG_FILE)
      return `export default ${JSON.stringify(loadSpecies())}`
    },
    generateBundle() {
      const species = loadSpecies()
      const places = new Set<string>()
      for (const s of species) {
        for (const code of [...s.regions, ...(s.introduced ?? [])]) {
          places.add(code)
          places.add(code.slice(0, 2)) // a state's country lists it too
        }
      }
      const urls = [
        `${SITE}/`,
        ...species.map((s) => `${SITE}/?s=${s.slug}`).sort(),
        ...[...places].sort().map((code) => `${SITE}/?r=${code}`),
      ]
      const body = urls.map((url) => `  <url><loc>${url}</loc></url>`).join('\n')
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`,
      })
    },
    configureServer(server) {
      server.watcher.add(INPUTS)
      const reload = (file: string) => {
        if (!INPUTS.some((input) => file.startsWith(input))) return
        for (const id of [RESOLVED, CENTRES_RESOLVED]) {
          const mod = server.moduleGraph.getModuleById(id)
          if (mod) server.moduleGraph.invalidateModule(mod)
        }
        server.ws.send({ type: 'full-reload' })
      }
      server.watcher.on('change', reload)
      server.watcher.on('add', reload)
      server.watcher.on('unlink', reload)
    },
  }
}
