export interface EditSettings {
  brightness: number  // 0.5–2.0, default 1.0
  contrast: number    // 0.5–2.0, default 1.0
  saturation: number  // 0.0–3.0, default 1.0
  tint: number        // -180–180, default 0
  warmth: number      // -100–100, default 0
  hue: number         // 0–360, default 0
  blackPoint: number  // 0–100, default 0
}

export interface Batch {
  id: string
  user_id: string
  created_at: string
  edit_settings: EditSettings
}

export interface ImageRow {
  id: string
  batch_id: string
  original_url: string
  edited_url: string | null
  image_override_settings: Partial<EditSettings> | null
  status: 'pending' | 'processing' | 'done' | 'failed'
  created_at: string
}

export const DEFAULT_SETTINGS: EditSettings = {
  brightness: 1.0,
  contrast: 1.0,
  saturation: 1.0,
  tint: 0,
  warmth: 0,
  hue: 0,
  blackPoint: 0,
}

export const MAX_IMAGES_PER_BATCH = 25
export const MAX_FILE_SIZE_MB = 20
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
