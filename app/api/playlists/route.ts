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
 *               - book_ids
 *             properties:
 *               profile_id:
 *                 type: integer
 *                 example: 1
 *               book_ids:
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
 *         description: Bad request - missing fields, empty book_ids, or books not found
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Profile or book not found
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
        const { profile_id, name, book_ids } = body

        if (!profile_id || !name || !book_ids) {
            return NextResponse.json(
                { error: 'profile_id, name, and book_ids are required' },
                { status: 400 }
            )
        }

        const profileIdParsed = parseInt(profile_id, 10)

        if (!Array.isArray(book_ids)) {
            return NextResponse.json(
                { error: 'book_ids must be an array' },
                { status: 400 }
            )
        }

        if (book_ids.length === 0) {
            return NextResponse.json(
                { error: 'book_ids array cannot be empty' },
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

        const books = await prisma.books.findMany({
            where: {
                id: { in: book_ids }
            }
        })

        if (books.length !== book_ids.length) {
            const foundIds = books.map(s => s.id)
            const missingIds = book_ids.filter(id => !foundIds.includes(id))
            return NextResponse.json(
                { error: `Books not found: ${missingIds.join(', ')}` },
                { status: 404 }
            )
        }

        const playlists = await prisma.playlists.create({
            data: {
                profile_id: profileIdParsed,
                name: name.trim(),
                playlistBooks: {
                    create: book_ids.map((book_id, index) => ({
                        book_id,
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