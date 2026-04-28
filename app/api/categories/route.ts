import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedAdmin, getAuthenticatedUser } from '@/lib/auth'
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
        const { error: authError } = await getAuthenticatedUser()
        if (authError) return authError

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
 *     summary: Creates a new category with photo
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
 *               - name
 *               - language_id
 *               - photo
 *             properties:
 *               name:
 *                 type: string
 *                 example: Sports
 *               language_id:
 *                 type: string
 *                 example: 1
 *               photo:
 *                 type: string
 *                 format: binary
 *                 description: Category photo image file
 *     responses:
 *       201:
 *         description: Category created successfully
 *       400:
 *         description: Bad request - validation error
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: Category already exists
 *       500:
 *         description: Server error
 */
export async function POST(request: Request) {
    try {
        const { user, error: authError } = await getAuthenticatedAdmin()
        if (authError) return authError

        const formData = await request.formData()
        const name = formData.get('name') as string | null
        const photo = formData.get('photo') as File | null

        validateRequired(name, 'name')
        const languageId = validateIntId(formData.get('language_id'), 'language_id')
        await validateLanguageExists(languageId)
        validateRequired(photo, 'photo')

        const existingCategory = await prisma.categoryTranslations.findFirst({
            where: { name: { equals: (name as string).trim(), mode: 'insensitive' }, language_id: languageId }
        })
        if (existingCategory) {
            return NextResponse.json({ error: 'Category already exists' }, { status: 409 })
        }

        const photo_url = await uploadPhoto(photo as File, 'category', user.id)

        const category = await prisma.categories.create({
            data: {
                photo_url,
                categoryTranslations: {
                    create: { name: (name as string).trim(), language_id: languageId }
                }
            },
            include: {
                categoryTranslations: {
                    include: {
                        language: {
                            select: { id: true, name: true, country_code: true }
                        }
                    }
                },
                _count: {
                    select: { bookCategories: true, profileCategories: true }
                }
            }
        })

        return NextResponse.json(category, { status: 201 })
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