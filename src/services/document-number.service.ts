import { Prisma } from '@prisma/client'
import { getShanghaiDate } from '@/lib/shanghai-time'

const DOCUMENT_PREFIXES = {
  ORDER: 'OR',
  STOCK_IN: 'SI',
  STOCK_OUT: 'SO',
  CONTAINER_RETURN: 'CR',
} as const

const MAX_DAILY_SEQUENCE = 99_999

export type DocumentType = keyof typeof DOCUMENT_PREFIXES

interface SequenceRow {
  current_value: number
}

export class DocumentNumberService {
  async next(
    documentType: DocumentType,
    tx: Prisma.TransactionClient,
    now = new Date()
  ): Promise<string> {
    const businessDate = getShanghaiDate(now)
    const rows = await tx.$queryRaw<SequenceRow[]>(Prisma.sql`
      INSERT INTO "document_sequences" (
        "document_type",
        "business_date",
        "current_value",
        "updated_at"
      )
      VALUES (
        ${documentType},
        CAST(${businessDate} AS DATE),
        1,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT ("document_type", "business_date")
      DO UPDATE SET
        "current_value" = "document_sequences"."current_value" + 1,
        "updated_at" = CURRENT_TIMESTAMP
      RETURNING "current_value"
    `)

    const sequence = rows[0]?.current_value
    if (sequence === undefined || sequence > MAX_DAILY_SEQUENCE) {
      throw new Error(`${documentType} 当日单据数量已达到上限`)
    }

    const datePart = businessDate.replaceAll('-', '')
    const sequencePart = String(sequence).padStart(5, '0')
    return `${DOCUMENT_PREFIXES[documentType]}-${datePart}-${sequencePart}`
  }
}

export const documentNumberService = new DocumentNumberService()
