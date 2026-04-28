import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * @swagger
 * /api/profiles/users/{user_id}:
 *   get:
 *     summary: Gets all the profiles of a user
 *     description: Returns all profiles associated with a specific user ID
 *     tags:
 *       - Profiles
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The user ID (UUID)
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   name:
 *                     type: string
 *                   date_of_birth:
 *                     type: string
 *                     format: date
 *                     nullable: true
 *                   gender:
 *                     type: boolean
 *                   photo_url:
 *                     type: string
 *                     nullable: true
 *       400:
 *         description: Invalid user ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - cannot access other users profiles
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ user_id: string }> }
) {
    try {
        const { user, error: authError } = await getAuthenticatedUser()
        if (authError) return authError

        const { user_id } = await params

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (!uuidRegex.test(user_id)) {
            return NextResponse.json(
                { error: 'Invalid user ID format' },
                { status: 400 }
            )
        }

        if (user.id !== user_id) {
            return NextResponse.json(
                { error: 'Forbidden - you can only access your own profiles' },
                { status: 403 }
            )
        }

        const { data: { user: authUser }, error: userError } = await supabaseAdmin.auth.admin.getUserById(user_id)

        if (userError || !authUser) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            )
        }

        const profiles = await prisma.profiles.findMany({
            where: {
                user_id
            },
            select: {
                id: true,
                name: true,
                date_of_birth: true,
                gender: true,
                photo_url: true,
            }
        })

        if (!profiles) {
            return NextResponse.json(
                { error: 'Profile not found' },
                { status: 404 }
            )
        }

        return NextResponse.json(profiles)
    } catch (error) {
        console.error('Route error:', error)
        return NextResponse.json(
            { error: 'Failed to fetch profiles ' + error },
            { status: 500 }
        )
    }
}
