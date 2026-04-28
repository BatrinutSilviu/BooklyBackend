import { NextResponse } from 'next/server'
import {prisma} from "@/lib/prisma";
import {getAuthenticatedUser} from "@/lib/auth";

/**
 * @swagger
 * /api/profiles/{profile_id}/categories/languages/{language_id}:
 *   get:
 *     summary: Gets all the categories of a profile
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
 *         description: The profile ID
 *       - in: path
 *         name: language_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The language ID
 *     responses:
 *       200:
 *         description: List of profile category preferences with translated names
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     description: ProfileCategory ID
 *                   category:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       photo_url:
 *                         type: string
 *                         nullable: true
 *                       categoryTranslations:
 *                         type: array
 *                         description: Contains one translation for the requested language
 *                         items:
 *                           type: object
 *                           properties:
 *                             name:
 *                               type: string
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

        if (isNaN(profileIdParsed) || profileIdParsed < 1) {
            return NextResponse.json(
                { error: 'Invalid profile ID' },
                { status: 400 }
            )
        }

        if (isNaN(languageIdParsed) || languageIdParsed < 1) {
            return NextResponse.json(
                { error: 'Invalid language ID' },
                { status: 400 }
            )
        }

        const existingProfile = await prisma.profiles.findFirst({
            where: {
                id: profileIdParsed
            }
        })

        if (!existingProfile) {
            return NextResponse.json(
                { error: 'Profile not found' },
                { status: 404 }
            )
        }

        const existingLanguage = await prisma.languages.findFirst({
            where: {
                id: languageIdParsed
            }
        })

        if (!existingLanguage) {
            return NextResponse.json(
                { error: 'Language not found' },
                { status: 404 }
            )
        }

        const profileCategories = await prisma.profileCategories.findMany({
            where: {
                profile_id : profileIdParsed
            },
            select: {
                id: true,
                category: {
                    select: {
                        id: true,
                        photo_url: true,
                        status: true,
                        categoryTranslations: {
                            where: {
                                language_id: languageIdParsed
                            },
                            select: {
                                name: true
                            }
                        }
                    }
                },
            }
        })

        if (!profileCategories) {
            return NextResponse.json(
                { error: 'Profile categories not found' },
                { status: 404 }
            )
        }

        return NextResponse.json(profileCategories)
    } catch (error) {
        console.error('Route error:', error)
        return NextResponse.json(
            { error: 'Failed to fetch categories: ' + error },
            { status: 500 }
        )
    }
}
