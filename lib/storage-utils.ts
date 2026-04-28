import { randomUUID } from 'crypto'

export type AssetType = 'avatar' | 'story-cover' | 'story-page' | 'category'

const ASSET_FOLDERS: Record<AssetType, string> = {
    'avatar':      'avatars',
    'story-cover': 'stories/covers',
    'story-page':  'stories/pages',
    'category':    'categories',
}

// Generate R2 storage key for an asset.
// Format: {folder}/{userId}-{uuid}.{ext}
// Examples:
//   stories/covers/user123-a1b2c3d4.jpg
//   stories/pages/user123-b2c3d4e5.png
//   categories/user123-c3d4e5f6.webp
//   avatars/user123-d4e5f6a7.jpg
export function generateStorageKey(
    type: AssetType,
    userId: string,
    originalName: string
): string {
    const uuid = randomUUID().split('-')[0]
    const ext = originalName.split('.').pop()?.toLowerCase() || 'jpg'
    return `${ASSET_FOLDERS[type]}/${userId}-${uuid}.${ext}`
}

export function isValidImageType(mimetype: string): boolean {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
    return validTypes.includes(mimetype)
}

export function isValidAudioType(mimetype: string): boolean {
    const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg']
    return validTypes.includes(mimetype)
}

export function getMaxFileSize(type: 'image' | 'audio'): number {
    return type === 'image'
        ? 5 * 1024 * 1024   // 5MB for images
        : 50 * 1024 * 1024  // 50MB for audio
}
