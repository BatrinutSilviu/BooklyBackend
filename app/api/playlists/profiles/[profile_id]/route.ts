import { NextResponse } from 'next/server'
import {prisma} from "@/lib/prisma";
import {getAuthenticatedUser} from "@/lib/auth";

/**
 * @swagger
 * /api/playlists/profiles/{profile_id}:
 *   get:
 *     summary: Gets all the playlists of a profile
 *     tags:
 *       - Playlists
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: profile_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The profile ID
 *     responses:
 *       200:
 *         description: List of playlists for the profile with book entries sorted by order
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   name:
 *                     type: string
 *                   playlistBooks:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         order:
 *                           type: integer
 *                         book_id:
 *                           type: integer
 *       400:
 *         description: Invalid profile ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Profile not found
 *       500:
 *         description: Server error
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ profile_id: string }> }
) {
    try {
        const { user, error } = await getAuthenticatedUser()

        if (error) {
            return error
        }

        const { profile_id } = await params

        if (!profile_id) {
            return NextResponse.json(
                { error: 'profile_id is required' },
                { status: 400 }
            )
        }

        const profileIdParsed = parseInt(profile_id, 10)

        const existingProfile = await prisma.profiles.findUnique({
            where: { id: profileIdParsed }
        })

        if (!existingProfile) {
            return NextResponse.json(
                { error: 'Profile not found' },
                { status: 404 }
            )
        }

        const playlist = await prisma.playlists.findMany({
            where: {
                profile_id : profileIdParsed
            },
            select: {
                id: true,
                name: true,
                playlistBooks: {
                    select: {
                        id: true,
                        order: true,
                        book_id: true,
                    },
                    orderBy: {
                        order: 'asc'
                    }
                },
            }
        })

        if (!playlist) {
            return NextResponse.json(
                { error: 'Playlist not found' },
                { status: 404 }
            )
        }

        return NextResponse.json(playlist)
    } catch (error) {
        console.error('Route error:', error)
        return NextResponse.json(
            { error: 'Failed to fetch playlist: ' + error },
            { status: 500 }
        )
    }
}
