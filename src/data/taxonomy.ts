// Display constants shared by the build and the app. Kept apart from
// schema.ts so the browser bundle doesn't pull in zod just to read a label.
export const GROUPS = [
  'snake',
  'lizard',
  'spider',
  'scorpion',
  'centipede',
  'insect',
  'jellyfish',
  'mollusc',
  'fish',
  'mammal',
  'other',
] as const

export const GROUP_LABELS: Record<Group, string> = {
  snake: 'Snakes',
  lizard: 'Lizards',
  spider: 'Spiders',
  scorpion: 'Scorpions',
  centipede: 'Centipedes',
  insect: 'Insects',
  jellyfish: 'Jellyfish & kin',
  mollusc: 'Molluscs',
  fish: 'Fish',
  mammal: 'Mammals',
  other: 'Other',
}

export const DANGER_LABELS: Record<Danger, string> = {
  1: 'Painful',
  2: 'Medically significant',
  3: 'Serious',
  4: 'Potentially fatal',
  5: 'Extremely dangerous',
}

export type Group = (typeof GROUPS)[number]
export type Danger = 1 | 2 | 3 | 4 | 5
