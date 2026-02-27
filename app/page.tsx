'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ImageUploader } from '@/components/ImageUploader'
import { supabase } from '@/lib/supabase'
import { uploadToStorage } from '@/lib/uploadImage'
import { DEFAULT_SETTINGS } from '@/types'

export default function HomePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(files: File[]) {
    const file = files[0]
    if (!file) return

    setLoading(true)
    setError(null)

    try {
      let { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        const { data } = await supabase.auth.signInAnonymously()
        user = data.user
      }
      if (!user) throw new Error('Could not create anonymous session')

      // Create batch with default settings
      const { data: batch, error: batchError } = await supabase
        .from('batches')
        .insert({ user_id: user.id, edit_settings: DEFAULT_SETTINGS })
        .select()
        .single()
      if (batchError) throw batchError

      // Generate ID client-side so we can upload first, then insert fully-populated row
      const imageId = crypto.randomUUID()
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${user.id}/${batch.id}/${imageId}.${ext}`
      const publicUrl = await uploadToStorage('originals', path, file)

      const { error: imageError } = await supabase
        .from('images')
        .insert({ id: imageId, batch_id: batch.id, original_url: publicUrl, status: 'pending' })
      if (imageError) throw imageError

      router.push(`/edit/${batch.id}?templateImageId=${imageId}`)
    } catch (err: unknown) {
      const msg = err instanceof Error
        ? err.message
        : (err as { message?: string })?.message ?? JSON.stringify(err)
      setError(msg)
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md flex flex-col gap-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Batch Photo Editor</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            Edit one photo, apply the same look to all.
          </p>
        </div>

        {loading ? (
          <div className="text-center text-gray-400 text-sm py-8">Uploading...</div>
        ) : (
          <ImageUploader
            onFiles={handleFile}
            label="Upload your first photo to get started"
          />
        )}

        {error && (
          <p className="text-red-500 text-sm text-center">{error}</p>
        )}
      </div>
    </main>
  )
}
