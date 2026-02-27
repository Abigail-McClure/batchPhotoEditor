'use client'

import { useRef, useState } from 'react'
import { ACCEPTED_TYPES, MAX_FILE_SIZE_MB } from '@/types'

interface ImageUploaderProps {
  onFiles: (files: File[]) => void
  multiple?: boolean
  disabled?: boolean
  label?: string
}

export function ImageUploader({
  onFiles,
  multiple = false,
  disabled = false,
  label,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function validateFiles(fileList: FileList | null): File[] {
    if (!fileList || fileList.length === 0) return []
    const valid: File[] = []
    const errors: string[] = []

    Array.from(fileList).forEach((file) => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        errors.push(`${file.name}: unsupported format (JPG, PNG, WEBP only)`)
      } else if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        errors.push(`${file.name}: exceeds ${MAX_FILE_SIZE_MB}MB limit`)
      } else {
        valid.push(file)
      }
    })

    if (errors.length > 0) setError(errors[0])
    else setError(null)

    return valid
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = validateFiles(e.target.files)
    if (files.length > 0) onFiles(files)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const files = validateFiles(e.dataTransfer.files)
    if (files.length > 0) onFiles(files)
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-2xl p-8 text-center transition-colors cursor-pointer
          ${dragOver ? 'border-gray-400 bg-gray-50' : 'border-gray-200 hover:border-gray-300'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <p className="text-gray-500 text-sm">
          {label ?? (multiple ? 'Drop photos here or click to upload' : 'Drop a photo here or click to upload')}
        </p>
        <p className="text-gray-400 text-xs mt-1">JPG, PNG, WEBP · max {MAX_FILE_SIZE_MB}MB each</p>
      </div>
      {error && (
        <p className="text-red-500 text-xs px-1">{error}</p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        multiple={multiple}
        className="hidden"
        onChange={handleChange}
        disabled={disabled}
      />
    </div>
  )
}
