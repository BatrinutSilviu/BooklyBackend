import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

/**
 * @swagger
 * /api/auth/callback:
 *   get:
 *     summary: Handle OAuth callback
 *     description: Exchanges the OAuth code returned by Google for a session. Returns access and refresh tokens.
 *     tags:
 *       - Authentication
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: Authorization code returned by Google
 *     responses:
 *       200:
 *         description: Authentication successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     email:
 *                       type: string
 *                       format: email
 *                     role:
 *                       type: string
 *                 session:
 *                   type: object
 *                   properties:
 *                     access_token:
 *                       type: string
 *                     refresh_token:
 *                       type: string
 *                     expires_in:
 *                       type: integer
 *                     token_type:
 *                       type: string
 *       400:
 *         description: Missing or invalid code
 *       500:
 *         description: Server error
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const code = searchParams.get('code')

        if (!code) {
            return NextResponse.json({ error: 'Authorization code is required' }, { status: 400 })
        }

        const supabase = await createClient()

        const { data, error } = await supabase.auth.exchangeCodeForSession(code)

        if (error || !data.session) {
            return NextResponse.json({ error: error?.message ?? 'Failed to exchange code for session' }, { status: 400 })
        }

        return NextResponse.json({
            user: {
                id: data.user.id,
                email: data.user.email,
                role: data.user.app_metadata?.role ?? 'user',
            },
            session: {
                access_token: data.session.access_token,
                refresh_token: data.session.refresh_token,
                expires_in: data.session.expires_in,
                token_type: data.session.token_type,
            },
        })
    } catch (error) {
        console.error('OAuth callback error:', error)
        return NextResponse.json({ error: 'Failed to complete authentication' }, { status: 500 })
    }
}
