'use client'

import { EditSettings } from '@/types'
import { buildFilterString, buildTintColor } from '@/lib/filterString'

interface EditPreviewProps {
  imageUrl: string
  settings: EditSettings
}

export function EditPreview({ imageUrl, settings }: EditPreviewProps) {
  const filterString = buildFilterString(settings)
  const tintColor = buildTintColor(settings.tint)

  return (
    <div className="relative w-full max-h-[65vh] flex items-center justify-center">
      <div className="relative inline-block max-w-full max-h-[65vh]">
        <img
          src={imageUrl}
          alt="Edit preview"
          style={{ filter: filterString }}
          className="block max-w-full max-h-[65vh] object-contain rounded-xl shadow-sm"
        />
        {settings.tint !== 0 && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: tintColor,
              mixBlendMode: 'color',
              borderRadius: '0.75rem',
              pointerEvents: 'none',
            }}
          />
        )}
      </div>
    </div>
  )
}
