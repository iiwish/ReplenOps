-- Allocate human-readable daily document numbers atomically across app instances.
CREATE TABLE "document_sequences" (
    "document_type" TEXT NOT NULL,
    "business_date" DATE NOT NULL,
    "current_value" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_sequences_pkey" PRIMARY KEY ("document_type", "business_date")
);
