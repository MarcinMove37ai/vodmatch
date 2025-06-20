// src/app/api/test-db/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    console.log('🧪 Testing Prisma connection...')

    // Test basic connection
    await prisma.$connect()

    // Count sessions
    const sessionCount = await prisma.session.count()

    console.log('✅ Prisma connection successful, sessions count:', sessionCount)

    return NextResponse.json({
      status: 'success',
      message: 'Prisma database connection successful',
      sessionCount: sessionCount,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Prisma test failed:', error)
    return NextResponse.json({
      status: 'error',
      message: 'Prisma connection failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}