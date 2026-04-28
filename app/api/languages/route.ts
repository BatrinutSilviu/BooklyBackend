import { NextResponse } from 'next/server'
import {prisma} from "@/lib/prisma";
import {getAuthenticatedUser} from "@/lib/auth";

/**
 * @swagger
 * /api/languages:
 *   get:
 *     summary: Gets all the languages
 *     tags:
 *       - Languages
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of all languages
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   name:
 *                     type: string
 *                     example: English
 *                   country_code:
 *                     type: string
 *                     example: en
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Languages not found
 *       500:
 *         description: Server error
 */
export async function GET(request: Request) {
    try {
        const { user, error } = await getAuthenticatedUser()

        if (error) {
            return error
        }

        const languages = await prisma.languages.findMany({
            select: {
                id: true,
                name: true,
                country_code: true
            }
        })

        if (!languages) {
            return NextResponse.json(
                { error: 'Languages not found' },
                { status: 404 }
            )
        }

        return NextResponse.json(languages)
    } catch (error) {
        console.error('Route error:', error)
        return NextResponse.json(
            { error: 'Failed to fetch languages: ' + error },
            { status: 500 }
        )
    }
}
