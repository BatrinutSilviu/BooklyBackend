import { NextRequest, NextResponse } from 'next/server'

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean)

const CORS_HEADERS = {
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS,PATCH',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
}

export function middleware(request: NextRequest) {
    const origin = request.headers.get('origin') ?? ''
    const originAllowed = allowedOrigins.length === 0 || allowedOrigins.includes(origin)

    if (request.method === 'OPTIONS') {
        return new NextResponse(null, {
            status: 204,
            headers: {
                ...(originAllowed ? { 'Access-Control-Allow-Origin': origin } : {}),
                ...CORS_HEADERS,
            },
        })
    }

    const response = NextResponse.next()
    if (originAllowed && origin) {
        response.headers.set('Access-Control-Allow-Origin', origin)
        Object.entries(CORS_HEADERS).forEach(([k, v]) => response.headers.set(k, v))
    }
    return response
}

export const config = {
    matcher: '/api/:path*',
}
