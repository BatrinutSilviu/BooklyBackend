import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

/**
 * @swagger
 * /api/playlists/{playlist_id}/books:
 *   post:
 *     summary: Add book to playlist
 *     tags:
 *       - Playlists
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: playlist_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Playlist ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - book_id
 *             properties:
 *               book_id:
 *                 type: integer
 *                 description: ID of the book to add
 *                 example: 5
 *               position:
 *                 type: integer
 *                 description: Position in playlist (optional, defaults to end)
 *                 example: 2
 *     responses:
 *       201:
 *         description: Book added to playlist successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 playlist_id:
 *                   type: integer
 *                 book_id:
 *                   type: integer
 *                 order:
 *                   type: integer
 *                 book:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     photo_url:
 *                       type: string
 *                       nullable: true
 *                     bookTranslations:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           title:
 *                             type: string
 *                           language_id:
 *                             type: integer
 *                           description:
 *                             type: string
 *                             nullable: true
 *                           language:
 *                             type: object
 *                             properties:
 *                               name:
 *                                 type: string
 *                               country_code:
 *                                 type: string
 *       400:
 *         description: Bad request - validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - playlist doesn't belong to user
 *       404:
 *         description: Playlist or book not found
 *       409:
 *         description: Book already in playlist
 *       500:
 *         description: Server error
 */
export async function POST(
    request: Request,
    { params }: { params: Promise<{ playlist_id: string }> }
) {
    try {
        const { user, error: authError } = await getAuthenticatedUser()
        if (authError) return authError

        const { playlist_id } = await params

        if (!playlist_id) {
            return NextResponse.json(
                { error: 'playlist_id is required' },
                { status: 400 }
            )
        }

        const parsedPlaylistId = parseInt(playlist_id, 10)

        if (isNaN(parsedPlaylistId)) {
            return NextResponse.json(
                { error: 'Invalid playlist ID' },
                { status: 400 }
            )
        }

        const body = await request.json()
        const { book_id, position } = body

        if (!book_id || typeof book_id !== 'number') {
            return NextResponse.json(
                { error: 'book_id is required and must be a number' },
                { status: 400 }
            )
        }

        const playlist = await prisma.playlists.findUnique({
            where: { id: parsedPlaylistId },
            include: {
                profile: {
                    select: {
                        user_id: true
                    }
                },
                playlistBooks: {
                    orderBy: {
                        order: 'asc'
                    }
                }
            }
        })

        if (!playlist) {
            return NextResponse.json(
                { error: 'Playlist not found' },
                { status: 404 }
            )
        }

        if (playlist.profile.user_id !== user.id) {
            return NextResponse.json(
                { error: 'Forbidden - you can only modify your own playlists' },
                { status: 403 }
            )
        }

        const book = await prisma.books.findUnique({
            where: { id: book_id }
        })

        if (!book) {
            return NextResponse.json(
                { error: 'Book not found' },
                { status: 404 }
            )
        }

        const existingPlaylistBook = await prisma.playlistBooks.findFirst({
            where: {
                playlist_id: parsedPlaylistId,
                book_id: book_id
            }
        })

        if (!existingPlaylistBook) {
            return NextResponse.json(
                { error: 'Book already exists in this playlist' },
                { status: 409 }
            )
        }

        let newOrder: number

        if (position !== undefined && typeof position === 'number') {
            const validPosition = Math.max(0, Math.min(position, playlist.playlistBooks.length))
            newOrder = validPosition

            await prisma.playlistBooks.updateMany({
                where: {
                    playlist_id: parsedPlaylistId,
                    order: {
                        gte: validPosition
                    }
                },
                data: {
                    order: {
                        increment: 1
                    }
                }
            })
        } else {
            newOrder = playlist.playlistBooks.length
        }

        const playlistBook = await prisma.playlistBooks.create({
            data: {
                playlist_id: parsedPlaylistId,
                book_id: book_id,
                order: newOrder
            },
            include: {
                book: {
                    include: {
                        bookTranslations: {
                            select: {
                                id: true,
                                title: true,
                                language_id: true,
                                description: true,
                                language: {
                                    select: {
                                        name: true,
                                        country_code: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        })

        return NextResponse.json(playlistBook, { status: 201 })
    } catch (error) {
        console.error('Add book to playlist error:', error)
        return NextResponse.json(
            { error: 'Failed to add book to playlist' },
            { status: 500 }
        )
    }
}
