import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedAdmin } from '@/lib/auth'
import { ValidationError, validateUuidId } from '@/lib/validators'

/**
 * @swagger
 * /api/users/{user_id}:
 *   delete:
 *     summary: Delete a user (admin only)
 *     description: Deletes a standard (non-admin) user and all their associated data.
 *     tags:
 *       - Users
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User UUID
 *     responses:
 *       200:
 *         description: User deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User deleted successfully
 *                 id:
 *                   type: string
 *       400:
 *         description: Invalid user ID format
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin access required or target user is an admin
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ user_id: string }> }
) {
    try {
        const { error: authError } = await getAuthenticatedAdmin()
        if (authError) return authError

        const { user_id } = await params
        const userId = validateUuidId(user_id, 'user ID')

        const user = await prisma.user.findUnique({ where: { id: userId } })
        if (!user) {
            throw new ValidationError('User not found', 404)
        }

        if (user.role === 'admin') {
            return NextResponse.json({ error: 'Cannot delete an admin user' }, { status: 403 })
        }

        await prisma.$transaction(async (tx) => {
            const profiles = await tx.profiles.findMany({
                where: { user_id: userId },
                select: { id: true }
            })
            const profileIds = profiles.map(p => p.id)

            if (profileIds.length > 0) {
                const playlists = await tx.playlists.findMany({
                    where: { profile_id: { in: profileIds } },
                    select: { id: true }
                })
                const playlistIds = playlists.map(p => p.id)

                if (playlistIds.length > 0) {
                    await tx.playlistBooks.deleteMany({ where: { playlist_id: { in: playlistIds } } })
                }

                await tx.profileCategories.deleteMany({ where: { profile_id: { in: profileIds } } })
                await tx.favorites.deleteMany({ where: { profile_id: { in: profileIds } } })
                await tx.playlists.deleteMany({ where: { profile_id: { in: profileIds } } })
                await tx.profiles.deleteMany({ where: { user_id: userId } })
            }

            await tx.user.delete({ where: { id: userId } })
        })

        return NextResponse.json({ message: 'User deleted successfully', id: userId })
    } catch (error) {
        if (error instanceof ValidationError) {
            return NextResponse.json({ error: error.message }, { status: error.statusCode })
        }

        console.error('Delete user error:', error)
        return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
    }
}
