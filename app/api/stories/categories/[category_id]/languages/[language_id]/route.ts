import { NextResponse } from 'next/server'
import {prisma} from "@/lib/prisma";
import {getAuthenticatedUser} from "@/lib/auth";

/**
 * @swagger
 * /api/stories/categories/{category_id}/languages/{language_id}:
 *   get:
 *     summary: Gets all the stories from a category by language
 *     tags:
 *       - Stories
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: category_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The category ID
 *       - in: path
 *         name: language_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The language ID
 *     responses:
 *       200:
 *         description: List of stories in the category with translation for the given language
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     description: StoryCategory ID
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
 *                         description: Contains one translation for the requested language, sorted by title
 *                         items:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: integer
 *                             title:
 *                               type: string
 *                             description:
 *                               type: string
 *                               nullable: true
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ category_id: string, language_id: string }> }
) {
    try {
        const { user, error } = await getAuthenticatedUser()

        if (error) {
            return error
        }

        const { category_id, language_id } = await params
        const categoryIdParsed = parseInt(category_id, 10)
        const languageIdParsed = parseInt(language_id, 10)

        const storyCategories = await prisma.storyCategories.findMany({
            where: {
                category_id : categoryIdParsed,
            },
            select: {
                id: true,
                story: {
                    select: {
                        id: true,
                        photo_url: true,
                        status: true,
                        storyTranslations: {
                            where: {
                                language_id: languageIdParsed
                            },
                            select: {
                                id: true,
                                title: true,
                                description: true,
                            },
                            orderBy: {
                                title: 'asc'
                            },
                        }
                    }
                },
            }
        })

        if (!storyCategories) {
            return NextResponse.json(
                { error: 'Profile not found' },
                { status: 404 }
            )
        }

        return NextResponse.json(storyCategories)
    } catch (error) {
        console.error('Route error:', error)
        return NextResponse.json(
            { error: 'Failed to fetch profile: ' + error },
            { status: 500 }
        )
    }
}
