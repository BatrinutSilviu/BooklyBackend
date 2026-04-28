import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

/**
 * @swagger
 * /api/favorites:
 *   post:
 *     summary: Creates a new favorite
 *     tags:
 *       - Favorites
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - story_id
 *               - profile_id
 *             properties:
 *               story_id:
 *                 type: integer
 *                 example: 1
 *               profile_id:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       201:
 *         description: Favorite created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 profile_id:
 *                   type: integer
 *                 story_id:
 *                   type: integer
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Bad request - missing profile_id or story_id
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Profile or story not found
 *       409:
 *         description: Favorite already exists
 *       500:
 *         description: Server error
 */
export async function POST(request: Request) {
    try {
        const { user, error: authError } = await getAuthenticatedUser()
        if (authError) {
            return authError
        }

        const body = await request.json()
        const { profile_id, story_id } = body

        if (!profile_id || !story_id) {
            return NextResponse.json(
                { error: 'profile_id and story_id are required' },
                { status: 400 }
            )
        }

        const profileIdParsed = parseInt(profile_id, 10)
        const storyIdParsed = parseInt(story_id, 10)

        const existingProfile = await prisma.profiles.findUnique({
            where: { id: profileIdParsed }
        })

        if (!existingProfile) {
            return NextResponse.json(
                { error: 'Profile not found' },
                { status: 404 }
            )
        }

        const existingStory = await prisma.stories.findUnique({
            where: { id: storyIdParsed }
        })

        if (!existingStory) {
            return NextResponse.json(
                { error: 'Story not found' },
                { status: 404 }
            )
        }

        const existingFavorite = await prisma.favorites.findFirst({
            where: {
                profile_id: profileIdParsed,
                story_id: storyIdParsed,
            }
        })

        if (existingFavorite) {
            return NextResponse.json(
                { error: 'This favorite already exists' },
                { status: 409 }
            )
        }

        const favorite = await prisma.favorites.create({
            data: {
                story_id: storyIdParsed,
                profile_id: profileIdParsed,
            }
        })

        return NextResponse.json(favorite, { status: 201 })
    } catch (error) {
        console.error('Create favorite error:', error)

        if (error instanceof Error) {
            if (error.message.includes('Unique constraint')) {
                return NextResponse.json(
                    { error: 'Favorite already exists' },
                    { status: 409 }
                )
            }
        }

        return NextResponse.json(
            { error: 'Failed to create favorite: ' + error },
            { status: 500 }
        )
    }
}