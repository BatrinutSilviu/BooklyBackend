import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

/**
 * @swagger
 * /api/playlists/{playlist_id}:
 *   put:
 *     summary: Update playlist name
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
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: New name for the playlist
 *                 example: My Favorite Books
 *     responses:
 *       200:
 *         description: Playlist updated successfully
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
 *                 profile:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     name:
 *                       type: string
 *                 _count:
 *                   type: object
 *                   properties:
 *                     playlistBooks:
 *                       type: integer
 *       400:
 *         description: Bad request - validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - playlist doesn't belong to user
 *       404:
 *         description: Playlist not found
 *       500:
 *         description: Server error
 */
export async function PUT(
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

        const playlistIdParsed = parseInt(playlist_id, 10)

        if (isNaN(playlistIdParsed)) {
            return NextResponse.json(
                { error: 'Invalid playlist ID' },
                { status: 400 }
            )
        }

        const existingPlaylist = await prisma.playlists.findUnique({
            where: { id: playlistIdParsed }
        })

        if (!existingPlaylist) {
            return NextResponse.json(
                { error: 'Playlist not found' },
                { status: 404 }
            )
        }

        const body = await request.json()
        const { name } = body

        if (!name || name.trim().length === 0) {
            return NextResponse.json(
                { error: 'Name is required and cannot be empty' },
                { status: 400 }
            )
        }

        const playlist = await prisma.playlists.findUnique({
            where: { id: playlistIdParsed },
            include: {
                profile: {
                    select: {
                        user_id: true
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
                { error: 'Forbidden - you can only update your own playlists' },
                { status: 403 }
            )
        }

        const updatedPlaylist = await prisma.playlists.update({
            where: { id: playlistIdParsed },
            data: {
                name: name.trim()
            },
            include: {
                profile: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                _count: {
                    select: {
                        playlistBooks: true
                    }
                }
            }
        })

        return NextResponse.json(updatedPlaylist)
    } catch (error) {
        console.error('Update playlist error:', error)
        return NextResponse.json(
            { error: 'Failed to update playlist' },
            { status: 500 }
        )
    }
}

/**
 * @swagger
 * /api/playlists/{playlist_id}:
 *   delete:
 *     summary: Delete a playlist
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
 *     responses:
 *       200:
 *         description: Playlist deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Playlist deleted successfully
 *                 id:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - playlist doesn't belong to user
 *       404:
 *         description: Playlist not found
 *       500:
 *         description: Server error
 */
export async function DELETE(
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

        const playlistIdParsed = parseInt(playlist_id, 10)

        if (isNaN(playlistIdParsed)) {
            return NextResponse.json(
                { error: 'Invalid playlist ID' },
                { status: 400 }
            )
        }

        const existingPlaylist = await prisma.playlists.findUnique({
            where: { id: playlistIdParsed }
        })

        if (!existingPlaylist) {
            return NextResponse.json(
                { error: 'Playlist not found' },
                { status: 404 }
            )
        }

        const playlist = await prisma.playlists.findUnique({
            where: { id: playlistIdParsed },
            include: {
                profile: {
                    select: {
                        user_id: true
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
                { error: 'Forbidden - you can only delete your own playlists' },
                { status: 403 }
            )
        }

        await prisma.playlists.delete({
            where: { id: playlistIdParsed }
        })

        return NextResponse.json({
            message: 'Playlist deleted successfully',
            id: playlistIdParsed
        })
    } catch (error) {
        console.error('Delete playlist error:', error)
        return NextResponse.json(
            { error: 'Failed to delete playlist' },
            { status: 500 }
        )
    }
}
