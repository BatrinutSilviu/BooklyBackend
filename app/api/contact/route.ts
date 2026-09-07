import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedAdmin } from '@/lib/auth'
import {
    ValidationError,
    validateRequired,
    validateEmailFormat,
} from '@/lib/validators'

/**
 * @swagger
 * /api/contact:
 *   post:
 *     summary: Submit a Contact Us message
 *     description: Public endpoint used by the app's Contact Us form. Does not require authentication.
 *     tags:
 *       - Contact
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - message
 *             properties:
 *               name:
 *                 type: string
 *                 example: John Doe
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john@example.com
 *               message:
 *                 type: string
 *                 example: I'd like to report an issue with a book.
 *     responses:
 *       201:
 *         description: Message submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 name:
 *                   type: string
 *                 email:
 *                   type: string
 *                 message:
 *                   type: string
 *                 is_read:
 *                   type: boolean
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Bad request - missing or invalid fields
 *       500:
 *         description: Server error
 */
export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => {
            throw new ValidationError('Invalid JSON body', 400)
        })

        const name = typeof body.name === 'string' ? body.name.trim() : ''
        const email = typeof body.email === 'string' ? body.email.trim() : ''
        const message = typeof body.message === 'string' ? body.message.trim() : ''

        validateRequired(name, 'name')
        validateRequired(email, 'email')
        validateRequired(message, 'message')
        validateEmailFormat(email)

        const contactMessage = await prisma.contactMessages.create({
            data: { name, email, message }
        })

        return NextResponse.json(contactMessage, { status: 201 })
    } catch (error) {
        if (error instanceof ValidationError) {
            return NextResponse.json({ error: error.message }, { status: error.statusCode })
        }
        const message = error instanceof Error ? error.message : 'Unknown error'
        console.error('Create contact message error:', error)
        return NextResponse.json({ error: `Failed to submit message: ${message}` }, { status: 500 })
    }
}

/**
 * @swagger
 * /api/contact:
 *   get:
 *     summary: Get all Contact Us messages (admin only)
 *     description: Returns paginated contact messages, newest first
 *     tags:
 *       - Contact
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
 *         name: is_read
 *         schema:
 *           type: boolean
 *         description: Filter by read status
 *     responses:
 *       200:
 *         description: Paginated list of contact messages
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
 *                       email:
 *                         type: string
 *                       message:
 *                         type: string
 *                       is_read:
 *                         type: boolean
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
 *                 unread_count:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin access required
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

        const isReadParam = searchParams.get('is_read')
        const is_read = isReadParam === 'true' ? true : isReadParam === 'false' ? false : undefined

        const where = is_read !== undefined ? { is_read } : {}

        const [total, unread_count, data] = await Promise.all([
            prisma.contactMessages.count({ where }),
            prisma.contactMessages.count({ where: { is_read: false } }),
            prisma.contactMessages.findMany({
                where,
                orderBy: { created_at: 'desc' },
                skip,
                take: limit
            })
        ])

        return NextResponse.json({
            data,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
            unread_count
        })
    } catch (error) {
        if (error instanceof ValidationError) {
            return NextResponse.json({ error: error.message }, { status: error.statusCode })
        }
        console.error('Get contact messages error:', error)
        return NextResponse.json({ error: 'Failed to fetch contact messages' }, { status: 500 })
    }
}
