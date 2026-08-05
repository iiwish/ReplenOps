const MIN_JWT_SECRET_LENGTH = 32

function isPlaceholderSecret(secret: string): boolean {
  return (
    secret.includes('$(') ||
    secret.includes('your-') ||
    secret.includes('replace-with') ||
    secret.includes('change-in-production')
  )
}

export function getJwtSecret(): Uint8Array {
  const rawSecret = process.env.JWT_SECRET?.trim()

  if (!rawSecret) {
    throw new Error('JWT_SECRET is required')
  }

  if (rawSecret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters long`)
  }

  if (isPlaceholderSecret(rawSecret)) {
    throw new Error('JWT_SECRET must be a real secret and cannot use placeholder content')
  }

  return new TextEncoder().encode(rawSecret)
}
