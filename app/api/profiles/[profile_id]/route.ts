import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

/**
 * @swagger
 * /api/profiles/{profile_id}:
 *   put:
 *     summary: Update a profile
 *     tags:
 *       - Profiles
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: profile_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Profile ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Child
 *               date_of_birth:
 *                 type: string
 *                 format: date
 *                 example: "2012-05-15"
 *               gender:
 *                 type: boolean
 *                 example: true
 *               photo:
 *                 type: string
 *                 description: Photo URL
 *                 example: https://cdn.example.com/avatar.jpg
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 name:
 *                   type: string
 *                 date_of_birth:
 *                   type: string
 *                   format: date
 *                 gender:
 *                   type: boolean
 *                 photo_url:
 *                   type: string
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Bad request - validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not your profile
 *       404:
 *         description: Profile not found
 *       409:
 *         description: Profile name already exists
 *       500:
 *         description: Server error
 */
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ profile_id: string }> }
) {
    try {
        const { user, error: authError } = await getAuthenticatedUser()
        if (authError) return authError

        const { profile_id } = await params
        const profileId = parseInt(profile_id, 10)

        if (isNaN(profileId)) {
            return NextResponse.json(
                { error: 'Invalid profile ID' },
                { status: 400 }
            )
        }

        const existingProfile = await prisma.profiles.findUnique({
            where: { id: profileId }
        })

        if (!existingProfile) {
            return NextResponse.json(
                { error: 'Profile not found' },
                { status: 404 }
            )
        }

        if (existingProfile.user_id !== user.id) {
            return NextResponse.json(
                { error: 'Forbidden - you can only update your own profiles' },
                { status: 403 }
            )
        }

        const formData = await request.formData()
        const name = formData.get('name') as string | null
        const date_of_birth = formData.get('date_of_birth') as string | null
        const gender = formData.get('gender') as string | null
        const photo = formData.get('photo') as string | null

        if (name !== null && name.trim().length === 0) {
            return NextResponse.json(
                { error: 'Name cannot be empty' },
                { status: 400 }
            )
        }

        let dateOfBirth: Date | null | undefined = undefined
        if (date_of_birth !== null && date_of_birth !== '') {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date_of_birth)) {
                return NextResponse.json(
                    { error: 'Invalid date format. Use YYYY-MM-DD' },
                    { status: 400 }
                )
            }

            dateOfBirth = new Date(date_of_birth)

            if (isNaN(dateOfBirth.getTime())) {
                return NextResponse.json(
                    { error: 'Invalid date' },
                    { status: 400 }
                )
            }

            if (dateOfBirth > new Date()) {
                return NextResponse.json(
                    { error: 'Date of birth cannot be in the future' },
                    { status: 400 }
                )
            }
        }

        if (name && name.trim().toLowerCase() !== existingProfile.name.toLowerCase()) {
            const duplicateProfile = await prisma.profiles.findFirst({
                where: {
                    name: { equals: name, mode: 'insensitive' },
                    user_id: user.id,
                    id: { not: profileId }
                }
            })

            if (duplicateProfile) {
                return NextResponse.json(
                    { error: 'Profile with this name already exists' },
                    { status: 409 }
                )
            }
        }

        const updateData: any = {
            ...(name && { name: name.trim() }),
            ...(dateOfBirth !== undefined && { date_of_birth: dateOfBirth }),
            ...(gender !== null && { gender: gender === 'true' || gender === '1' }),
            ...(photo && { photo_url: photo })
        }

        const updatedProfile = await prisma.profiles.update({
            where: { id: profileId },
            data: updateData
        })

        return NextResponse.json(updatedProfile)
    } catch (error) {
        console.error('Update profile error:', error)
        return NextResponse.json(
            { error: 'Failed to update profile ' + error },
            { status: 500 }
        )
    }
}

/**
 * @swagger
 * /api/profiles/{profile_id}:
 *   delete:
 *     summary: Delete a profile
 *     description: Deletes a profile and all its associated playlists, favorites, and category preferences
 *     tags:
 *       - Profiles
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: profile_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Profile ID
 *     responses:
 *       200:
 *         description: Profile deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Profile deleted successfully
 *                 id:
 *                   type: integer
 *                 deleted:
 *                   type: object
 *                   properties:
 *                     playlistStories:
 *                       type: integer
 *                     playlists:
 *                       type: integer
 *                     favorites:
 *                       type: integer
 *                     profileCategories:
 *                       type: integer
 *                     photo:
 *                       type: boolean
 *       400:
 *         description: Invalid profile ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not your profile
 *       404:
 *         description: Profile not found
 *       500:
 *         description: Server error
 */
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ profile_id: string }> }
) {
    try {
        const { user, error: authError } = await getAuthenticatedUser()
        if (authError) return authError

        const { profile_id } = await params
        const profileId = parseInt(profile_id, 10)

        if (isNaN(profileId)) {
            return NextResponse.json(
                { error: 'Invalid profile ID' },
                { status: 400 }
            )
        }

        const profile = await prisma.profiles.findUnique({
            where: { id: profileId },
            include: {
                profileCategories: true,
                favorites: true,
                playlists: {
                    include: {
                        playlistStories: true
                    }
                }
            }
        })

        if (!profile) {
            return NextResponse.json(
                { error: 'Profile not found' },
                { status: 404 }
            )
        }

        if (profile.user_id !== user.id) {
            return NextResponse.json(
                { error: 'Forbidden - you can only delete your own profiles' },
                { status: 403 }
            )
        }

        const playlistIds = profile.playlists.map(p => p.id)

        const result = await prisma.$transaction(async (tx) => {
            const deletedPlaylistStories = playlistIds.length > 0
                ? await tx.playlistStories.deleteMany({
                    where: { playlist_id: { in: playlistIds } }
                })
                : { count: 0 }

            const deletedPlaylists = await tx.playlists.deleteMany({
                where: { profile_id: profileId }
            })

            const deletedFavorites = await tx.favorites.deleteMany({
                where: { profile_id: profileId }
            })

            const deletedProfileCategories = await tx.profileCategories.deleteMany({
                where: { profile_id: profileId }
            })

            await tx.profiles.delete({
                where: { id: profileId }
            })

            return {
                deletedPlaylistStories: deletedPlaylistStories.count,
                deletedPlaylists: deletedPlaylists.count,
                deletedFavorites: deletedFavorites.count,
                deletedProfileCategories: deletedProfileCategories.count,
            }
        })

        return NextResponse.json({
            message: 'Profile deleted successfully',
            id: profileId,
            deleted: {
                playlistStories: result.deletedPlaylistStories,
                playlists: result.deletedPlaylists,
                favorites: result.deletedFavorites,
                profileCategories: result.deletedProfileCategories,
                photo: !!profile.photo_url
            }
        })
    } catch (error) {
        console.error('Delete profile error:', error)
        return NextResponse.json(
            { error: 'Failed to delete profile ' + error },
            { status: 500 }
        )
    }
}

/**
 * @swagger
 * /api/profiles/{profile_id}:
 *   get:
 *     summary: Get a profile by ID
 *     tags:
 *       - Profiles
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: profile_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Profile ID
 *     responses:
 *       200:
 *         description: Profile details with category preferences
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 user_id:
 *                   type: string
 *                   format: uuid
 *                 name:
 *                   type: string
 *                 date_of_birth:
 *                   type: string
 *                   format: date
 *                   nullable: true
 *                 gender:
 *                   type: boolean
 *                 photo_url:
 *                   type: string
 *                   nullable: true
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *                 profileCategories:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       category:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           photo_url:
 *                             type: string
 *                             nullable: true
 *                           categoryTranslations:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 id:
 *                                   type: integer
 *                                 name:
 *                                   type: string
 *                                 language_id:
 *                                   type: integer
 *       400:
 *         description: Invalid profile ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not your profile
 *       404:
 *         description: Profile not found
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ profile_id: string }> }
) {
    try {
        const { user, error: authError } = await getAuthenticatedUser()
        if (authError) return authError

        const { profile_id } = await params
        const profileId = parseInt(profile_id, 10)

        if (isNaN(profileId)) {
            return NextResponse.json(
                { error: 'Invalid profile ID' },
                { status: 400 }
            )
        }

        const profile = await prisma.profiles.findUnique({
            where: { id: profileId },
            include: {
                profileCategories: {
                    include: {
                        category: {
                            include: {
                                categoryTranslations: true
                            }
                        }
                    }
                }
            }
        })

        if (!profile) {
            return NextResponse.json(
                { error: 'Profile not found' },
                { status: 404 }
            )
        }

        if (profile.user_id !== user.id) {
            return NextResponse.json(
                { error: 'Forbidden - you can only view your own profiles' },
                { status: 403 }
            )
        }

        return NextResponse.json(profile)
    } catch (error) {
        console.error('Get profile error:', error)
        return NextResponse.json(
            { error: 'Failed to fetch profile ' + error },
            { status: 500 }
        )
    }
}
