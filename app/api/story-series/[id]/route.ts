import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedAdmin } from '@/lib/auth'
import { ValidationError, validateIntId, validateStorySeriesExists } from '@/lib/validators'

/**
 * @swagger
 * /api/story-series/{id}:
 *   get:
 *     summary: Get a story series by ID
 *     tags:
 *       - Story Series
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
 *         description: Story series details
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
        await validateStorySeriesExists(seriesId)

        const series = await prisma.storySeries.findUnique({
            where: { id: seriesId },
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
        })

        return NextResponse.json(series)
    } catch (error) {
        if (error instanceof ValidationError) {
            return NextResponse.json({ error: error.message }, { status: error.statusCode })
        }
        console.error('Get story series error:', error)
        return NextResponse.json({ error: 'Failed to get story series' }, { status: 500 })
    }
}

/**
 * @swagger
 * /api/story-series/{id}:
 *   put:
 *     summary: Update a story series
 *     tags:
 *       - Story Series
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
 *         description: Updated story series
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
        await validateStorySeriesExists(seriesId)

        const body = await request.json()
        const { name } = body

        if (!name || typeof name !== 'string' || !name.trim()) {
            throw new ValidationError('name is required', 400)
        }

        const updated = await prisma.storySeries.update({
            where: { id: seriesId },
            data: { name: name.trim() },
        })

        return NextResponse.json(updated)
    } catch (error) {
        if (error instanceof ValidationError) {
            return NextResponse.json({ error: error.message }, { status: error.statusCode })
        }
        console.error('Update story series error:', error)
        return NextResponse.json({ error: 'Failed to update story series' }, { status: 500 })
    }
}

/**
 * @swagger
 * /api/story-series/{id}:
 *   delete:
 *     summary: Delete a story series
 *     tags:
 *       - Story Series
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
        await validateStorySeriesExists(seriesId)

        await prisma.$transaction(async (tx) => {
            await tx.storySeriesStories.deleteMany({ where: { story_series_id: seriesId } })
            await tx.storySeries.delete({ where: { id: seriesId } })
        })

        return NextResponse.json({ message: 'Story series deleted successfully' })
    } catch (error) {
        if (error instanceof ValidationError) {
            return NextResponse.json({ error: error.message }, { status: error.statusCode })
        }
        console.error('Delete story series error:', error)
        return NextResponse.json({ error: 'Failed to delete story series' }, { status: 500 })
    }
}
