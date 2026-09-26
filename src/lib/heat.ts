// Species count → shade. Stepped rather than continuous so the legend can say
// "6–9 species" and the map means the same thing: continuous shades of one
// hue are hard to tell apart and impossible to read back as a number.
export const HEAT_STEPS = [1, 3, 6, 12, 25] as const

export function heatLabel(i: number): string {
  const from = HEAT_STEPS[i]
  const next = HEAT_STEPS[i + 1]
  if (next === undefined) return `${from}+`
  return next - 1 === from ? `${from}` : `${from}–${next - 1}`
}
