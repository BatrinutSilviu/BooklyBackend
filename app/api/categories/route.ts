import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedAdmin } from '@/lib/auth'
import { uploadPhoto } from '@/lib/upload'
import { ValidationError, validateIntId, validateRequired, validateLanguageExists } from '@/lib/validators'

/**
 * @swagger
 * /api/categories:
 *   get:
 *     summary: Get all categories
 *     description: Returns paginated categories with their translations in all languages
 *     tags:
 *       - Categories
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
 *         description: Filter categories that have a translation in this language
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Filter by name (case-insensitive partial match). Scoped to language_id if also provided.
 *     responses:
 *       200:
 *         description: Paginated list of categories
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
 *                       status:
 *                         type: boolean
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       categoryTranslations:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: integer
 *                             name:
 *                               type: string
 *                             language:
 *                               type: object
 *                               properties:
 *                                 id:
 *                                   type: integer
 *                                 name:
 *                                   type: string
 *                                 country_code:
 *                                   type: string
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
        const { searchParams } = new URL(request.url)
        const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10) || 20))
        const skip = (page - 1) * limit

        const languageId = searchParams.get('language_id') ? parseInt(searchParams.get('language_id')!, 10) : null
        const name = searchParams.get('name')?.trim() || null

        const where = languageId || name ? {
            categoryTranslations: {
                some: {
                    ...(languageId ? { language_id: languageId } : {}),
                    ...(name ? { name: { contains: name, mode: 'insensitive' as const } } : {})
                }
            }
        } : {}

        const [total, categories] = await Promise.all([
            prisma.categories.count({ where }),
            prisma.categories.findMany({
                where,
                include: {
                    categoryTranslations: {
                        include: {
                            language: {
                                select: { id: true, name: true, country_code: true }
                            }
                        },
                        orderBy: { language: { name: 'asc' } }
                    },
                    _count: {
                        select: { bookCategories: true, profileCategories: true }
                    }
                },
                orderBy: { id: 'asc' },
                skip,
                take: limit
            })
        ])

        return NextResponse.json({
            data: categories,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
        })
    } catch (error) {
        console.error('Get categories error:', error)
        return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
    }
}

/**
 * @swagger
 * /api/categories:
 *   post:
 *     summary: Create one or more categories with photos
 *     description: >
 *       Accepts multipart/form-data. Send a JSON array in the `categories` field
 *       (each item needs `name` and `language_id`) and one photo per item as
 *       `photo_0`, `photo_1`, … matching the array index.
 *     tags:
 *       - Categories
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - categories
 *               - photo
 *             properties:
 *               categories:
 *                 type: string
 *                 description: JSON array of category objects
 *                 example: '[{"name":"Sports","language_id":1},{"name":"Music","language_id":1}]'
 *               photo:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: One photo file per category, in the same order as the categories array
 *     responses:
 *       201:
 *         description: Categories created successfully
 *       400:
 *         description: Bad request - validation error
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: One or more categories already exist
 *       500:
 *         description: Server error
 */
export async function POST(request: Request) {
    try {
        const { user, error: authError } = await getAuthenticatedAdmin()
        if (authError) return authError

        const formData = await request.formData()
        const categoriesRaw = formData.get('categories') as string | null
        validateRequired(categoriesRaw, 'categories')

        let items: { name: string; language_id: number }[]
        try {
            const parsed = JSON.parse(categoriesRaw as string)
            if (!Array.isArray(parsed) || parsed.length === 0) {
                throw new ValidationError('categories must be a non-empty JSON array', 400)
            }
            items = parsed
        } catch (e) {
            if (e instanceof ValidationError) throw e
            throw new ValidationError('categories must be a valid JSON array', 400)
        }

        const photos = formData.getAll('photo') as File[]
        if (photos.length !== items.length) {
            throw new ValidationError(`Expected ${items.length} photo(s), got ${photos.length}`, 400)
        }

        // Validate all language IDs and check for duplicates
        await Promise.all(items.map((item, i) => {
            validateRequired(item.name, `categories[${i}].name`)
            validateIntId(item.language_id, `categories[${i}].language_id`)
            return validateLanguageExists(item.language_id)
        }))

        const duplicates = await prisma.categoryTranslations.findMany({
            where: {
                OR: items.map(item => ({
                    name: { equals: item.name.trim(), mode: 'insensitive' as const },
                    language_id: item.language_id
                }))
            },
            select: { name: true, language_id: true }
        })
        if (duplicates.length > 0) {
            const names = duplicates.map(d => `"${d.name}" (language ${d.language_id})`).join(', ')
            return NextResponse.json({ error: `Categories already exist: ${names}` }, { status: 409 })
        }

        const photoUrls = await Promise.all(
            photos.map((photo, i) => uploadPhoto(photo, 'category', user.id, `category ${i}`))
        )

        const include = {
            categoryTranslations: {
                include: { language: { select: { id: true, name: true, country_code: true } } }
            },
            _count: { select: { bookCategories: true, profileCategories: true } }
        }

        const created = await Promise.all(
            items.map((item, i) =>
                prisma.categories.create({
                    data: {
                        photo_url: photoUrls[i],
                        categoryTranslations: {
                            create: { name: item.name.trim(), language_id: item.language_id }
                        }
                    },
                    include
                })
            )
        )

        return NextResponse.json(created, { status: 201 })
    } catch (error) {
        if (error instanceof ValidationError) {
            return NextResponse.json({ error: error.message }, { status: error.statusCode })
        }
        if (error instanceof Error && error.message.includes('Unique constraint')) {
            return NextResponse.json({ error: 'Category already exists' }, { status: 409 })
        }
        console.error('Create category error:', error)
        return NextResponse.json({ error: 'Failed to create category' }, { status: 500 })
    }
}