import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { r2Client, BUCKET_NAME, PUBLIC_URL } from './r2'
import { generateStorageKey, isValidImageType, getMaxFileSize } from './storage-utils'
import { ValidationError } from './validators'

export type PhotoType = 'avatar' | 'book-cover' | 'book-page' | 'category'

/**
 * Validates, uploads a photo file to R2, and returns its public URL.
 * Throws ValidationError if the file type or size is invalid.
 *
 * @param file     The file to upload
 * @param type     Upload path prefix / folder category
 * @param userId   ID of the authenticated user (stored in R2 metadata)
 * @param context  Optional label used in error messages, e.g. "page 2"
 */
export async function uploadPhoto(
    file: File,
    type: PhotoType,
    userId: string,
    context?: string
): Promise<string> {
    const label = context ? ` for ${context}` : ''

    if (!isValidImageType(file.type)) {
        throw new ValidationError(
            `Invalid file type${label}: ${file.type}. Must be JPEG, PNG, WebP, or GIF`,
            400
        )
    }

    const maxSize = getMaxFileSize('image')
    if (file.size > maxSize) {
        throw new ValidationError(
            `File${label} too large. Max size: ${maxSize / 1024 / 1024}MB`,
            400
        )
    }

    const key = generateStorageKey(type, userId, file.name)
    await r2Client.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: Buffer.from(await file.arrayBuffer()),
        ContentType: file.type,
        Metadata: {
            userId,
            originalName: file.name,
            uploadedAt: new Date().toISOString(),
        },
    }))

    return `${PUBLIC_URL}/${key}`
}

/**
 * Deletes a photo from R2 by its public URL.
 * Throws if the delete request fails.
 */
export async function deletePhoto(url: string): Promise<void> {
    const key = url.replace(`${PUBLIC_URL}/`, '')
    await r2Client.send(new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
    }))
}
