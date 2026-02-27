import { supabase } from '@/lib/supabase'

export async function uploadToStorage(
  bucket: 'originals' | 'edited',
  path: string,
  file: File | Blob
): Promise<string> {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file)

  if (error) throw new Error(`Storage upload failed: ${error.message}`)

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}
