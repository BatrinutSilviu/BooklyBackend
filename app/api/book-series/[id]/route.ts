import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedAdmin } from '@/lib/auth'
import { ValidationError, validateIntId, validateBookSeriesExists } from '@/lib/validators'

/**
 * @swagger
 * /api/book-series/{id}:
 *   get:
 *     summary: Get a book series by ID
 *     tags:
 *       - Book Series
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Book series details
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 */
export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { error: authError } = await getAuthenticatedAdmin()
        if (authError) return authError

        const { id } = await params
        const seriesId = validateIntId(id, 'series ID')
        await validateBookSeriesExists(seriesId)

        const series = await prisma.bookSeries.findUnique({
            where: { id: seriesId },
            include: {
                bookSeriesBooks: {
                    include: {
                        book: {
                            include: {
                                bookTranslations: {
                                    include: {
                                        language: true,
                                        bookPages: { orderBy: { page_number: 'asc' } },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        })

        return NextResponse.json(series)
    } catch (error) {
        if (error instanceof ValidationError) {
            return NextResponse.json({ error: error.message }, { status: error.statusCode })
        }
        console.error('Get book series error:', error)
        return NextResponse.json({ error: 'Failed to get book series' }, { status: 500 })
    }
}

/**
 * @swagger
 * /api/book-series/{id}:
 *   put:
 *     summary: Update a book series
 *     tags:
 *       - Book Series
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated book series
 *       400:
 *         description: Validation error
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 */
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { error: authError } = await getAuthenticatedAdmin()
        if (authError) return authError

        const { id } = await params
        const seriesId = validateIntId(id, 'series ID')
        await validateBookSeriesExists(seriesId)

        const body = await request.json()
        const { name } = body

        if (!name || typeof name !== 'string' || !name.trim()) {
            throw new ValidationError('name is required', 400)
        }

        const updated = await prisma.bookSeries.update({
            where: { id: seriesId },
            data: { name: name.trim() },
        })

        return NextResponse.json(updated)
    } catch (error) {
        if (error instanceof ValidationError) {
            return NextResponse.json({ error: error.message }, { status: error.statusCode })
        }
        console.error('Update book series error:', error)
        return NextResponse.json({ error: 'Failed to update book series' }, { status: 500 })
    }
}

/**
 * @swagger
 * /api/book-series/{id}:
 *   delete:
 *     summary: Delete a book series
 *     tags:
 *       - Book Series
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Deleted successfully
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 */
export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { error: authError } = await getAuthenticatedAdmin()
        if (authError) return authError

        const { id } = await params
        const seriesId = validateIntId(id, 'series ID')
        await validateBookSeriesExists(seriesId)

        await prisma.$transaction(async (tx) => {
            await tx.bookSeriesBooks.deleteMany({ where: { book_series_id: seriesId } })
            await tx.bookSeries.delete({ where: { id: seriesId } })
        })

        return NextResponse.json({ message: 'Book series deleted successfully' })
    } catch (error) {
        if (error instanceof ValidationError) {
            return NextResponse.json({ error: error.message }, { status: error.statusCode })
        }
        console.error('Delete book series error:', error)
        return NextResponse.json({ error: 'Failed to delete book series' }, { status: 500 })
    }
}
