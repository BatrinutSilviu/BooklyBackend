import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

/**
 * @swagger
 * /api/favorites/profiles/{profile_id}/stories/{story_id}:
 *   delete:
 *     summary: Remove a favorite story
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
 *         name: story_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Story ID
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
 *                 story_id:
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
    { params }: { params: Promise<{ profile_id: string; story_id: string }> }
) {
    try {
        const { user, error: authError } = await getAuthenticatedUser()
        if (authError) return authError

        const { profile_id, story_id } = await params
        const profileIdParsed = parseInt(profile_id, 10)
        const storyIdParsed = parseInt(story_id, 10)

        if (isNaN(profileIdParsed) || isNaN(storyIdParsed)) {
            return NextResponse.json(
                { error: 'Invalid profile ID or story ID' },
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

        const existingStory = await prisma.stories.findUnique({
            where: { id: storyIdParsed }
        })

        if (!existingStory) {
            return NextResponse.json(
                { error: 'Story not found' },
                { status: 404 }
            )
        }

        const favorite = await prisma.favorites.findFirst({
            where: {
                profile_id: profileIdParsed,
                story_id: storyIdParsed
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
            story_id: storyIdParsed
        })
    } catch (error) {
        console.error('Remove favorite error:', error)
        return NextResponse.json(
            { error: 'Failed to remove favorite' },
            { status: 500 }
        )
    }
}
