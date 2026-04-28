import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedAdmin } from '@/lib/auth'
import { ValidationError, validateStoriesExist, validateJsonArray } from '@/lib/validators'

/**
 * @swagger
 * /api/story-series:
 *   get:
 *     summary: Get all story series
 *     tags:
 *       - Story Series
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
 *         description: Paginated list of story series
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
            prisma.storySeries.count({ where }),
            prisma.storySeries.findMany({
                where,
                orderBy: { created_at: 'desc' },
                skip,
                take: limit,
                include: {
                    storySeriesStories: {
                        include: {
                            story: {
                                include: {
                                    storyTranslations: {
                                        include: {
                                            language: true,
                                            storyPages: { orderBy: { page_number: 'asc' } },
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
        console.error('Get story series error:', error)
        return NextResponse.json({ error: 'Failed to get story series' }, { status: 500 })
    }
}

/**
 * @swagger
 * /api/story-series:
 *   post:
 *     summary: Create a story series
 *     tags:
 *       - Story Series
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
 *               story_ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: Optional list of story IDs to assign to this series
 *     responses:
 *       201:
 *         description: Created story series
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
        const { name, story_ids } = body

        if (!name || typeof name !== 'string' || !name.trim()) {
            throw new ValidationError('name is required', 400)
        }

        const storyIds: number[] = Array.isArray(story_ids) ? story_ids : []
        if (storyIds.length > 0) await validateStoriesExist(storyIds)

        const series = await prisma.storySeries.create({
            data: {
                name: name.trim(),
                storySeriesStories: storyIds.length > 0 ? {
                    create: storyIds.map((story_id: number) => ({ story_id }))
                } : undefined,
            },
            include: {
                storySeriesStories: {
                    include: { story: true },
                },
            },
        })

        return NextResponse.json(series, { status: 201 })
    } catch (error) {
        if (error instanceof ValidationError) {
            return NextResponse.json({ error: error.message }, { status: error.statusCode })
        }
        console.error('Create story series error:', error)
        return NextResponse.json({ error: 'Failed to create story series' }, { status: 500 })
    }
}
