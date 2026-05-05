import { NextResponse } from 'next/server'
import { containerService } from '@/services/container.service'

export async function GET() {
  try {
    const containers = await containerService.list()

    return NextResponse.json(
      containers.map((container) => ({
        id: container.id,
        code: container.code,
        name: container.name,
        unit: container.unit,
      }))
    )
  } catch (error) {
    console.error('Error fetching containers:', error)
    return NextResponse.json({ error: '获取包装物列表失败' }, { status: 500 })
  }
}
