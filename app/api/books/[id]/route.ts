import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedAdmin } from '@/lib/auth'
import { uploadPhoto, deletePhoto } from '@/lib/upload'
import {
    ValidationError,
    validateIntId,
    validateBookExists,
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
        const bookId = validateIntId(id, 'book ID')
        const existingBook = await validateBookExists(bookId)

        const formData = await request.formData()
        const language_id_raw = formData.get('language_id') as string | null
        const title = formData.get('title') as string | null
        const description = formData.get('description') as string | null
        const category_ids_raw = formData.get('category_ids') as string | null
        const pages_raw = formData.get('pages') as string | null
        const book_photo = formData.get('book_photo') as File | null
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
                    const url = await uploadPhoto(pagePhoto, 'book-page', user.id, `page ${page.page_number}`)
                    return { page_number: page.page_number, url }
                })
            )
            pagePhotoUrls = Object.fromEntries(pagePhotoResults.map(r => [r.page_number, r.url]))
        }

        // Upload new cover photo if provided
        let photo_url: string | undefined = undefined
        if (book_photo && book_photo.size > 0) {
            if (existingBook.photo_url) {
                try { await deletePhoto(existingBook.photo_url) } catch {}
            }
            photo_url = await uploadPhoto(book_photo, 'book-cover', user.id)
        }

        // Run update in transaction
        const updatedBook = await prisma.$transaction(async (tx) => {
            // Update book cover + categories
            const bookUpdate: any = {}
            if (photo_url) bookUpdate.photo_url = photo_url
            if (status !== undefined) bookUpdate.status = status
            if (category_ids !== null) {
                bookUpdate.bookCategories = {
                    deleteMany: {},
                    ...(category_ids.length > 0 ? {
                        create: category_ids.map((category_id: number) => ({ category_id }))
                    } : {})
                }
            }
            await tx.books.update({ where: { id: bookId }, data: bookUpdate })

            // Upsert book translation
            const existingTranslation = await tx.bookTranslations.findFirst({
                where: { book_id: bookId, language_id: languageId }
            })

            if (existingTranslation) {
                await tx.bookTranslations.update({
                    where: { id: existingTranslation.id },
                    data: {
                        title: title.trim(),
                        description: description?.trim() || null,
                        ...(pages ? {
                            bookPages: {
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
                await tx.bookTranslations.create({
                    data: {
                        book_id: bookId,
                        language_id: languageId,
                        title: title.trim(),
                        description: description?.trim() || null,
                        ...(pages ? {
                            bookPages: {
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

            return tx.books.findUnique({
                where: { id: bookId },
                include: {
                    bookCategories: {
                        include: {
                            category: {
                                include: { categoryTranslations: { include: { language: true } } }
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
        })

        return NextResponse.json(updatedBook)
    } catch (error) {
        if (error instanceof ValidationError) {
            return NextResponse.json({ error: error.message }, { status: error.statusCode })
        }
        console.error('Update book error:', error)
        return NextResponse.json({ error: 'Failed to update book' }, { status: 500 })
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
        const bookId = validateIntId(id, 'book ID')
        const book = await validateBookExists(bookId)

        await prisma.$transaction(async (tx) => {
            // Delete pages for all translations
            const translations = await tx.bookTranslations.findMany({ where: { book_id: bookId } })
            const translationIds = translations.map(t => t.id)
            if (translationIds.length > 0) {
                await tx.bookPages.deleteMany({ where: { book_translation_id: { in: translationIds } } })
            }
            await tx.bookTranslations.deleteMany({ where: { book_id: bookId } })
            await tx.bookCategories.deleteMany({ where: { book_id: bookId } })
await tx.playlistBooks.deleteMany({ where: { book_id: bookId } })
            await tx.favorites.deleteMany({ where: { book_id: bookId } })
            await tx.books.delete({ where: { id: bookId } })
        })

        if (book.photo_url) {
            try { await deletePhoto(book.photo_url) } catch {}
        }

        return NextResponse.json({ message: 'Book deleted successfully', id: bookId })
    } catch (error) {
        if (error instanceof ValidationError) {
            return NextResponse.json({ error: error.message }, { status: error.statusCode })
        }
        console.error('Delete book error:', error)
        return NextResponse.json({ error: 'Failed to delete book' }, { status: 500 })
    }
}
