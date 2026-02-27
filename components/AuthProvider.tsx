'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        supabase.auth.signInAnonymously()
      }
    })
  }, [])

  return <>{children}</>
}
