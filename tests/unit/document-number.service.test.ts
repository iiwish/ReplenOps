import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { documentNumberService } from '@/services/document-number.service'

const SHANGHAI_DATE = new Date('2026-08-08T16:30:00.000Z')

describe('document number service', () => {
  beforeEach(async () => {
    await prisma.documentSequence.deleteMany()
  })

  it('uses the Shanghai business date and five-digit daily sequences', async () => {
    const first = await prisma.$transaction((tx) =>
      documentNumberService.next('ORDER', tx, SHANGHAI_DATE)
    )
    const second = await prisma.$transaction((tx) =>
      documentNumberService.next('ORDER', tx, SHANGHAI_DATE)
    )

    expect(first).toBe('OR-20260809-00001')
    expect(second).toBe('OR-20260809-00002')
  })

  it('maintains independent sequences for each document type', async () => {
    const [orderCode, stockInCode, stockOutCode] = await Promise.all([
      prisma.$transaction((tx) => documentNumberService.next('ORDER', tx, SHANGHAI_DATE)),
      prisma.$transaction((tx) => documentNumberService.next('STOCK_IN', tx, SHANGHAI_DATE)),
      prisma.$transaction((tx) => documentNumberService.next('STOCK_OUT', tx, SHANGHAI_DATE)),
    ])

    expect(orderCode).toBe('OR-20260809-00001')
    expect(stockInCode).toBe('SI-20260809-00001')
    expect(stockOutCode).toBe('SO-20260809-00001')
  })

  it('resets the sequence on the next Shanghai business date', async () => {
    const firstDay = await prisma.$transaction((tx) =>
      documentNumberService.next('ORDER', tx, SHANGHAI_DATE)
    )
    const nextDay = await prisma.$transaction((tx) =>
      documentNumberService.next('ORDER', tx, new Date('2026-08-09T16:00:00.000Z'))
    )

    expect(firstDay).toBe('OR-20260809-00001')
    expect(nextDay).toBe('OR-20260810-00001')
  })

  it('allocates unique codes under concurrent requests', async () => {
    const codes = await Promise.all(
      Array.from({ length: 20 }, () =>
        prisma.$transaction((tx) => documentNumberService.next('ORDER', tx, SHANGHAI_DATE))
      )
    )

    expect(new Set(codes).size).toBe(20)
    expect(codes.toSorted()).toEqual(
      Array.from({ length: 20 }, (_, index) => `OR-20260809-${String(index + 1).padStart(5, '0')}`)
    )
  })
})
