import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { withRetry } from './retry'

function createPrismaClient() {
    const adapter = new PrismaPg(process.env.DATABASE_URL!)
    return new PrismaClient({ adapter }).$extends({
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
