import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedAdmin } from '@/lib/auth'
import { ValidationError, validateBooksExist, validateJsonArray } from '@/lib/validators'

/**
 * @swagger
 * /api/book-series:
 *   get:
 *     summary: Get all book series
 *     tags:
 *       - Book Series
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Items per page
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Filter by name (case-insensitive partial match)
 *     responses:
 *       200:
 *         description: Paginated list of book series
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
export async function GET(request: Request) {
    try {
        const { error: authError } = await getAuthenticatedAdmin()
        if (authError) return authError

        const { searchParams } = new URL(request.url)
        const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10) || 20))
        const skip = (page - 1) * limit
        const name = searchParams.get('name')?.trim() || null

        const where = name ? { name: { contains: name, mode: 'insensitive' as const } } : {}

        const [total, series] = await prisma.$transaction([
            prisma.bookSeries.count({ where }),
            prisma.bookSeries.findMany({
                where,
                orderBy: { created_at: 'desc' },
                skip,
                take: limit,
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
            }),
        ])

        return NextResponse.json({
            data: series,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
        })
    } catch (error) {
        console.error('Get book series error:', error)
        return NextResponse.json({ error: 'Failed to get book series' }, { status: 500 })
    }
}

/**
 * @swagger
 * /api/book-series:
 *   post:
 *     summary: Create a book series
 *     tags:
 *       - Book Series
 *     security:
 *       - BearerAuth: []
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
 *               book_ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: Optional list of book IDs to assign to this series
 *     responses:
 *       201:
 *         description: Created book series
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
export async function POST(request: Request) {
    try {
        const { error: authError } = await getAuthenticatedAdmin()
        if (authError) return authError

        const body = await request.json()
        const { name, book_ids } = body

        if (!name || typeof name !== 'string' || !name.trim()) {
            throw new ValidationError('name is required', 400)
        }

        const bookIds: number[] = Array.isArray(book_ids) ? book_ids : []
        if (bookIds.length > 0) await validateBooksExist(bookIds)

        const series = await prisma.bookSeries.create({
            data: {
                name: name.trim(),
                bookSeriesBooks: bookIds.length > 0 ? {
                    create: bookIds.map((book_id: number) => ({ book_id }))
                } : undefined,
            },
            include: {
                bookSeriesBooks: {
                    include: { book: true },
                },
            },
        })

        return NextResponse.json(series, { status: 201 })
    } catch (error) {
        if (error instanceof ValidationError) {
            return NextResponse.json({ error: error.message }, { status: error.statusCode })
        }
        console.error('Create book series error:', error)
        return NextResponse.json({ error: 'Failed to create book series' }, { status: 500 })
    }
}
