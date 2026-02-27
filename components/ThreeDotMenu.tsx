'use client'

import { useRef, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface ThreeDotMenuProps {
  imageId: string
  batchId: string
  originalUrl: string
}

export function ThreeDotMenu({ imageId, batchId, originalUrl }: ThreeDotMenuProps) {
  const [open, setOpen] = useState(false)
  const [showOriginal, setShowOriginal] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <>
      <div ref={menuRef} className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-500"
          aria-label="More options"
        >
          ···
        </button>

        {open && (
          <div className="absolute right-0 top-8 w-44 bg-white border border-gray-100 rounded-xl shadow-lg z-10 overflow-hidden">
            <button
              onClick={() => { setShowOriginal(true); setOpen(false) }}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              See original
            </button>
            <button
              onClick={() => {
                setOpen(false)
                router.push(`/edit/${batchId}?imageId=${imageId}&mode=adjust`)
              }}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Adjust edits
            </button>
          </div>
        )}
      </div>

      {showOriginal && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-6"
          onClick={() => setShowOriginal(false)}
        >
          <div className="relative max-w-4xl max-h-full" onClick={(e) => e.stopPropagation()}>
            <img
              src={originalUrl}
              alt="Original"
              className="max-w-full max-h-[85vh] object-contain rounded-xl"
            />
            <button
              onClick={() => setShowOriginal(false)}
              className="absolute top-3 right-3 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center text-sm hover:bg-black/70 transition-colors"
            >
              ✕
            </button>
            <p className="text-white/60 text-xs text-center mt-2">Original (unedited)</p>
          </div>
        </div>
      )}
    </>
  )
}
