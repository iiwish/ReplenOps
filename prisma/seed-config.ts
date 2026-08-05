export interface SeedEnvironment {
  NODE_ENV?: string
  APP_ENV?: string
  ADMIN_USERNAME?: string
  ADMIN_INITIAL_PASSWORD?: string
}

export interface DefaultAdminConfig {
  username: string
  password: string
  isProtectedRuntime: boolean
  logSafeSummary: {
    username: string
    passwordProvided: boolean
    isProtectedRuntime: boolean
  }
}

export function resolveDefaultAdminConfig(env: SeedEnvironment): DefaultAdminConfig {
  const isProtectedRuntime =
    env.NODE_ENV === 'production' || env.APP_ENV === 'production' || env.APP_ENV === 'preview'
  const username = env.ADMIN_USERNAME?.trim() || 'admin'
  const password = env.ADMIN_INITIAL_PASSWORD

  if (!password) {
    throw new Error('ADMIN_INITIAL_PASSWORD is required when bootstrapping the administrator')
  }

  if (password.length < 12) {
    throw new Error('ADMIN_INITIAL_PASSWORD must contain at least 12 characters')
  }

  return {
    username,
    password,
    isProtectedRuntime,
    logSafeSummary: {
      username,
      passwordProvided: true,
      isProtectedRuntime,
    },
  }
}
