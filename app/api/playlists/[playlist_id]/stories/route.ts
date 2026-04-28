import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

/**
 * @swagger
 * /api/playlists/{playlist_id}/stories:
 *   post:
 *     summary: Add story to playlist
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
 *               - story_id
 *             properties:
 *               story_id:
 *                 type: integer
 *                 description: ID of the story to add
 *                 example: 5
 *               position:
 *                 type: integer
 *                 description: Position in playlist (optional, defaults to end)
 *                 example: 2
 *     responses:
 *       201:
 *         description: Story added to playlist successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 playlist_id:
 *                   type: integer
 *                 story_id:
 *                   type: integer
 *                 order:
 *                   type: integer
 *                 story:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     photo_url:
 *                       type: string
 *                       nullable: true
 *                     storyTranslations:
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
 *         description: Playlist or story not found
 *       409:
 *         description: Story already in playlist
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
        const { story_id, position } = body

        if (!story_id || typeof story_id !== 'number') {
            return NextResponse.json(
                { error: 'story_id is required and must be a number' },
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
                playlistStories: {
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

        const story = await prisma.stories.findUnique({
            where: { id: story_id }
        })

        if (!story) {
            return NextResponse.json(
                { error: 'Story not found' },
                { status: 404 }
            )
        }

        const existingPlaylistStory = await prisma.playlistStories.findFirst({
            where: {
                playlist_id: parsedPlaylistId,
                story_id: story_id
            }
        })

        if (!existingPlaylistStory) {
            return NextResponse.json(
                { error: 'Story already exists in this playlist' },
                { status: 409 }
            )
        }

        let newOrder: number

        if (position !== undefined && typeof position === 'number') {
            const validPosition = Math.max(0, Math.min(position, playlist.playlistStories.length))
            newOrder = validPosition

            await prisma.playlistStories.updateMany({
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
            newOrder = playlist.playlistStories.length
        }

        const playlistStory = await prisma.playlistStories.create({
            data: {
                playlist_id: parsedPlaylistId,
                story_id: story_id,
                order: newOrder
            },
            include: {
                story: {
                    include: {
                        storyTranslations: {
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

        return NextResponse.json(playlistStory, { status: 201 })
    } catch (error) {
        console.error('Add story to playlist error:', error)
        return NextResponse.json(
            { error: 'Failed to add story to playlist' },
            { status: 500 }
        )
    }
}
