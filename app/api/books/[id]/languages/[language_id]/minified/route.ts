import { NextResponse } from 'next/server'
import {prisma} from "@/lib/prisma";
import {getAuthenticatedUser} from "@/lib/auth";

/**
 * @swagger
 * /api/books/{book_id}/languages/{language_id}/minified:
 *   get:
 *     summary: Gets a summary book translation by language
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
 *       - in: path
 *         name: language_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Book summary without pages (title, description, cover and duration)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     description: BookTranslation ID
 *                   title:
 *                     type: string
 *                   description:
 *                     type: string
 *                     nullable: true
 *                   book:
 *                     type: object
 *                     properties:
 *                       photo_url:
 *                         type: string
 *                         nullable: true
 *                       duration:
 *                         type: integer
 *                         nullable: true
 *                         description: Book duration in seconds
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string; language_id: string }> }
) {
    try {
        const { user, error } = await getAuthenticatedUser()

        if (error) {
            return error
        }

        const { id, language_id } = await params
        const bookIdParsed = parseInt(id, 10)
        const languageIdParsed = parseInt(language_id, 10)

        const bookTranslations = await prisma.bookTranslations.findMany({
            where: {
                book_id : bookIdParsed,
                language_id: languageIdParsed
            },
            select: {
                id: true,
                title: true,
                description: true,
                book: {
                    select: {
                        photo_url: true,
                        duration: true,
                        status: true
                    }
                }
            }
        })

        if (!bookTranslations) {
            return NextResponse.json(
                { error: 'Profile not found' },
                { status: 404 }
            )
        }

        return NextResponse.json(bookTranslations)
    } catch (error) {
        console.error('Route error:', error)
        return NextResponse.json(
            { error: 'Failed to fetch profile: ' + error },
            { status: 500 }
        )
    }
}
