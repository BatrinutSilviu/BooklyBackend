import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

/**
 * @swagger
 * /api/profiles:
 *   post:
 *     summary: Creates a new profile
 *     tags:
 *       - Profiles
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - date_of_birth
 *               - gender
 *               - photo
 *             properties:
 *               name:
 *                 type: string
 *                 example: Child
 *               date_of_birth:
 *                 type: string
 *                 format: date
 *                 description: Date of birth in YYYY-MM-DD format
 *                 example: "2012-05-15"
 *               gender:
 *                 type: boolean
 *                 description: true for male, false for female
 *                 example: true
 *               photo:
 *                 type: string
 *                 description: Photo URL
 *                 example: https://cdn.example.com/avatar.jpg
 *     responses:
 *       201:
 *         description: Profile created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 user_id:
 *                   type: string
 *                   format: uuid
 *                 name:
 *                   type: string
 *                 date_of_birth:
 *                   type: string
 *                   format: date
 *                   nullable: true
 *                 gender:
 *                   type: boolean
 *                 photo_url:
 *                   type: string
 *                   nullable: true
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Bad request - validation error
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: Profile with this name already exists for this user
 *       500:
 *         description: Server error
 */
export async function POST(request: Request) {
    try {
        const { user, error: authError } = await getAuthenticatedUser()
        if (authError) {
            return authError
        }

        const formData = await request.formData()
        const name = formData.get('name') as string
        const date_of_birth = formData.get('date_of_birth') as string
        const gender = formData.get('gender') as string
        const photo = formData.get('photo') as string

        if (!name || name.trim().length === 0) {
            return NextResponse.json(
                { error: 'Name is required' },
                { status: 400 }
            )
        }

        if (!photo) {
            return NextResponse.json(
                { error: 'Photo is required' },
                { status: 400 }
            )
        }

        let dateOfBirth: Date | null = null

        if (date_of_birth) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date_of_birth)) {
                return NextResponse.json(
                    { error: 'Invalid date format. Use YYYY-MM-DD' },
                    { status: 400 }
                )
            }

            dateOfBirth = new Date(date_of_birth)

            if (isNaN(dateOfBirth.getTime())) {
                return NextResponse.json(
                    { error: 'Invalid date' },
                    { status: 400 }
                )
            }

            if (dateOfBirth > new Date()) {
                return NextResponse.json(
                    { error: 'Date of birth cannot be in the future' },
                    { status: 400 }
                )
            }
        }

        const parsedGender = Boolean(gender)

        const existingProfile = await prisma.profiles.findFirst({
            where: {
                name: {
                    equals: name,
                    mode: 'insensitive'
                },
                user_id: {
                    equals: user.id
                }
            }
        })

        if (existingProfile) {
            return NextResponse.json(
                { error: 'Profile with this name already exists' },
                { status: 409 }
            )
        }

        const profile = await prisma.profiles.create({
            data: {
                name: name.trim(),
                date_of_birth: dateOfBirth,
                gender: parsedGender,
                photo_url: photo,
                user_id: user.id
            }
        })

        return NextResponse.json(profile, { status: 201 })
    } catch (error) {
        console.error('Create profile error:', error)

        if (error instanceof Error) {
            if (error.message.includes('Unique constraint')) {
                return NextResponse.json(
                    { error: 'Profile already exists' },
                    { status: 409 }
                )
            }
        }

        return NextResponse.json(
            { error: 'Failed to create profile: ' + error },
            { status: 500 }
        )
    }
}