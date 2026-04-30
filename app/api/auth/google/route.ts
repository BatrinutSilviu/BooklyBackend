import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

/**
 * @swagger
 * /api/auth/google:
 *   get:
 *     summary: Initiate Google OAuth login
 *     description: Returns a Google OAuth URL. Open this URL in a browser or webview. After authentication, Google will redirect to /api/auth/callback with a code parameter.
 *     tags:
 *       - Authentication
 *     parameters:
 *       - in: query
 *         name: redirect_to
 *         schema:
 *           type: string
 *         description: URL to redirect to after successful authentication (defaults to the callback endpoint)
 *     responses:
 *       200:
 *         description: Google OAuth URL
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url:
 *                   type: string
 *                   description: Open this URL in a browser to authenticate with Google
 *       500:
 *         description: Server error
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const redirectTo = searchParams.get('redirect_to')
            ?? `${process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin}/api/auth/callback`

        const supabase = await createClient()

        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo,
                skipBrowserRedirect: true,
            },
        })

        if (error || !data.url) {
            return NextResponse.json({ error: error?.message ?? 'Failed to generate OAuth URL' }, { status: 500 })
        }

        return NextResponse.json({ url: data.url })
    } catch (error) {
        console.error('Google OAuth error:', error)
        return NextResponse.json({ error: 'Failed to initiate Google login' }, { status: 500 })
    }
}
