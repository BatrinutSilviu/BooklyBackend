import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedAdmin, getAuthenticatedUser } from '@/lib/auth'
import { validateIntId, validateCategoryExists, ValidationError } from '@/lib/validators'
import { uploadPhoto, deletePhoto } from '@/lib/upload'

/**
 * @swagger
 * /api/categories/{category_id}:
 *   get:
 *     summary: Get a category by ID
 *     description: Returns category details with translations in all languages
 *     tags:
 *       - Categories
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: category_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Category ID
 *     responses:
 *       200:
 *         description: Category details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 photo_url:
 *                   type: string
 *                 status:
 *                   type: boolean
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *                 categoryTranslations:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       language:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           name:
 *                             type: string
 *                           country_code:
 *                             type: string
 *                 _count:
 *                   type: object
 *                   properties:
 *                     storyCategories:
 *                       type: integer
 *                     profileCategories:
 *                       type: integer
 *       400:
 *         description: Invalid category ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Category not found
 *       500:
 *         description: Server error
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ category_id: string }> }
) {
    try {
        const { error: authError } = await getAuthenticatedUser()
        if (authError) return authError

        const { category_id } = await params
        const categoryId = validateIntId(category_id, 'category ID')

        const category = await validateCategoryExists(categoryId)

        const fullCategory = await prisma.categories.findUnique({
            where: { id: categoryId },
            include: {
                categoryTranslations: {
                    include: {
                        language: {
                            select: {
                                id: true,
                                name: true,
                                country_code: true
                            }
                        }
                    },
                    orderBy: {
                        language: {
                            name: 'asc'
                        }
                    }
                },
                _count: {
                    select: {
                        storyCategories: true,
                        profileCategories: true
                    }
                }
            }
        })

        return NextResponse.json(fullCategory)
    } catch (error) {
        if (error instanceof ValidationError) {
            return NextResponse.json(
                { error: error.message },
                { status: error.statusCode }
            )
        }

        console.error('Get category error:', error)
        return NextResponse.json(
            { error: 'Failed to fetch category' },
            { status: 500 }
        )
    }
}

/**
 * @swagger
 * /api/categories/{category_id}:
 *   put:
 *     summary: Update a category photo (admin only)
 *     description: Replaces the category photo in R2 storage
 *     tags:
 *       - Categories
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: category_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Category ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               photo:
 *                 type: string
 *                 format: binary
 *                 description: New category photo (JPEG, PNG, WebP, or GIF, max 5MB)
 *     responses:
 *       200:
 *         description: Category updated successfully
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
 *                 categoryTranslations:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       category_id:
 *                         type: integer
 *                       language_id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       language:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           name:
 *                             type: string
 *                           country_code:
 *                             type: string
 *       400:
 *         description: Bad request - invalid file type or size
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin access required
 *       404:
 *         description: Category not found
 *       500:
 *         description: Server error
 */
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ category_id: string }> }
) {
    try {
        const { user, error: authError } = await getAuthenticatedAdmin()
        if (authError) return authError

        const { category_id } = await params
        const categoryId = validateIntId(category_id, 'category ID')

        const existingCategory = await validateCategoryExists(categoryId)

        const formData = await request.formData()
        const photo = formData.get('photo') as File | null
        const language_id_raw = formData.get('language_id') as string | null
        const name = formData.get('name') as string | null
        const status_raw = formData.get('status') as string | null
        const status = status_raw !== null ? status_raw === 'true' : undefined

        let photo_url: string | undefined = undefined

        if (photo && photo.size > 0) {
            if (existingCategory.photo_url) {
                try {
                    await deletePhoto(existingCategory.photo_url)
                } catch (deleteError) {
                    console.error('Failed to delete old photo:', deleteError)
                }
            }
            photo_url = await uploadPhoto(photo, 'category', user.id)
        }

        const updatedCategory = await prisma.$transaction(async (tx) => {
            const updateData: any = {}
            if (photo_url) updateData.photo_url = photo_url
            if (status !== undefined) updateData.status = status
            await tx.categories.update({ where: { id: categoryId }, data: updateData })

            if (language_id_raw && name) {
                const languageId = parseInt(language_id_raw, 10)
                if (!isNaN(languageId)) {
                    const existing = await tx.categoryTranslations.findFirst({
                        where: { category_id: categoryId, language_id: languageId }
                    })
                    if (existing) {
                        await tx.categoryTranslations.update({
                            where: { id: existing.id },
                            data: { name: name.trim() }
                        })
                    } else {
                        await tx.categoryTranslations.create({
                            data: { category_id: categoryId, language_id: languageId, name: name.trim() }
                        })
                    }
                }
            }

            return tx.categories.findUnique({
                where: { id: categoryId },
                include: {
                    categoryTranslations: { include: { language: true } },
                    _count: { select: { storyCategories: true, profileCategories: true } }
                }
            })
        })

        return NextResponse.json(updatedCategory)
    } catch (error) {
        if (error instanceof ValidationError) {
            return NextResponse.json(
                { error: error.message },
                { status: error.statusCode }
            )
        }

        console.error('Update category error:', error)
        return NextResponse.json(
            { error: 'Failed to update category' },
            { status: 500 }
        )
    }
}

/**
 * @swagger
 * /api/categories/{category_id}:
 *   delete:
 *     summary: Delete a category
 *     description: Deletes a category and its photo from storage. Cannot delete if category is in use.
 *     tags:
 *       - Categories
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: category_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Category deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Category deleted successfully
 *                 id:
 *                   type: integer
 *       400:
 *         description: Cannot delete - category is in use
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Cannot delete category - it is being used
 *                 details:
 *                   type: object
 *                   properties:
 *                     stories:
 *                       type: integer
 *                     profiles:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin access required
 *       404:
 *         description: Category not found
 *       500:
 *         description: Server error
 */
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ category_id: string }> }
) {
    try {
        const { error: authError } = await getAuthenticatedAdmin()
        if (authError) return authError

        const { category_id } = await params
        const categoryId = validateIntId(category_id, 'category ID')

        const category = await prisma.categories.findUnique({
            where: { id: categoryId },
            include: {
                _count: {
                    select: {
                        storyCategories: true,
                        profileCategories: true
                    }
                }
            }
        })

        if (!category) {
            throw new ValidationError('Category not found', 404)
        }

        // Check if category is in use
        if (category._count.storyCategories > 0 || category._count.profileCategories > 0) {
            return NextResponse.json(
                {
                    error: 'Cannot delete category - it is being used',
                    details: {
                        stories: category._count.storyCategories,
                        profiles: category._count.profileCategories
                    }
                },
                { status: 400 }
            )
        }

        // Delete in transaction
        await prisma.$transaction(async (tx) => {
            // Delete translations
            await tx.categoryTranslations.deleteMany({
                where: { category_id: categoryId }
            })

            // Delete category
            await tx.categories.delete({
                where: { id: categoryId }
            })
        })

        // Delete photo from R2 if it exists
        if (category.photo_url) {
            try {
                await deletePhoto(category.photo_url)
            } catch (r2Error) {
                console.error('Failed to delete photo from R2:', r2Error)
            }
        }

        return NextResponse.json({
            message: 'Category deleted successfully',
            id: categoryId
        })
    } catch (error) {
        if (error instanceof ValidationError) {
            return NextResponse.json(
                { error: error.message },
                { status: error.statusCode }
            )
        }

        console.error('Delete category error:', error)
        return NextResponse.json(
            { error: 'Failed to delete category' },
            { status: 500 }
        )
    }
}
