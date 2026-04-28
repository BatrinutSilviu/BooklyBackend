import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

/**
 * @swagger
 * /api/playlists/{playlist_id}/books/{book_id}:
 *   delete:
 *     summary: Remove book from playlist
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
 *         name: book_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Book ID
 *     responses:
 *       200:
 *         description: Book removed from playlist successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Book removed from playlist successfully
 *       400:
 *         description: Invalid playlist ID or book ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not your playlist
 *       404:
 *         description: Playlist, book, or playlist entry not found
 *       500:
 *         description: Server error
 */
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ playlist_id: string; book_id: string }> }
) {
    try {
        const { user, error: authError } = await getAuthenticatedUser()
        if (authError) return authError

        const { playlist_id, book_id } = await params

        if (!playlist_id || !book_id) {
            return NextResponse.json(
                { error: 'playlist_id or book_id are required' },
                { status: 400 }
            )
        }

        const parsedPlaylistId = parseInt(playlist_id, 10)
        const parsedBookId = parseInt(book_id, 10)

        const existingPlaylist = await prisma.playlists.findUnique({
            where: { id: parsedPlaylistId }
        })

        if (!existingPlaylist) {
            return NextResponse.json(
                { error: 'Playlist not found' },
                { status: 404 }
            )
        }

        const existingBook = await prisma.books.findUnique({
            where: { id: parsedBookId }
        })

        if (!existingBook) {
            return NextResponse.json(
                { error: 'Book not found' },
                { status: 404 }
            )
        }

        const playlist = await prisma.playlists.findUnique({
            where: { id: parsedPlaylistId },
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
                { error: 'Forbidden' },
                { status: 403 }
            )
        }

        const playlistBook = await prisma.playlistBooks.findFirst({
            where: {
                playlist_id: parsedPlaylistId,
                book_id: parsedBookId
            }
        })

        if (!playlistBook) {
            return NextResponse.json(
                { error: 'Book not found in playlist' },
                { status: 404 }
            )
        }

        await prisma.playlistBooks.delete({
            where: {
                id: playlistBook.id
            }
        })

        await prisma.playlistBooks.updateMany({
            where: {
                playlist_id: parsedPlaylistId,
                order: {
                    gt: playlistBook.order
                }
            },
            data: {
                order: {
                    decrement: 1
                }
            }
        })

        return NextResponse.json({
            message: 'Book removed from playlist successfully'
        })
    } catch (error) {
        console.error('Remove book from playlist error:', error)
        return NextResponse.json(
            { error: 'Failed to remove book from playlist' },
            { status: 500 }
        )
    }
}
