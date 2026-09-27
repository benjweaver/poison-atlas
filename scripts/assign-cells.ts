// Which state a record dot belongs to, once GBIF has said which country.
//
// GBIF attributes every record to a country (for marine records, whose waters
// it's in), and scripts/ranges.ts fetches each country's dots separately, so
// the country is GBIF's answer. For the big countries the map shows by state,
// this picks the state the dot lies in, or the nearest one for a dot at sea.

import { distance, inside, shapeOf, type Outline, type Shape } from './polygons.ts'

export type { Outline }

function nearest(p: [number, number], candidates: Shape[], maxDegrees: number): Shape | null {
  const near = candidates.filter(
    (f) =>
      p[0] >= f.box[0] - maxDegrees * 2 &&
      p[0] <= f.box[2] + maxDegrees * 2 &&
      p[1] >= f.box[1] - maxDegrees &&
      p[1] <= f.box[3] + maxDegrees,
  )
  const hit = near.find((f) => inside(p, f))
  if (hit) return hit
  let best: Shape | null = null
  let bestDistance = maxDegrees
  for (const f of near) {
    const d = distance(p, f)
    if (d <= bestDistance) {
      best = f
      bestDistance = d
    }
  }
  return best
}

/** A dot this far from every state of its country is left at country level. */
const MAX_STATE_DEGREES = 6

export function makeStateResolver(
  subdivisionsOf: (country: string) => Outline[],
): (point: [number, number], country: string) => string {
  const states = new Map<string, Shape[]>()
  return (point, country) => {
    if (!states.has(country)) states.set(country, subdivisionsOf(country).map(shapeOf))
    return nearest(point, states.get(country)!, MAX_STATE_DEGREES)?.code ?? country
  }
}

/**
 * For sea animals: whether a record dot lies on land, further than
 * `maxDegrees` (about 40 km) from the coast. Such records are errors, usually
 * a museum specimen placed at the museum rather than where it was collected
 * (a reef stonefish "recorded" in Madrid). Small islands missing from the land
 * outline only ever make this answer "no", so it never drops a real record.
 */
export function makeInlandTest(
  land: Outline[],
  maxDegrees = 0.35,
): (point: [number, number]) => boolean {
  const shapes = land.map(shapeOf)
  return (point) => {
    const onLand = shapes.filter((f) => inside(point, f))
    return onLand.length > 0 && onLand.every((f) => distance(point, f) > maxDegrees)
  }
}
