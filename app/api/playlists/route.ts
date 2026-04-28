import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

/**
 * @swagger
 * /api/playlists:
 *   post:
 *     summary: Creates a new playlist
 *     tags:
 *       - Playlists
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - profile_id
 *               - story_ids
 *             properties:
 *               profile_id:
 *                 type: integer
 *                 example: 1
 *               story_ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 example: [1, 3, 4]
 *               name:
 *                 type: string
 *                 example: Gym
 *     responses:
 *       201:
 *         description: Playlist created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 profile_id:
 *                   type: integer
 *                 name:
 *                   type: string
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Bad request - missing fields, empty story_ids, or stories not found
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Profile or story not found
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
        const { profile_id, name, story_ids } = body

        if (!profile_id || !name || !story_ids) {
            return NextResponse.json(
                { error: 'profile_id, name, and story_ids are required' },
                { status: 400 }
            )
        }

        const profileIdParsed = parseInt(profile_id, 10)

        if (!Array.isArray(story_ids)) {
            return NextResponse.json(
                { error: 'story_ids must be an array' },
                { status: 400 }
            )
        }

        if (story_ids.length === 0) {
            return NextResponse.json(
                { error: 'story_ids array cannot be empty' },
                { status: 400 }
            )
        }

        if (name.trim().length === 0) {
            return NextResponse.json(
                { error: 'name cannot be empty' },
                { status: 400 }
            )
        }

        const profile = await prisma.profiles.findUnique({
            where: { id: profileIdParsed }
        })

        if (!profile) {
            return NextResponse.json(
                { error: 'Profile not found' },
                { status: 404 }
            )
        }

        const stories = await prisma.stories.findMany({
            where: {
                id: { in: story_ids }
            }
        })

        if (stories.length !== story_ids.length) {
            const foundIds = stories.map(s => s.id)
            const missingIds = story_ids.filter(id => !foundIds.includes(id))
            return NextResponse.json(
                { error: `Stories not found: ${missingIds.join(', ')}` },
                { status: 404 }
            )
        }

        const playlists = await prisma.playlists.create({
            data: {
                profile_id: profileIdParsed,
                name: name.trim(),
                playlistStories: {
                    create: story_ids.map((story_id, index) => ({
                        story_id,
                        order: index
                    }))
                }
            },
        })

        return NextResponse.json(playlists, { status: 201 })
    } catch (error) {
        console.error('Create profile error:', error)

        if (error instanceof Error) {
            if (error.message.includes('Unique constraint')) {
                return NextResponse.json(
                    { error: 'Playlist already exists' },
                    { status: 409 }
                )
            }
        }

        return NextResponse.json(
            { error: 'Failed to create playlit: ' + error },
            { status: 500 }
        )
    }
}