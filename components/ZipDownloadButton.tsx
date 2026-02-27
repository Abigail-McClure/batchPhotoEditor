'use client'

import { useState } from 'react'
import { downloadAllAsZip } from '@/lib/zipDownload'
import { ImageRow } from '@/types'

interface ZipDownloadButtonProps {
  images: ImageRow[]
  batchId: string
}

export function ZipDownloadButton({ images, batchId }: ZipDownloadButtonProps) {
  const [loading, setLoading] = useState(false)
  const doneImages = images.filter((i) => i.status === 'done' && i.edited_url)

  async function handleClick() {
    if (doneImages.length === 0) return
    setLoading(true)
    try {
      await downloadAllAsZip(doneImages, batchId)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading || doneImages.length === 0}
      className="w-full py-3 px-4 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      {loading
        ? 'Preparing ZIP...'
        : doneImages.length === 0
        ? 'No photos ready yet'
        : `Download all as ZIP (${doneImages.length} photo${doneImages.length !== 1 ? 's' : ''})`}
    </button>
  )
}
