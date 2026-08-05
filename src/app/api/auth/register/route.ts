import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({ success: false, error: '注册接口不可用' }, { status: 404 })
}
