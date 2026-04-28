import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedAdmin } from '@/lib/auth'

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users (admin only)
 *     description: Returns paginated users with their profiles.
 *     tags:
 *       - Users
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
 *         description: Filter by email (case-insensitive partial match)
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           example: authenticated
 *         description: Filter by user role field (exact match)
 *     responses:
 *       200:
 *         description: Paginated list of users
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
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
 *       403:
 *         description: Forbidden - Admin access required
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
        const role = searchParams.get('role')?.trim() || null

        const where = {
            ...(name ? { email: { contains: name, mode: 'insensitive' as const } } : {}),
            ...(role ? { role } : {})
        }

        const [total, users] = await Promise.all([
            prisma.user.count({ where }),
            prisma.user.findMany({
                where,
                include: { profiles: true },
                orderBy: { created_at: 'asc' },
                skip,
                take: limit
            })
        ])

        return NextResponse.json({
            data: users,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
        })
    } catch (error) {
        console.error('Get users error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
