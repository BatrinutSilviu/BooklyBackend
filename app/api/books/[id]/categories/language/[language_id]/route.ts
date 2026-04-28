import { NextResponse } from 'next/server'
import {prisma} from "@/lib/prisma";
import {getAuthenticatedUser} from "@/lib/auth";

/**
 * @swagger
 * /api/books/{book_id}/categories/language/{language_id}:
 *   get:
 *     summary: Gets all the categories of a book
 *     tags:
 *       - Books
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: book_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The book ID
 *       - in: path
 *         name: language_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The language ID
 *     responses:
 *       200:
 *         description: List of categories for the book with translated names
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
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string, language_id: string }> }
) {
    try {
        const { user, error } = await getAuthenticatedUser()

        if (error) {
            return error
        }

        const { id, language_id } = await params
        const bookIdParsed = parseInt(id, 10)
        const languageIdParsed = parseInt(language_id, 10)

        const bookCategories = await prisma.bookCategories.findMany({
            where: {
                book_id : bookIdParsed
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
