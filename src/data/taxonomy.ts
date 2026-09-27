// Display constants shared by the build and the app. Kept apart from
// schema.ts so the browser bundle doesn't pull in zod just to read a label.
export const GROUPS = [
  'plant',
  'fungus',
  'amphibian',
  'fish',
  'reptile',
  'insect',
  'other',
] as const

export const GROUP_LABELS: Record<Group, string> = {
  plant: 'Plants',
  fungus: 'Fungi',
  amphibian: 'Amphibians',
  fish: 'Fish',
  reptile: 'Reptiles',
  insect: 'Insects',
  other: 'Other',
}

/** The GBIF kingdom each group is matched in, so a plant and an animal that
 *  share a genus name can't be confused. */
export const KINGDOMS: Record<Group, 'Plantae' | 'Fungi' | 'Animalia'> = {
  plant: 'Plantae',
  fungus: 'Fungi',
  amphibian: 'Animalia',
  fish: 'Animalia',
  reptile: 'Animalia',
  insect: 'Animalia',
  other: 'Animalia',
}

export const DANGER_LABELS: Record<Danger, string> = {
  1: 'Harmful',
  2: 'Medically significant',
  3: 'Serious',
  4: 'Potentially fatal',
  5: 'Extremely dangerous',
}

/** What each level means for a poisoning, for the scale's explanation. */
export const DANGER_MEANINGS: Record<Danger, string> = {
  1: 'painful or distressing reactions of the skin, eyes, or gut that are rarely dangerous',
  2: 'poisonings that usually need medical care but rarely cause lasting harm',
  3: 'can need intensive care, or cause lasting injury such as blindness or scarring burns',
  4: 'has killed people',
  5: 'small amounts can kill, and people die even with treatment',
}

/** How a species can poison someone. */
export const ROUTES = ['eaten', 'skin', 'inhaled', 'eyes', 'sunlight'] as const

export const ROUTE_LABELS: Record<Route, string> = {
  eaten: 'Eaten',
  skin: 'Touched',
  inhaled: 'Breathed in or smoke',
  eyes: 'In the eyes',
  sunlight: 'On skin, then sunlight',
}

/** Animals a species is also dangerous to, as a cited flag. */
export const ANIMALS = ['dogs', 'cats', 'horses', 'livestock'] as const

export const ANIMAL_LABELS: Record<Animal, string> = {
  dogs: 'dogs',
  cats: 'cats',
  horses: 'horses',
  livestock: 'livestock',
}

export type Group = (typeof GROUPS)[number]
export type Danger = 1 | 2 | 3 | 4 | 5
export type Route = (typeof ROUTES)[number]
export type Animal = (typeof ANIMALS)[number]
