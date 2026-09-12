import { NextRequest, NextResponse } from 'next/server'
import { cancelCurrentWecomFlow, privateResponse } from '@/lib/wecom/http'

export async function GET(request: NextRequest) {
  await cancelCurrentWecomFlow()
  return privateResponse(NextResponse.redirect(new URL('/login?local=1', request.url)))
}
