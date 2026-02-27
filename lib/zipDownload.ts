import JSZip from 'jszip'
import { ImageRow } from '@/types'

export async function downloadAllAsZip(images: ImageRow[], batchId: string): Promise<void> {
  const zip = new JSZip()
  const folder = zip.folder(`batch-${batchId.slice(0, 8)}`)!

  await Promise.all(
    images.map(async (img, i) => {
      if (!img.edited_url) return
      const res = await fetch(img.edited_url)
      if (!res.ok) return
      const blob = await res.blob()
      const ext = img.edited_url.split('.').pop()?.split('?')[0] ?? 'jpg'
      folder.file(`image-${String(i + 1).padStart(3, '0')}.${ext}`, blob)
    })
  )

  const content = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(content)
  const a = document.createElement('a')
  a.href = url
  a.download = `batch-${batchId.slice(0, 8)}.zip`
  a.click()
  URL.revokeObjectURL(url)
}
