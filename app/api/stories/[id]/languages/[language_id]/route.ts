import { NextResponse } from 'next/server'
import {prisma} from "@/lib/prisma";
import {getAuthenticatedUser} from "@/lib/auth";

/**
 * @swagger
 * /api/stories/{story_id}/languages/{language_id}:
 *   get:
 *     summary: Gets a story translation by language
 *     tags:
 *       - Stories
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: story_id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: language_id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: pages
 *         schema:
 *           type: integer
 *           default: 5
 *         description: Number of pages to return
 *     responses:
 *       200:
 *         description: Story translation with paginated pages
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     description: StoryTranslation ID
 *                   title:
 *                     type: string
 *                   description:
 *                     type: string
 *                     nullable: true
 *                   story:
 *                     type: object
 *                     properties:
 *                       photo_url:
 *                         type: string
 *                         nullable: true
 *                   language:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       country_code:
 *                         type: string
 *                   storyPages:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         page_number:
 *                           type: integer
 *                         text_content:
 *                           type: string
 *                         photo_url:
 *                           type: string
 *                           nullable: true
 *                         audio_url:
 *                           type: string
 *                           nullable: true
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
        const storyIdParsed = parseInt(id, 10)
        const languageIdParsed = parseInt(language_id, 10)

        const { searchParams } = new URL(request.url)
        const pages = parseInt(searchParams.get('pages') || '5', 10)

        const storyTranslations = await prisma.storyTranslations.findMany({
            where: {
                story_id : storyIdParsed,
                language_id: languageIdParsed
            },
            select: {
                id: true,
                title: true,
                description: true,
                story: {
                    select: {
                        photo_url: true,
                        status: true
                    }
                },
                language: {
                    select: {
                        id: true,
                        name: true,
                        country_code: true,
                    }
                },
                storyPages: {
                    take: pages,
                    orderBy: {
                        id: 'asc'
                    },
                    select: {
                        id: true,
                        page_number: true,
                        text_content: true,
                        photo_url: true,
                        audio_url: true
                    }
                }
            }
        })

        if (!storyTranslations) {
            return NextResponse.json(
                { error: 'Profile not found' },
                { status: 404 }
            )
        }

        return NextResponse.json(storyTranslations)
    } catch (error) {
        console.error('Route error:', error)
        return NextResponse.json(
            { error: 'Failed to fetch profile: ' + error },
            { status: 500 }
        )
    }
}
