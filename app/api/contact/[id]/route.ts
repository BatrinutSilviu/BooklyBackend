import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedAdmin } from '@/lib/auth'
import {
    ValidationError,
    validateIntId,
    validateContactMessageExists,
} from '@/lib/validators'

/**
 * @swagger
 * /api/contact/{id}:
 *   get:
 *     summary: Get a single Contact Us message (admin only)
 *     tags:
 *       - Contact
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
 *         description: Contact message details
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin access required
 *       404:
 *         description: Contact message not found
 *       500:
 *         description: Server error
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { error: authError } = await getAuthenticatedAdmin()
        if (authError) return authError

        const { id } = await params
        const messageId = validateIntId(id, 'message ID')
        const message = await validateContactMessageExists(messageId)

        return NextResponse.json(message)
    } catch (error) {
        if (error instanceof ValidationError) {
            return NextResponse.json({ error: error.message }, { status: error.statusCode })
        }
        console.error('Get contact message error:', error)
        return NextResponse.json({ error: 'Failed to fetch contact message' }, { status: 500 })
    }
}

/**
 * @swagger
 * /api/contact/{id}:
 *   patch:
 *     summary: Mark a Contact Us message as read or unread (admin only)
 *     tags:
 *       - Contact
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
 *               - is_read
 *             properties:
 *               is_read:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Contact message updated
 *       400:
 *         description: Bad request - invalid is_read value
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin access required
 *       404:
 *         description: Contact message not found
 *       500:
 *         description: Server error
 */
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { error: authError } = await getAuthenticatedAdmin()
        if (authError) return authError

        const { id } = await params
        const messageId = validateIntId(id, 'message ID')
        await validateContactMessageExists(messageId)

        const body = await request.json().catch(() => {
            throw new ValidationError('Invalid JSON body', 400)
        })

        if (typeof body.is_read !== 'boolean') {
            throw new ValidationError('is_read must be a boolean', 400)
        }

        const updated = await prisma.contactMessages.update({
            where: { id: messageId },
            data: { is_read: body.is_read }
        })

        return NextResponse.json(updated)
    } catch (error) {
        if (error instanceof ValidationError) {
            return NextResponse.json({ error: error.message }, { status: error.statusCode })
        }
        console.error('Update contact message error:', error)
        return NextResponse.json({ error: 'Failed to update contact message' }, { status: 500 })
    }
}

/**
 * @swagger
 * /api/contact/{id}:
 *   delete:
 *     summary: Delete a Contact Us message (admin only)
 *     tags:
 *       - Contact
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
 *         description: Contact message deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin access required
 *       404:
 *         description: Contact message not found
 *       500:
 *         description: Server error
 */
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { error: authError } = await getAuthenticatedAdmin()
        if (authError) return authError

        const { id } = await params
        const messageId = validateIntId(id, 'message ID')
        await validateContactMessageExists(messageId)

        await prisma.contactMessages.delete({ where: { id: messageId } })

        return NextResponse.json({ message: 'Contact message deleted successfully', id: messageId })
    } catch (error) {
        if (error instanceof ValidationError) {
            return NextResponse.json({ error: error.message }, { status: error.statusCode })
        }
        console.error('Delete contact message error:', error)
        return NextResponse.json({ error: 'Failed to delete contact message' }, { status: 500 })
    }
}
