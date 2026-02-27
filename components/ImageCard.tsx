'use client'

import { useEffect, useState } from 'react'
import { ThreeDotMenu } from '@/components/ThreeDotMenu'
import { ImageRow } from '@/types'

interface ImageCardProps {
  image: ImageRow
  batchId: string
}

export function ImageCard({ image, batchId }: ImageCardProps) {
  const displayUrl = image.edited_url || image.original_url

  const isPending = image.status === 'pending' || image.status === 'processing'
  const isFailed = image.status === 'failed'

  const [imgLoaded, setImgLoaded] = useState(false)

  // Reset loaded state whenever the URL changes so the overlay stays up
  // until the new image is fully rendered
  useEffect(() => {
    setImgLoaded(false)
  }, [displayUrl])

  const showOverlay = isPending || !imgLoaded

  return (
    <div className="flex flex-col gap-2">
      <div className="relative rounded-xl overflow-hidden bg-gray-50 aspect-square">
        <img
          src={displayUrl}
          alt="Photo"
          className="w-full h-full object-cover"
          onLoad={() => setImgLoaded(true)}
        />

        {/* Spinner overlay: stays up until worker is done AND image is fully rendered */}
        {showOverlay && !isFailed && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center rounded-xl">
            <div className="flex flex-col items-center gap-2">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {isPending && (
                <span className="text-white text-xs">
                  {image.status === 'processing' ? 'Processing...' : 'Queued'}
                </span>
              )}
            </div>
          </div>
        )}

        {isFailed && (
          <div className="absolute inset-0 bg-red-900/40 flex items-center justify-center rounded-xl">
            <span className="text-white text-xs text-center px-2">Failed</span>
          </div>
        )}

        {/* Three-dot menu: top right */}
        <div className="absolute top-2 right-2">
          <ThreeDotMenu
            imageId={image.id}
            batchId={batchId}
            originalUrl={image.original_url}
          />
        </div>
      </div>

      {/* Download and status row */}
      <div className="flex items-center justify-between px-0.5">
        {image.status === 'done' && image.edited_url ? (
          <a
            href={image.edited_url}
            download
            className="text-xs text-gray-500 underline underline-offset-2 hover:text-gray-800 transition-colors"
          >
            Download
          </a>
        ) : (
          <span className="text-xs text-gray-300">
            {isFailed ? 'Processing failed' : 'Waiting...'}
          </span>
        )}
      </div>
    </div>
  )
}
