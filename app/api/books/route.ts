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
 * /api/books:
 *   get:
 *     summary: Get all books
 *     description: Returns paginated books with their translations, pages, and categories
 *     tags:
 *       - Books
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
 *         description: Filter books that have a translation in this language
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Filter by title (case-insensitive partial match). Scoped to language_id if also provided.
 *       - in: query
 *         name: category_id
 *         schema:
 *           type: integer
 *         description: Filter books belonging to this category
 *     responses:
 *       200:
 *         description: Paginated list of books
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
 *                       bookCategories:
 *                         type: array
 *                         items:
 *                           type: object
 *                       bookTranslations:
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
                bookTranslations: {
                    some: {
                        ...(languageId ? { language_id: languageId } : {}),
                        ...(name ? { title: { contains: name, mode: 'insensitive' as const } } : {})
                    }
                }
            } : {}),
            ...(categoryId ? {
                bookCategories: { some: { category_id: categoryId } }
            } : {})
        }

        const [total, books] = await Promise.all([
            prisma.books.count({ where }),
            prisma.books.findMany({
                where,
                include: {
                    bookCategories: {
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
                    bookTranslations: {
                        include: {
                            language: {
                                select: { id: true, name: true, country_code: true }
                            },
                            bookPages: { orderBy: { page_number: 'asc' } }
                        }
                    }
                },
                orderBy: { id: 'asc' },
                skip,
                take: limit
            })
        ])

        return NextResponse.json({
            data: books,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
        })
    } catch (error) {
        console.error('Get books error:', error)
        return NextResponse.json({ error: 'Failed to fetch books' }, { status: 500 })
    }
}

/**
 * @swagger
 * /api/books:
 *   post:
 *     summary: Create a book with pages and upload photos (admin only)
 *     description: |
 *       Creates a book with a language-specific title and one page per entry.
 *       Each page has its own text and optionally its own photo.
 *
 *       Send as `multipart/form-data`. Page metadata is passed as a JSON string
 *       in the `pages` field. Page photos are uploaded as separate file fields
 *       named `page_photo_{page_number}` (e.g. `page_photo_1`, `page_photo_2`).
 *     tags:
 *       - Books
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
 *               category_ids:
 *                 type: string
 *                 description: JSON array of category IDs, e.g. "[1, 2]"
 *                 example: "[1, 2]"
 *               book_photo:
 *                 type: string
 *                 format: binary
 *                 description: Cover photo for the book (JPEG, PNG, WebP, or GIF, max 5MB)
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
 *         description: Book created successfully
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
 *                 bookCategories:
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
 *                 bookTranslations:
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
 *                       bookPages:
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
        const category_ids_raw = formData.get('category_ids') as string | null
        const pages_raw = formData.get('pages') as string | null
        const book_photo = formData.get('book_photo') as File | null

        validateRequired(title, 'title')
        const languageId = validateIntId(formData.get('language_id'), 'language_id')
        const pages = validatePages(validateJsonArray(pages_raw, 'pages'))
        await validateLanguageExists(languageId)

        const category_ids = category_ids_raw
            ? validateJsonArray<number>(category_ids_raw, 'category_ids', 0)
            : []
        if (category_ids.length > 0) await validateCategoriesExist(category_ids)

        // Upload book cover photo if provided
        const book_photo_url = book_photo && book_photo.size > 0
            ? await uploadPhoto(book_photo, 'book-cover', user.id)
            : null

        // Upload per-page photos in parallel
        const pagePhotoResults = await Promise.all(
            pages.map(async (page) => {
                const pagePhoto = formData.get(`page_photo_${page.page_number}`) as File | null
                if (!pagePhoto || pagePhoto.size === 0) return { page_number: page.page_number, url: null }
                const url = await uploadPhoto(pagePhoto, 'book-page', user.id, `page ${page.page_number}`)
                return { page_number: page.page_number, url }
            })
        )

        const pagePhotoUrls = Object.fromEntries(
            pagePhotoResults.map(r => [r.page_number, r.url])
        )

        const book = await prisma.books.create({
            data: {
                photo_url: book_photo_url,
                bookCategories: category_ids.length > 0 ? {
                    create: category_ids.map((category_id: number) => ({ category_id }))
                } : undefined,
                bookTranslations: {
                    create: {
                        language_id: languageId,
                        title: (title as string).trim(),
                        description: description?.trim() || null,
                        bookPages: {
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
                bookCategories: {
                    include: {
                        category: {
                            include: { categoryTranslations: true }
                        }
                    }
                },
                bookTranslations: {
                    include: {
                        language: true,
                        bookPages: { orderBy: { page_number: 'asc' } }
                    }
                }
            }
        })

        return NextResponse.json(book, { status: 201 })
    } catch (error) {
        if (error instanceof ValidationError) {
            return NextResponse.json({ error: error.message }, { status: error.statusCode })
        }
        console.error('Create complete book error:', error)
        return NextResponse.json({ error: 'Failed to create book' }, { status: 500 })
    }
}
