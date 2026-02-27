'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { EditPreview } from '@/components/EditPreview'
import { SliderPanel } from '@/components/SliderPanel'
import { supabase } from '@/lib/supabase'
import { applyToAll } from '@/lib/applyToAll'
import { DEFAULT_SETTINGS, EditSettings } from '@/types'

interface PageProps {
  params: { batchId: string }
}

export default function EditPage({ params }: PageProps) {
  const { batchId } = params
  const router = useRouter()
  const searchParams = useSearchParams()

  const templateImageId = searchParams.get('templateImageId')
  const adjustImageId = searchParams.get('imageId')
  const mode = searchParams.get('mode') // 'adjust' or null

  const [settings, setSettings] = useState<EditSettings>(DEFAULT_SETTINGS)
  const [imageUrl, setImageUrl] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Track initial settings so we can diff for "apply to all"
  const initialSettingsRef = useRef<EditSettings>(DEFAULT_SETTINGS)

  useEffect(() => {
    async function load() {
      try {
        // Load batch template settings
        const { data: batch, error: batchError } = await supabase
          .from('batches')
          .select('edit_settings')
          .eq('id', batchId)
          .single()
        if (batchError) throw batchError

        const batchSettings: EditSettings = { ...DEFAULT_SETTINGS, ...batch.edit_settings }

        if (mode === 'adjust' && adjustImageId) {
          // Adjust mode: load this image's final settings (batch + overrides merged)
          const { data: image, error: imgError } = await supabase
            .from('images')
            .select('original_url, image_override_settings')
            .eq('id', adjustImageId)
            .single()
          if (imgError) throw imgError

          const merged: EditSettings = {
            ...batchSettings,
            ...(image.image_override_settings ?? {}),
          }
          setSettings(merged)
          initialSettingsRef.current = merged
          setImageUrl(image.original_url)
        } else if (templateImageId) {
          // Template edit mode: start from batch settings
          const { data: image, error: imgError } = await supabase
            .from('images')
            .select('original_url')
            .eq('id', templateImageId)
            .single()
          if (imgError) throw imgError

          setSettings(batchSettings)
          initialSettingsRef.current = batchSettings
          setImageUrl(image.original_url)
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [batchId, templateImageId, adjustImageId, mode])

  function getChangedFields(): Partial<EditSettings> {
    const initial = initialSettingsRef.current
    const changed: Partial<EditSettings> = {}
    for (const key of Object.keys(settings) as (keyof EditSettings)[]) {
      if (settings[key] !== initial[key]) {
        changed[key] = settings[key]
      }
    }
    return changed
  }

  async function handleDone() {
    setSaving(true)
    setError(null)
    try {
      // Save settings as the batch template
      await supabase
        .from('batches')
        .update({ edit_settings: settings })
        .eq('id', batchId)

      // Also reset the template image to pending so worker processes it
      if (templateImageId) {
        await supabase
          .from('images')
          .update({ status: 'pending' })
          .eq('id', templateImageId)
      }

      router.push(`/results/${batchId}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save')
      setSaving(false)
    }
  }

  async function handleSaveForThisPhoto() {
    if (!adjustImageId) return
    setSaving(true)
    setError(null)
    try {
      const overrides = getChangedFields()
      // Merge with existing overrides
      const { data: image } = await supabase
        .from('images')
        .select('image_override_settings')
        .eq('id', adjustImageId)
        .single()

      const merged = {
        ...(image?.image_override_settings ?? {}),
        ...overrides,
      }

      await supabase
        .from('images')
        .update({ image_override_settings: merged, status: 'pending' })
        .eq('id', adjustImageId)

      router.push(`/results/${batchId}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save')
      setSaving(false)
    }
  }

  async function handleApplyToAll() {
    setSaving(true)
    setError(null)
    try {
      const changedFields = getChangedFields()
      // Update batch template so future uploads inherit these settings too
      await supabase
        .from('batches')
        .update({ edit_settings: settings })
        .eq('id', batchId)
      await applyToAll(batchId, changedFields)
      router.push(`/results/${batchId}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to apply')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">
        Loading...
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Image preview — left */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4 overflow-hidden">
        {mode !== 'adjust' && (
          <p className="text-xs text-gray-400 text-center max-w-sm">
            This photo will be your edit template — all future photos will inherit these settings.
          </p>
        )}
        {imageUrl && <EditPreview imageUrl={imageUrl} settings={settings} />}
      </div>

      {/* Slider panel — right */}
      <div className="w-80 flex flex-col border-l border-gray-100 overflow-y-auto">
        <div className="flex-1 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-6">
            {mode === 'adjust' ? 'Adjust edits' : 'Edit settings'}
          </h2>
          <SliderPanel settings={settings} onChange={setSettings} />
        </div>

        <div className="p-6 border-t border-gray-100 flex flex-col gap-3">
          {error && <p className="text-red-500 text-xs">{error}</p>}

          {mode === 'adjust' ? (
            <>
              <button
                onClick={handleSaveForThisPhoto}
                disabled={saving}
                className="w-full py-2.5 px-4 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving...' : 'Save for this photo only'}
              </button>
              <button
                onClick={handleApplyToAll}
                disabled={saving}
                className="w-full py-2.5 px-4 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Applying...' : 'Apply adjusted edits to all photos'}
              </button>
              <button
                onClick={() => router.push(`/results/${batchId}`)}
                className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={handleDone}
              disabled={saving}
              className="w-full py-2.5 px-4 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Done, add more photos'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
