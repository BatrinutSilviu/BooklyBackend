import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedAdmin } from '@/lib/auth'
import { uploadPhoto, deletePhoto } from '@/lib/upload'
import {
    ValidationError,
    validateIntId,
    validateStoryExists,
    validateJsonArray,
    validatePages,
    validateLanguageExists,
    validateCategoriesExist,
} from '@/lib/validators'

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { user, error: authError } = await getAuthenticatedAdmin()
        if (authError) return authError

        const { id } = await params
        const storyId = validateIntId(id, 'story ID')
        const existingStory = await validateStoryExists(storyId)

        const formData = await request.formData()
        const language_id_raw = formData.get('language_id') as string | null
        const title = formData.get('title') as string | null
        const description = formData.get('description') as string | null
        const category_ids_raw = formData.get('category_ids') as string | null
        const pages_raw = formData.get('pages') as string | null
        const story_photo = formData.get('story_photo') as File | null
        const status_raw = formData.get('status') as string | null
        const status = status_raw !== null ? status_raw === 'true' : undefined

        if (!language_id_raw || !title) {
            throw new ValidationError('language_id and title are required', 400)
        }

        const languageId = validateIntId(language_id_raw, 'language_id')
        await validateLanguageExists(languageId)

        const category_ids = category_ids_raw
            ? validateJsonArray<number>(category_ids_raw, 'category_ids', 0)
            : null
        if (category_ids && category_ids.length > 0) {
            await validateCategoriesExist(category_ids)
        }

        const pages = pages_raw ? validatePages(validateJsonArray(pages_raw, 'pages')) : null

        // Upload page photos
        let pagePhotoUrls: Record<number, string | null> = {}
        if (pages) {
            const pagePhotoResults = await Promise.all(
                pages.map(async (page) => {
                    const pagePhoto = formData.get(`page_photo_${page.page_number}`) as File | null
                    if (!pagePhoto || pagePhoto.size === 0) return { page_number: page.page_number, url: null }
                    const url = await uploadPhoto(pagePhoto, 'story-page', user.id, `page ${page.page_number}`)
                    return { page_number: page.page_number, url }
                })
            )
            pagePhotoUrls = Object.fromEntries(pagePhotoResults.map(r => [r.page_number, r.url]))
        }

        // Upload new cover photo if provided
        let photo_url: string | undefined = undefined
        if (story_photo && story_photo.size > 0) {
            if (existingStory.photo_url) {
                try { await deletePhoto(existingStory.photo_url) } catch {}
            }
            photo_url = await uploadPhoto(story_photo, 'story-cover', user.id)
        }

        // Run update in transaction
        const updatedStory = await prisma.$transaction(async (tx) => {
            // Update story cover + categories
            const storyUpdate: any = {}
            if (photo_url) storyUpdate.photo_url = photo_url
            if (status !== undefined) storyUpdate.status = status
            if (category_ids !== null) {
                storyUpdate.storyCategories = {
                    deleteMany: {},
                    ...(category_ids.length > 0 ? {
                        create: category_ids.map((category_id: number) => ({ category_id }))
                    } : {})
                }
            }
            await tx.stories.update({ where: { id: storyId }, data: storyUpdate })

            // Upsert story translation
            const existingTranslation = await tx.storyTranslations.findFirst({
                where: { story_id: storyId, language_id: languageId }
            })

            if (existingTranslation) {
                await tx.storyTranslations.update({
                    where: { id: existingTranslation.id },
                    data: {
                        title: title.trim(),
                        description: description?.trim() || null,
                        ...(pages ? {
                            storyPages: {
                                deleteMany: {},
                                create: pages.map(page => ({
                                    page_number: page.page_number,
                                    text_content: page.text_content,
                                    photo_url: pagePhotoUrls[page.page_number] ?? null,
                                }))
                            }
                        } : {})
                    }
                })
            } else {
                await tx.storyTranslations.create({
                    data: {
                        story_id: storyId,
                        language_id: languageId,
                        title: title.trim(),
                        description: description?.trim() || null,
                        ...(pages ? {
                            storyPages: {
                                create: pages.map(page => ({
                                    page_number: page.page_number,
                                    text_content: page.text_content,
                                    photo_url: pagePhotoUrls[page.page_number] ?? null,
                                }))
                            }
                        } : {})
                    }
                })
            }

            return tx.stories.findUnique({
                where: { id: storyId },
                include: {
                    storyCategories: {
                        include: {
                            category: {
                                include: { categoryTranslations: { include: { language: true } } }
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
        })

        return NextResponse.json(updatedStory)
    } catch (error) {
        if (error instanceof ValidationError) {
            return NextResponse.json({ error: error.message }, { status: error.statusCode })
        }
        console.error('Update story error:', error)
        return NextResponse.json({ error: 'Failed to update story' }, { status: 500 })
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { error: authError } = await getAuthenticatedAdmin()
        if (authError) return authError

        const { id } = await params
        const storyId = validateIntId(id, 'story ID')
        const story = await validateStoryExists(storyId)

        await prisma.$transaction(async (tx) => {
            // Delete pages for all translations
            const translations = await tx.storyTranslations.findMany({ where: { story_id: storyId } })
            const translationIds = translations.map(t => t.id)
            if (translationIds.length > 0) {
                await tx.storyPages.deleteMany({ where: { story_translation_id: { in: translationIds } } })
            }
            await tx.storyTranslations.deleteMany({ where: { story_id: storyId } })
            await tx.storyCategories.deleteMany({ where: { story_id: storyId } })
            await tx.storySeriesStories.deleteMany({ where: { story_id: storyId } })
            await tx.playlistStories.deleteMany({ where: { story_id: storyId } })
            await tx.favorites.deleteMany({ where: { story_id: storyId } })
            await tx.stories.delete({ where: { id: storyId } })
        })

        if (story.photo_url) {
            try { await deletePhoto(story.photo_url) } catch {}
        }

        return NextResponse.json({ message: 'Story deleted successfully', id: storyId })
    } catch (error) {
        if (error instanceof ValidationError) {
            return NextResponse.json({ error: error.message }, { status: error.statusCode })
        }
        console.error('Delete story error:', error)
        return NextResponse.json({ error: 'Failed to delete story' }, { status: 500 })
    }
}
