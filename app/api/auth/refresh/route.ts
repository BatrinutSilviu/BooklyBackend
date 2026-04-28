import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refresh_token
 *             properties:
 *               refresh_token:
 *                 type: string
 *                 description: The refresh token from login
 *                 example: v1.MjUzOTg0NDAtMzQwYS00NWE3...
 *     responses:
 *       200:
 *         description: New tokens generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 access_token:
 *                   type: string
 *                 refresh_token:
 *                   type: string
 *                 expires_in:
 *                   type: integer
 *                   example: 3600
 *                 expires_at:
 *                   type: integer
 *                   description: Unix timestamp of expiry
 *                 token_type:
 *                   type: string
 *                   example: bearer
 *       400:
 *         description: Missing refresh token
 *       401:
 *         description: Invalid or expired refresh token
 *       500:
 *         description: Server error
 */
export async function POST(request: Request) {
    try {
        const { refresh_token } = await request.json()

        if (!refresh_token) {
            return NextResponse.json(
                { error: 'Refresh token is required' },
                { status: 400 }
            )
        }

        const supabase = await createClient()

        const { data, error } = await supabase.auth.refreshSession({
            refresh_token
        })

        if (error || !data.session) {
            return NextResponse.json(
                { error: 'Invalid or expired refresh token' },
                { status: 401 }
            )
        }

        return NextResponse.json({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            expires_in: data.session.expires_in,
            expires_at: data.session.expires_at,
            token_type: 'bearer'
        })
    } catch (error) {
        console.error('Refresh token error:', error)
        return NextResponse.json(
            { error: 'Failed to refresh token' },
            { status: 500 }
        )
    }
}
