import { createClient } from '@/lib/supabase-server'
import { withRetry } from '@/lib/retry'
import { NextResponse } from 'next/server'

export async function getAuthenticatedUser() {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await withRetry(() => supabase.auth.getUser())

    if (authError || !user) {
        console.error('Auth error:', authError) // Log for debugging
        return {
            user: null,
            error: NextResponse.json(
                { error: 'Unauthorized - Invalid or missing authentication token' },
                { status: 401 }
            )
        }
    }

    return { user, error: null }
}

export async function getAuthenticatedAdmin() {
    const supabase = await createClient()
    const { data: { user }, error } = await withRetry(() => supabase.auth.getUser())

    if (error || !user) {
        return {
            user: null,
            error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
    }

    const isAdmin = user.role === 'admin'

    if (!isAdmin) {
        return {
            user: null,
            error: NextResponse.json(
                { error: 'Forbidden - Admin access required' },
                { status: 403 }
            )
        }
    }

    return { user, error: null }
}