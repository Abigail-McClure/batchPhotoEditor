'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { ImageUploader } from '@/components/ImageUploader'
import { ProgressBar } from '@/components/ProgressBar'
import { ResultsGrid } from '@/components/ResultsGrid'
import { ZipDownloadButton } from '@/components/ZipDownloadButton'
import { supabase } from '@/lib/supabase'
import { uploadToStorage } from '@/lib/uploadImage'
import { ImageRow, MAX_IMAGES_PER_BATCH } from '@/types'

interface PageProps {
  params: { batchId: string }
}

export default function ResultsPage({ params }: PageProps) {
  const { batchId } = params
  const [images, setImages] = useState<ImageRow[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Poll for image status updates every 3 seconds
  useEffect(() => {
    async function fetchImages() {
      const { data } = await supabase
        .from('images')
        .select('*')
        .eq('batch_id', batchId)
        .order('created_at', { ascending: true })
      if (data) setImages(data as ImageRow[])
    }

    fetchImages()
    const interval = setInterval(fetchImages, 3000)
    return () => clearInterval(interval)
  }, [batchId])

  async function handleUpload(files: File[]) {
    setUploading(true)
    setUploadError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Check how many slots remain
      const { count } = await supabase
        .from('images')
        .select('*', { count: 'exact', head: true })
        .eq('batch_id', batchId)

      const remaining = MAX_IMAGES_PER_BATCH - (count ?? 0)
      if (remaining <= 0) {
        setUploadError(`Batch full — max ${MAX_IMAGES_PER_BATCH} photos per batch.`)
        setUploading(false)
        return
      }

      const toUpload = files.slice(0, remaining)
      if (toUpload.length < files.length) {
        setUploadError(`Only ${toUpload.length} of ${files.length} photos added — batch limit reached.`)
      }

      await Promise.all(
        toUpload.map(async (file) => {
          // Generate ID client-side so we can upload first, then insert fully-populated row
          const imageId = crypto.randomUUID()
          const ext = file.name.split('.').pop() ?? 'jpg'
          const path = `${user.id}/${batchId}/${imageId}.${ext}`
          const publicUrl = await uploadToStorage('originals', path, file)

          const { error: imgError } = await supabase
            .from('images')
            .insert({ id: imageId, batch_id: batchId, original_url: publicUrl, status: 'pending' })
          if (imgError) throw imgError
        })
      )
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const doneCount = images.filter((i) => i.status === 'done').length
  const totalCount = images.length
  const atLimit = totalCount >= MAX_IMAGES_PER_BATCH

  return (
    <main className="min-h-screen px-6 py-10 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Your batch</h1>
        <p className="text-sm text-gray-400">
          {totalCount} / {MAX_IMAGES_PER_BATCH} photos
        </p>
      </div>

      <ProgressBar done={doneCount} total={totalCount} />

      {/* Upload more */}
      <div className="mb-8">
        {atLimit ? (
          <div className="border-2 border-dashed border-gray-100 rounded-2xl p-6 text-center text-gray-400 text-sm">
            Batch full ({MAX_IMAGES_PER_BATCH}/{MAX_IMAGES_PER_BATCH})
          </div>
        ) : (
          <ImageUploader
            onFiles={handleUpload}
            multiple
            disabled={uploading}
            label={uploading ? 'Uploading...' : 'Add more photos'}
          />
        )}
        {uploadError && (
          <p className="text-amber-600 text-xs mt-2 px-1">{uploadError}</p>
        )}
      </div>

      <ResultsGrid images={images} batchId={batchId} />

      {images.length > 0 && (
        <div className="mt-8">
          <ZipDownloadButton images={images} batchId={batchId} />
        </div>
      )}
    </main>
  )
}
