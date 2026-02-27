import { EditSettings } from '@/types'

export function buildFilterString(s: EditSettings): string {
  // Warmth: positive = warm (sepia tint), negative = cool (slight hue shift)
  const warmthSepia = s.warmth > 0 ? (s.warmth / 100) * 0.4 : 0
  const warmthHue = s.warmth < 0 ? (s.warmth / 100) * 30 : 0

  // Black point: compresses shadows upward, darkening the image slightly
  const bpBrightness = 1 - (s.blackPoint / 100) * 0.3

  return [
    `brightness(${(s.brightness * bpBrightness).toFixed(3)})`,
    `contrast(${s.contrast.toFixed(3)})`,
    `saturate(${s.saturation.toFixed(3)})`,
    `sepia(${warmthSepia.toFixed(3)})`,
    `hue-rotate(${(s.hue + warmthHue).toFixed(1)}deg)`,
  ].join(' ')
}

// Tint is handled as a color overlay in EditPreview (not a CSS filter)
// Returns rgba color string for the tint overlay div
export function buildTintColor(tint: number): string {
  if (tint === 0) return 'transparent'
  // Positive tint = magenta/pink, negative tint = green
  if (tint > 0) {
    return `rgba(255, 0, 255, ${(tint / 180) * 0.25})`
  } else {
    return `rgba(0, 255, 0, ${(Math.abs(tint) / 180) * 0.25})`
  }
}
