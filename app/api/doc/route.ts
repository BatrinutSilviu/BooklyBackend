import { NextResponse } from 'next/server'
import swaggerSpec from '@/public/swagger.json'

export async function GET() {
    return NextResponse.json(swaggerSpec)
}
