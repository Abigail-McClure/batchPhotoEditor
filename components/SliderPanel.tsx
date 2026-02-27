'use client'

import { Slider } from '@/components/Slider'
import { EditSettings } from '@/types'

const SLIDERS: {
  key: keyof EditSettings
  label: string
  min: number
  max: number
  step: number
}[] = [
  { key: 'brightness', label: 'Brightness', min: 0.5, max: 2.0, step: 0.01 },
  { key: 'contrast',   label: 'Contrast',   min: 0.5, max: 2.0, step: 0.01 },
  { key: 'saturation', label: 'Saturation', min: 0.0, max: 3.0, step: 0.01 },
  { key: 'warmth',     label: 'Warmth',     min: -100, max: 100, step: 1   },
  { key: 'tint',       label: 'Tint',       min: -180, max: 180, step: 1   },
  { key: 'hue',        label: 'Hue',        min: 0,   max: 360, step: 1   },
  { key: 'blackPoint', label: 'Black Point', min: 0,  max: 100, step: 1   },
]

interface SliderPanelProps {
  settings: EditSettings
  onChange: (settings: EditSettings) => void
}

export function SliderPanel({ settings, onChange }: SliderPanelProps) {
  return (
    <div className="flex flex-col gap-6">
      {SLIDERS.map((s) => (
        <Slider
          key={s.key}
          label={s.label}
          value={settings[s.key]}
          min={s.min}
          max={s.max}
          step={s.step}
          onChange={(val) => onChange({ ...settings, [s.key]: val })}
        />
      ))}
    </div>
  )
}
