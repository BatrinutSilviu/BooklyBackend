import { NextResponse } from 'next/server'
import {prisma} from "@/lib/prisma";
import {getAuthenticatedUser} from "@/lib/auth";

/**
 * @swagger
 * /api/books/{book_id}/languages:
 *   get:
 *     summary: Gets all translations of a book
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
 *     responses:
 *       200:
 *         description: List of book translations with language info
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
 *                   language:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       country_code:
 *                         type: string
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { user, error } = await getAuthenticatedUser()

        if (error) {
            return error
        }

        const { id } = await params
        const bookId = parseInt(id, 10)

        const bookTranslations = await prisma.bookTranslations.findMany({
            where: {
                book_id : bookId
            },
            select: {
                id: true,
                title: true,
                description: true,
                language: {
                    select: {
                        id: true,
                        name: true,
                        country_code: true,
                    }
                },
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
