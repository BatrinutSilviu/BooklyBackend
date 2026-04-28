import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedAdmin, getAuthenticatedUser } from '@/lib/auth'
import { uploadPhoto } from '@/lib/upload'
import {
    ValidationError,
    validateIntId,
    validateRequired,
    validateJsonArray,
    validatePages,
    validateLanguageExists,
    validateCategoriesExist,
} from '@/lib/validators'

/**
 * @swagger
 * /api/stories:
 *   get:
 *     summary: Get all stories
 *     description: Returns paginated stories with their translations, pages, and categories
 *     tags:
 *       - Stories
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
 *         name: language_id
 *         schema:
 *           type: integer
 *         description: Filter stories that have a translation in this language
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Filter by title (case-insensitive partial match). Scoped to language_id if also provided.
 *       - in: query
 *         name: category_id
 *         schema:
 *           type: integer
 *         description: Filter stories belonging to this category
 *     responses:
 *       200:
 *         description: Paginated list of stories
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
 *                       photo_url:
 *                         type: string
 *                         nullable: true
 *                       duration:
 *                         type: integer
 *                         nullable: true
 *                       status:
 *                         type: boolean
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       storyCategories:
 *                         type: array
 *                         items:
 *                           type: object
 *                       storyTranslations:
 *                         type: array
 *                         items:
 *                           type: object
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
        const { error: authError } = await getAuthenticatedUser()
        if (authError) return authError

        const { searchParams } = new URL(request.url)
        const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10) || 20))
        const skip = (page - 1) * limit

        const languageId = searchParams.get('language_id') ? parseInt(searchParams.get('language_id')!, 10) : null
        const name = searchParams.get('name')?.trim() || null
        const categoryId = searchParams.get('category_id') ? parseInt(searchParams.get('category_id')!, 10) : null

        const where = {
            ...(languageId || name ? {
                storyTranslations: {
                    some: {
                        ...(languageId ? { language_id: languageId } : {}),
                        ...(name ? { title: { contains: name, mode: 'insensitive' as const } } : {})
                    }
                }
            } : {}),
            ...(categoryId ? {
                storyCategories: { some: { category_id: categoryId } }
            } : {})
        }

        const [total, stories] = await Promise.all([
            prisma.stories.count({ where }),
            prisma.stories.findMany({
                where,
                include: {
                    storyCategories: {
                        include: {
                            category: {
                                include: {
                                    categoryTranslations: {
                                        include: {
                                            language: {
                                                select: { id: true, name: true, country_code: true }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    storyTranslations: {
                        include: {
                            language: {
                                select: { id: true, name: true, country_code: true }
                            },
                            storyPages: { orderBy: { page_number: 'asc' } }
                        }
                    }
                },
                orderBy: { id: 'asc' },
                skip,
                take: limit
            })
        ])

        return NextResponse.json({
            data: stories,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
        })
    } catch (error) {
        console.error('Get stories error:', error)
        return NextResponse.json({ error: 'Failed to fetch stories' }, { status: 500 })
    }
}

/**
 * @swagger
 * /api/stories:
 *   post:
 *     summary: Create a story with pages and upload photos (admin only)
 *     description: |
 *       Creates a story with a language-specific title and one page per entry.
 *       Each page has its own text and optionally its own photo.
 *
 *       Send as `multipart/form-data`. Page metadata is passed as a JSON string
 *       in the `pages` field. Page photos are uploaded as separate file fields
 *       named `page_photo_{page_number}` (e.g. `page_photo_1`, `page_photo_2`).
 *     tags:
 *       - Stories
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - language_id
 *               - title
 *               - pages
 *             properties:
 *               language_id:
 *                 type: integer
 *                 example: 1
 *               title:
 *                 type: string
 *                 example: The Great Adventure
 *               description:
 *                 type: string
 *               series_ids:
 *                 type: string
 *                 description: JSON array of series IDs to assign the story to (e.g. [1,2])
 *               category_ids:
 *                 type: string
 *                 description: JSON array of category IDs, e.g. "[1, 2]"
 *                 example: "[1, 2]"
 *               story_photo:
 *                 type: string
 *                 format: binary
 *                 description: Cover photo for the story (JPEG, PNG, WebP, or GIF, max 5MB)
 *               pages:
 *                 type: string
 *                 description: |
 *                   JSON array of page objects. Each object must have `page_number` (integer)
 *                   and `text_content` (string).
 *                 example: '[{"page_number":1,"text_content":"Once upon a time..."},{"page_number":2,"text_content":"The end."}]'
 *               page_photo_{page_number}:
 *                 type: string
 *                 format: binary
 *                 description: |
 *                   Optional photo for a specific page. Replace `{page_number}` with the
 *                   actual page number, e.g. `page_photo_1`, `page_photo_2`.
 *                   Accepts JPEG, PNG, WebP, or GIF, max 5MB.
 *     responses:
 *       201:
 *         description: Story created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 photo_url:
 *                   type: string
 *                   nullable: true
 *                 status:
 *                   type: boolean
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *                 storyCategories:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       category:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           categoryTranslations:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 id:
 *                                   type: integer
 *                                 name:
 *                                   type: string
 *                                 language_id:
 *                                   type: integer
 *                 storyTranslations:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       title:
 *                         type: string
 *                       description:
 *                         type: string
 *                         nullable: true
 *                       language:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           name:
 *                             type: string
 *                           country_code:
 *                             type: string
 *                       storyPages:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: integer
 *                             page_number:
 *                               type: integer
 *                             text_content:
 *                               type: string
 *                             photo_url:
 *                               type: string
 *                               nullable: true
 *       400:
 *         description: Bad request - missing required fields, invalid JSON, or invalid file
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin access required
 *       404:
 *         description: Language or category not found
 *       500:
 *         description: Server error
 */
export async function POST(request: Request) {
    try {
        const { user, error: authError } = await getAuthenticatedAdmin()
        if (authError) return authError

        const formData = await request.formData()

        const title = formData.get('title') as string | null
        const description = formData.get('description') as string | null
        const series_ids_raw = formData.get('series_ids') as string | null
        const category_ids_raw = formData.get('category_ids') as string | null
        const pages_raw = formData.get('pages') as string | null
        const story_photo = formData.get('story_photo') as File | null

        validateRequired(title, 'title')
        const languageId = validateIntId(formData.get('language_id'), 'language_id')
        const pages = validatePages(validateJsonArray(pages_raw, 'pages'))
        await validateLanguageExists(languageId)

        const category_ids = category_ids_raw
            ? validateJsonArray<number>(category_ids_raw, 'category_ids', 0)
            : []
        if (category_ids.length > 0) await validateCategoriesExist(category_ids)

        const series_ids = series_ids_raw
            ? validateJsonArray<number>(series_ids_raw, 'series_ids', 0)
            : []

        // Upload story cover photo if provided
        const story_photo_url = story_photo && story_photo.size > 0
            ? await uploadPhoto(story_photo, 'story-cover', user.id)
            : null

        // Upload per-page photos in parallel
        const pagePhotoResults = await Promise.all(
            pages.map(async (page) => {
                const pagePhoto = formData.get(`page_photo_${page.page_number}`) as File | null
                if (!pagePhoto || pagePhoto.size === 0) return { page_number: page.page_number, url: null }
                const url = await uploadPhoto(pagePhoto, 'story-page', user.id, `page ${page.page_number}`)
                return { page_number: page.page_number, url }
            })
        )

        const pagePhotoUrls = Object.fromEntries(
            pagePhotoResults.map(r => [r.page_number, r.url])
        )

        const story = await prisma.stories.create({
            data: {
                photo_url: story_photo_url,
                storySeriesStories: series_ids.length > 0 ? {
                    create: series_ids.map((story_series_id: number) => ({ story_series_id }))
                } : undefined,
                storyCategories: category_ids.length > 0 ? {
                    create: category_ids.map((category_id: number) => ({ category_id }))
                } : undefined,
                storyTranslations: {
                    create: {
                        language_id: languageId,
                        title: (title as string).trim(),
                        description: description?.trim() || null,
                        storyPages: {
                            create: pages.map(page => ({
                                page_number: page.page_number,
                                text_content: page.text_content,
                                photo_url: pagePhotoUrls[page.page_number] ?? null,
                            }))
                        }
                    }
                }
            },
            include: {
                storyCategories: {
                    include: {
                        category: {
                            include: { categoryTranslations: true }
                        }
                    }
                },
                storyTranslations: {
                    include: {
                        language: true,
                        storyPages: { orderBy: { page_number: 'asc' } }
                    }
                }
            }
        })

        return NextResponse.json(story, { status: 201 })
    } catch (error) {
        if (error instanceof ValidationError) {
            return NextResponse.json({ error: error.message }, { status: error.statusCode })
        }
        console.error('Create complete story error:', error)
        return NextResponse.json({ error: 'Failed to create story' }, { status: 500 })
    }
}
