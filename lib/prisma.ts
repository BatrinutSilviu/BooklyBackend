import { PrismaClient } from '@prisma/client'
import { withRetry } from './retry'

function createPrismaClient() {
    return new PrismaClient().$extends({
        query: {
            $allModels: {
                async $allOperations({ args, query }) {
                    return withRetry(() => query(args))
                },
            },
        },
    })
}

type PrismaClientWithRetry = ReturnType<typeof createPrismaClient>

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClientWithRetry | undefined
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma
}
