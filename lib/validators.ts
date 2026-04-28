import { prisma } from '@/lib/prisma'
import {Languages, Stories, Playlists, Categories, Profiles, StorySeries} from '@prisma/client';

export class ValidationError extends Error {
    constructor(
        message: string,
        public statusCode: number = 400
    ) {
        super(message)
        this.name = 'ValidationError'
    }
}

export async function validateExists<T>(
    model: any,
    id: number,
    resourceName: string
): Promise<T> {
    const record = await model.findUnique({ where: { id } })

    if (!record) {
        throw new ValidationError(`${resourceName} not found`, 404)
    }

    return record as T
}

export async function validateLanguageExists(languageId: any): Promise<Languages> {
    const id = validateIntId(languageId)

    return validateExists(
        prisma.languages,
        id,
        'Language'
    )
}

export async function validateStoryExists(storyId: any): Promise<Stories> {
    const id = validateIntId(storyId)

    return validateExists(
        prisma.stories,
        id,
        'Story'
    )
}

export async function validateCategoryExists(categoryId: any): Promise<Categories> {
    const id = validateIntId(categoryId)

    return validateExists(
        prisma.categories,
        id,
        'Category'
    )
}

export async function validateStorySeriesExists(id: any): Promise<StorySeries> {
    const seriesId = validateIntId(id)

    return validateExists(
        prisma.storySeries,
        seriesId,
        'Story series'
    )
}

export async function validateProfileExists(profileId: any): Promise<Profiles> {
    const id = validateIntId(profileId)

    return validateExists(
        prisma.profiles,
        id,
        'Profile'
    )
}

export async function validatePlaylistExists(playlistId: any): Promise<Playlists> {
    const id = validateIntId(playlistId)

    return validateExists(
        prisma.playlists,
        id,
        'Playlist'
    )
}

export async function validateProfileOwnership(profileId: number, userId: string) {
    const profile = await validateProfileExists(profileId)

    if (profile.user_id !== userId) {
        throw new ValidationError('Forbidden - you can only access your own profiles', 403)
    }

    return profile
}

export async function validatePlaylistOwnership(playlistId: number, userId: string) {
    const playlist = await prisma.playlists.findUnique({
        where: { id: playlistId },
        include: {
            profile: {
                select: { user_id: true }
            }
        }
    })

    if (!playlist) {
        throw new ValidationError('Playlist not found', 404)
    }

    if (playlist.profile.user_id !== userId) {
        throw new ValidationError('Forbidden - you can only access your own playlists', 403)
    }

    return playlist
}

export async function validateCategoriesExist(categoryIds: number[]) {
    const categories = await prisma.categories.findMany({
        where: { id: { in: categoryIds } }
    })

    if (categories.length !== categoryIds.length) {
        const foundIds = categories.map(c => c.id)
        const missingIds = categoryIds.filter(id => !foundIds.includes(id))
        throw new ValidationError(`Categories not found: ${missingIds.join(', ')}`, 404)
    }

    return categories
}

export async function validateStoriesExist(storyIds: number[]) {
    const stories = await prisma.stories.findMany({
        where: { id: { in: storyIds } }
    })

    if (stories.length !== storyIds.length) {
        const foundIds = stories.map(s => s.id)
        const missingIds = storyIds.filter(id => !foundIds.includes(id))
        throw new ValidationError(`Stories not found: ${missingIds.join(', ')}`, 404)
    }

    return stories
}

export function validateIntId(id: any, fieldName: string = 'ID'): number {
    if (id === undefined || id === null || id === '') {
        throw new ValidationError(`${fieldName} is required`, 400)
    }

    const parsed = parseInt(String(id), 10)

    if (isNaN(parsed) || parsed < 1) {
        throw new ValidationError(`Invalid ${fieldName}`, 400)
    }

    return parsed
}

export function validateUuidId(id: string, fieldName: string = 'ID'): string {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

    if (!uuidRegex.test(id)) {
        throw new ValidationError(`Invalid ${fieldName} format`, 400)
    }

    return id
}

export function validateDateFormat(dateStr: string, fieldName: string = 'date'): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        throw new ValidationError(`Invalid ${fieldName} format. Use YYYY-MM-DD`, 400)
    }

    const date = new Date(dateStr)

    if (isNaN(date.getTime())) {
        throw new ValidationError(`Invalid ${fieldName}`, 400)
    }

    if (date > new Date()) {
        throw new ValidationError(`${fieldName} cannot be in the future`, 400)
    }

    return date
}

export function validateRequired(value: any, fieldName: string): void {
    if (value === undefined || value === null || value === '') {
        throw new ValidationError(`${fieldName} is required`, 400)
    }
}

export function validateArray(value: any, fieldName: string, minLength: number = 1): void {
    if (!Array.isArray(value)) {
        throw new ValidationError(`${fieldName} must be an array`, 400)
    }

    if (value.length < minLength) {
        throw new ValidationError(`${fieldName} must have at least ${minLength} item(s)`, 400)
    }
}

export function validateJsonArray<T>(raw: string | null, fieldName: string, minLength: number = 1): T[] {
    validateRequired(raw, fieldName)

    let parsed: unknown
    try {
        parsed = JSON.parse(raw as string)
    } catch {
        throw new ValidationError(`${fieldName} must be a valid JSON array`, 400)
    }

    validateArray(parsed, fieldName, minLength)
    return parsed as T[]
}

export function validatePages(pages: unknown[]): { page_number: number; text_content: string }[] {
    for (const page of pages) {
        const p = page as Record<string, unknown>
        if (typeof p.page_number !== 'number' || p.page_number < 1) {
            throw new ValidationError('Each page must have a valid page_number (positive integer)', 400)
        }
        if (!p.text_content || typeof p.text_content !== 'string') {
            throw new ValidationError('Each page must have text_content (string)', 400)
        }
    }
    return pages as { page_number: number; text_content: string }[]
}
