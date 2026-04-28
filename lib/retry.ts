import { Prisma } from '@prisma/client'
import { AuthError } from '@supabase/supabase-js'

export interface RetryOptions {
    maxRetries?: number
    initialDelayMs?: number
    maxDelayMs?: number
}

// Prisma error codes that indicate a transient infrastructure failure worth retrying
const RETRYABLE_CODES = new Set([
    'P1001', // Can't reach database server
    'P1002', // Database server timeout
    'P1008', // Operations timed out
    'P1017', // Server has closed the connection
    'P2024', // Timed out fetching a new connection from the pool
])

// HTTP status codes from Supabase that indicate a transient failure worth retrying
const RETRYABLE_HTTP_STATUSES = new Set([500, 502, 503, 504])

function isRetryable(error: unknown): boolean {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        return RETRYABLE_CODES.has(error.code)
    }
    if (
        error instanceof Prisma.PrismaClientUnknownRequestError ||
        error instanceof Prisma.PrismaClientInitializationError
    ) {
        return true
    }
    if (error instanceof AuthError) {
        // No status or server-side transient error
        return !error.status || RETRYABLE_HTTP_STATUSES.has(error.status)
    }
    // Network-level failures (fetch threw, ECONNRESET, etc.)
    if (error instanceof TypeError && error.message.toLowerCase().includes('fetch')) {
        return true
    }
    return false
}

export async function withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const { maxRetries = 3, initialDelayMs = 100, maxDelayMs = 2000 } = options

    let lastError: unknown

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn()
        } catch (error) {
            lastError = error

            if (!isRetryable(error) || attempt === maxRetries) {
                throw error
            }

            // Exponential backoff with jitter to avoid thundering herd
            const base = Math.min(initialDelayMs * 2 ** attempt, maxDelayMs)
            const jitter = Math.random() * base * 0.2
            await new Promise(resolve => setTimeout(resolve, base + jitter))
        }
    }

    throw lastError
}
