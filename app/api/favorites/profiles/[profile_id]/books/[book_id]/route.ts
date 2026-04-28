import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

/**
 * @swagger
 * /api/favorites/profiles/{profile_id}/books/{book_id}:
 *   delete:
 *     summary: Remove a favorite book
 *     tags:
 *       - Favorites
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: profile_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Profile ID
 *       - in: path
 *         name: book_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Book ID
 *     responses:
 *       200:
 *         description: Favorite removed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Favorite removed successfully
 *                 profile_id:
 *                   type: integer
 *                 book_id:
 *                   type: integer
 *       400:
 *         description: Bad request - invalid IDs
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - profile doesn't belong to user
 *       404:
 *         description: Favorite not found
 *       500:
 *         description: Server error
 */
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ profile_id: string; book_id: string }> }
) {
    try {
        const { user, error: authError } = await getAuthenticatedUser()
        if (authError) return authError

        const { profile_id, book_id } = await params
        const profileIdParsed = parseInt(profile_id, 10)
        const bookIdParsed = parseInt(book_id, 10)

        if (isNaN(profileIdParsed) || isNaN(bookIdParsed)) {
            return NextResponse.json(
                { error: 'Invalid profile ID or book ID' },
                { status: 400 }
            )
        }

        const existingProfile = await prisma.profiles.findUnique({
            where: { id: profileIdParsed },
            select: { user_id: true }
        })

        if (!existingProfile) {
            return NextResponse.json(
                { error: 'Profile not found' },
                { status: 404 }
            )
        }

        if (existingProfile.user_id !== user.id) {
            return NextResponse.json(
                { error: 'Forbidden - you can only manage your own favorites' },
                { status: 403 }
            )
        }

        const existingBook = await prisma.books.findUnique({
            where: { id: bookIdParsed }
        })

        if (!existingBook) {
            return NextResponse.json(
                { error: 'Book not found' },
                { status: 404 }
            )
        }

        const favorite = await prisma.favorites.findFirst({
            where: {
                profile_id: profileIdParsed,
                book_id: bookIdParsed
            }
        })

        if (!favorite) {
            return NextResponse.json(
                { error: 'Favorite not found' },
                { status: 404 }
            )
        }

        await prisma.favorites.delete({
            where: {
                id: favorite.id
            }
        })

        return NextResponse.json({
            message: 'Favorite removed successfully',
            profile_id: profileIdParsed,
            book_id: bookIdParsed
        })
    } catch (error) {
        console.error('Remove favorite error:', error)
        return NextResponse.json(
            { error: 'Failed to remove favorite' },
            { status: 500 }
        )
    }
}
