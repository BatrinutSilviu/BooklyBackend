import { NextResponse } from 'next/server'
import {prisma} from "@/lib/prisma";
import {getAuthenticatedUser} from "@/lib/auth";

/**
 * @swagger
 * /api/favorites/profiles/{profile_id}/languages/{language_id}:
 *   get:
 *     summary: Gets all the favorite stories of a profile
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
 *         description: The profile ID
 *       - in: path
 *         name: language_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The language ID
 *     responses:
 *       200:
 *         description: List of favorite stories for the profile with translation for the given language
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     description: Favorite ID
 *                   story:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       photo_url:
 *                         type: string
 *                         nullable: true
 *                       storyTranslations:
 *                         type: array
 *                         description: Contains one translation for the requested language
 *                         items:
 *                           type: object
 *                           properties:
 *                             title:
 *                               type: string
 *                             description:
 *                               type: string
 *                               nullable: true
 *       400:
 *         description: Invalid profile ID or language ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Profile or language not found
 *       500:
 *         description: Server error
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ profile_id: string, language_id: string }> }
) {
    try {
        const { user, error } = await getAuthenticatedUser()

        if (error) {
            return error
        }

        const { profile_id, language_id } = await params
        const profileIdParsed = parseInt(profile_id, 10)
        const languageIdParsed = parseInt(language_id, 10)

        if (isNaN(profileIdParsed) || isNaN(languageIdParsed)) {
            return NextResponse.json(
                { error: 'Invalid profile ID or language ID' },
                { status: 400 }
            )
        }

        const existingProfile = await prisma.profiles.findUnique({
            where: { id: profileIdParsed }
        })

        if (!existingProfile) {
            return NextResponse.json(
                { error: 'Profile not found' },
                { status: 404 }
            )
        }

        const existingLanguage = await prisma.languages.findUnique({
            where: { id: languageIdParsed }
        })

        if (!existingLanguage) {
            return NextResponse.json(
                { error: 'Language not found' },
                { status: 404 }
            )
        }

        const favorites = await prisma.favorites.findMany({
            where: {
                profile_id : profileIdParsed
            },
            select: {
                id: true,
                story: {
                    select: {
                        id: true,
                        photo_url: true,
                        status: true,
                        storyTranslations: {
                            select: {
                                title: true,
                                description: true,
                            },
                            where: {
                                language_id: languageIdParsed

                            }
                        },
                    },
                },
            }
        })

        if (!favorites) {
            return NextResponse.json(
                { error: 'Favorites not found' },
                { status: 404 }
            )
        }

        return NextResponse.json(favorites)
    } catch (error) {
        console.error('Route error:', error)
        return NextResponse.json(
            { error: 'Failed to fetch favorites: ' + error },
            { status: 500 }
        )
    }
}
