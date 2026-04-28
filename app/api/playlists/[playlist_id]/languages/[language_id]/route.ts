import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import {
    validateLanguageExists,
    validatePlaylistExists
} from '@/lib/validators'

/**
 * @swagger
 * /api/playlists/{playlist_id}/languages/{language_id}:
 *   get:
 *     summary: Get a playlist by ID
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
 *       - in: path
 *         name: language_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Language ID
 *     responses:
 *       200:
 *         description: Playlist with books and their translations for the given language
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
 *                 playlistBooks:
 *                   type: array
 *                   description: Sorted by order ascending
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       playlist_id:
 *                         type: integer
 *                       book_id:
 *                         type: integer
 *                       order:
 *                         type: integer
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       book:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           photo_url:
 *                             type: string
 *                             nullable: true
 *                           bookTranslations:
 *                             type: array
 *                             description: Contains one translation for the requested language
 *                             items:
 *                               type: object
 *                               properties:
 *                                 id:
 *                                   type: integer
 *                                 title:
 *                                   type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not your playlist
 *       404:
 *         description: Playlist or language not found
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ playlist_id: string, language_id: string }> }
) {
    try {
        const { user, error: authError } = await getAuthenticatedUser()
        if (authError) return authError

        const { playlist_id, language_id } = await params

        const [inputLanguage, inputPlaylist] = await Promise.all([
            validateLanguageExists(language_id),
            validatePlaylistExists(playlist_id)
        ])

        const playlist = await prisma.playlists.findUnique({
            where: { id: inputPlaylist.id },
            include: {
                profile: {
                    select: {
                        user_id: true,
                    }
                },
                playlistBooks: {
                    orderBy: {
                        order: 'asc'
                    },
                    include: {
                        book: {
                            include: {
                                bookTranslations: {
                                    select: {
                                        id: true,
                                        title: true,
                                    },
                                    where: {
                                        language_id: inputLanguage.id
                                    }
                                }
                            }
                        }
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
                { error: 'Forbidden - you can only view your own playlists' },
                { status: 403 }
            )
        }

        return NextResponse.json(playlist)
    } catch (error) {
        console.error('Get playlist error:', error)
        return NextResponse.json(
            { error: 'Failed to fetch playlist' },
            { status: 500 }
        )
    }
}
