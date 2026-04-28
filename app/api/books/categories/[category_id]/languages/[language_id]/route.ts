import { NextResponse } from 'next/server'
import {prisma} from "@/lib/prisma";
import {getAuthenticatedUser} from "@/lib/auth";

/**
 * @swagger
 * /api/books/categories/{category_id}/languages/{language_id}:
 *   get:
 *     summary: Gets all the books from a category by language
 *     tags:
 *       - Books
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
 *         description: List of books in the category with translation for the given language
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     description: BookCategory ID
 *                   book:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       photo_url:
 *                         type: string
 *                         nullable: true
 *                       bookTranslations:
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

        const bookCategories = await prisma.bookCategories.findMany({
            where: {
                category_id : categoryIdParsed,
            },
            select: {
                id: true,
                book: {
                    select: {
                        id: true,
                        photo_url: true,
                        status: true,
                        bookTranslations: {
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

        if (!bookCategories) {
            return NextResponse.json(
                { error: 'Profile not found' },
                { status: 404 }
            )
        }

        return NextResponse.json(bookCategories)
    } catch (error) {
        console.error('Route error:', error)
        return NextResponse.json(
            { error: 'Failed to fetch profile: ' + error },
            { status: 500 }
        )
    }
}
