'use client'

import { ImageCard } from '@/components/ImageCard'
import { ImageRow } from '@/types'

interface ResultsGridProps {
  images: ImageRow[]
  batchId: string
}

export function ResultsGrid({ images, batchId }: ResultsGridProps) {
  if (images.length === 0) {
    return (
      <p className="text-gray-400 text-sm text-center py-12">
        No photos yet — upload some below.
      </p>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {images.map((image) => (
        <ImageCard key={image.id} image={image} batchId={batchId} />
      ))}
    </div>
  )
}
