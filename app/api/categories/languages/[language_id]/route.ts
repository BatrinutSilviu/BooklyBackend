import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

/**
 * @swagger
 * /api/categories/languages/{language_id}:
 *   get:
 *     summary: Gets all the categories by language
 *     tags:
 *       - Categories
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: language_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of category translations for the given language, sorted by name
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     description: CategoryTranslation ID
 *                   name:
 *                     type: string
 *                     example: Adventure
 *                   category:
 *                     type: object
 *                     properties:
 *                       photo_url:
 *                         type: string
 *                         nullable: true
 *       400:
 *         description: Invalid language ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Language not found
 *       500:
 *         description: Server error
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ language_id: string }> }
) {
    try {
        const { user, error } = await getAuthenticatedUser()

        if (error) {
            return error
        }

        const { language_id } = await params
        const languageIdParsed = parseInt(language_id, 10)

        if (isNaN(languageIdParsed) || languageIdParsed < 1) {
            return NextResponse.json(
                { error: 'Invalid language ID' },
                { status: 400 }
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

        const categories = await prisma.categoryTranslations.findMany({
            where: {
                language_id: languageIdParsed
            },
            select: {
                id: true,
                name: true,
                category: {
                    select: {
                        photo_url: true,
                        status: true,
                    }
                }
            },
            orderBy: {
                name: 'asc'
            },
        })

        if (!categories) {
            return NextResponse.json(
                { error: 'Categories not found' },
                { status: 404 }
            )
        }

        return NextResponse.json(categories)
    } catch (error) {
        console.error('Route error:', error)
        return NextResponse.json(
            { error: 'Failed to fetch categories: ' + error },
            { status: 500 }
        )
    }
}