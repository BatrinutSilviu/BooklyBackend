import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login to user account
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 description: User's password
 *                 example: SecurePass123!
 *     responses:
 *       200:
 *         description: Login successful
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
 *                       description: User's unique ID
 *                       example: 123e4567-e89b-12d3-a456-426614174000
 *                     email:
 *                       type: string
 *                       format: email
 *                       example: user@example.com
 *                     role:
 *                       type: string
 *                 session:
 *                   type: object
 *                   properties:
 *                     access_token:
 *                       type: string
 *                       description: JWT access token for API requests
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                     refresh_token:
 *                       type: string
 *                       description: Refresh token to get new access tokens
 *                       example: v1.MjUzOTg0NDAtMzQwYS00NWE3LWI2ZDEtODc...
 *                     expires_in:
 *                       type: integer
 *                       description: Token expiration time in seconds
 *                       example: 3600
 *                     token_type:
 *                       type: string
 *                       example: bearer
 *       400:
 *         description: Bad request - missing or invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Email and password are required
 *       401:
 *         description: Unauthorized - invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Invalid login credentials
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Failed to login
 */
export async function POST(request: Request) {
    try {
        const { email, password } = await request.json()

        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email and password are required' },
                { status: 400 }
            )
        }

        const supabase = await createClient()

        const { data, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (signInError || !data.user) {
            return NextResponse.json(
                { error: signInError?.message || 'Invalid login credentials' },
                { status: 401 }
            )
        }

        return NextResponse.json({
            user: {
                id: data.user.id,
                email: data.user.email,
                role: data.user.app_metadata?.role || 'user'
            },
            session: {
                access_token: data.session?.access_token,
                refresh_token: data.session?.refresh_token,
                expires_in: data.session?.expires_in,
                token_type: data.session?.token_type,
            }
        })
    } catch (error) {
        console.error('Login error:', error)
        return NextResponse.json(
            { error: 'Failed to login: ' + error },
            { status: 500 }
        )
    }
}
