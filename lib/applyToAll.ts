import { supabase } from '@/lib/supabase'
import { EditSettings } from '@/types'

export async function applyToAll(
  batchId: string,
  changedFields: Partial<EditSettings>
): Promise<void> {
  const { data: images, error } = await supabase
    .from('images')
    .select('id, image_override_settings')
    .eq('batch_id', batchId)

  if (error) throw new Error(`Failed to fetch images: ${error.message}`)
  if (!images || images.length === 0) return

  const updates = images.map((img) => ({
    id: img.id,
    image_override_settings: {
      ...(img.image_override_settings ?? {}),
      ...changedFields, // changed fields always win (last write wins per field)
    },
    status: 'pending', // reset to trigger reprocessing
  }))

  const errors = await Promise.all(
    updates.map(({ id, image_override_settings, status }) =>
      supabase
        .from('images')
        .update({ image_override_settings, status })
        .eq('id', id)
        .then(({ error }) => error)
    )
  )
  const firstError = errors.find(Boolean)
  if (firstError) throw new Error(`Failed to apply to all: ${firstError.message}`)
}
