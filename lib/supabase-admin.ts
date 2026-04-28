// lib/supabase-admin.ts
import { createClient } from '@supabase/supabase-js'

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set')
if (!process.env.NEXT_PUBLIC_SUPABASE_ADMIN) throw new Error('NEXT_PUBLIC_SUPABASE_ADMIN is not set')

export const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ADMIN
)
