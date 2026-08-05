export type AppEnv = 'local' | 'preview' | 'production'
export type Platform = 'admin' | 'mobile'
export type DomainHostType = Platform | 'local' | 'unknown'

export interface DomainRoutingEnv {
  [key: string]: string | undefined
  ADMIN_HOSTS?: string
  MOBILE_HOSTS?: string
  CANONICAL_ADMIN_HOST?: string
  CANONICAL_MOBILE_HOST?: string
  APP_ENV?: string
  COOKIE_DOMAIN?: string
}

export interface DomainRoutingConfig {
  adminHosts: string[]
  mobileHosts: string[]
  canonicalAdminHost?: string
  canonicalMobileHost?: string
  appEnv: AppEnv
  cookieDomain?: string
}

export interface RoutingUrl {
  host: string
  pathname: string
  search: string
  toString(): string
}

function normalizeHostname(host: string | null | undefined): string {
  if (!host) {
    return ''
  }

  const trimmed = host.trim().toLowerCase()
  if (!trimmed) {
    return ''
  }

  try {
    const url = trimmed.includes('://') ? new URL(trimmed) : new URL(`http://${trimmed}`)
    return url.hostname.replace(/^\[|\]$/g, '')
  } catch {
    const withoutPath = trimmed.split('/')[0] || ''
    const withoutPort = withoutPath.startsWith('[')
      ? withoutPath.replace(/^\[|\](?::\d+)?$/g, '')
      : withoutPath.split(':')[0] || ''
    return withoutPort
  }
}

function parseHosts(value: string | undefined): string[] {
  if (!value) {
    return []
  }

  const seen = new Set<string>()
  const hosts: string[] = []

  for (const entry of value.split(',')) {
    const hostname = normalizeHostname(entry)
    if (hostname && !seen.has(hostname)) {
      seen.add(hostname)
      hosts.push(hostname)
    }
  }

  return hosts
}

function normalizeCanonicalHost(value: string | undefined): string | undefined {
  if (!value) {
    return undefined
  }

  const trimmed = value.trim().toLowerCase()
  if (!trimmed) {
    return undefined
  }

  try {
    const url = trimmed.includes('://') ? new URL(trimmed) : new URL(`http://${trimmed}`)
    return url.host || undefined
  } catch {
    return trimmed.split('/')[0] || undefined
  }
}

function normalizeAppEnv(value: string | undefined): AppEnv {
  if (value === 'preview' || value === 'production') {
    return value
  }
  return 'local'
}

export function createDomainRoutingConfig(env: DomainRoutingEnv = process.env): DomainRoutingConfig {
  return {
    adminHosts: parseHosts(env.ADMIN_HOSTS),
    mobileHosts: parseHosts(env.MOBILE_HOSTS),
    canonicalAdminHost: normalizeCanonicalHost(env.CANONICAL_ADMIN_HOST),
    canonicalMobileHost: normalizeCanonicalHost(env.CANONICAL_MOBILE_HOST),
    appEnv: normalizeAppEnv(env.APP_ENV),
    cookieDomain: env.COOKIE_DOMAIN?.trim() || undefined,
  }
}

function isLocalHostname(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1'
  )
}

export function classifyDomainHost(
  host: string | null | undefined,
  config: DomainRoutingConfig = createDomainRoutingConfig()
): DomainHostType {
  const hostname = normalizeHostname(host)

  if (!hostname) {
    return 'unknown'
  }

  if (isLocalHostname(hostname)) {
    return 'local'
  }

  if (config.adminHosts.includes(hostname)) {
    return 'admin'
  }

  if (config.mobileHosts.includes(hostname)) {
    return 'mobile'
  }

  return 'unknown'
}

function isPlatformPath(pathname: string, platform: Platform): boolean {
  const prefix = `/${platform}`
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

function parseRoutingUrl(url: string | RoutingUrl): URL | RoutingUrl {
  return typeof url === 'string' ? new URL(url) : url
}

export function getPathWithSearch(url: string | RoutingUrl): string {
  const parsedUrl = parseRoutingUrl(url)
  return `${parsedUrl.pathname}${parsedUrl.search}`
}

export function getRootRedirectPath(
  url: string | RoutingUrl,
  config: DomainRoutingConfig = createDomainRoutingConfig()
): string | null {
  const parsedUrl = parseRoutingUrl(url)

  if (parsedUrl.pathname !== '/') {
    return null
  }

  const hostType = classifyDomainHost(parsedUrl.host, config)

  if (hostType === 'admin') {
    return `/admin${parsedUrl.search}`
  }

  if (hostType === 'mobile') {
    return `/mobile${parsedUrl.search}`
  }

  return null
}

function buildUrlWithHost(originalUrl: RoutingUrl, targetHost: string, pathWithSearch: string): string {
  const targetUrl = new URL(originalUrl.toString())
  const [pathname = '/', ...searchParts] = pathWithSearch.split('?')

  targetUrl.host = targetHost
  targetUrl.pathname = pathname
  targetUrl.search = searchParts.length > 0 ? `?${searchParts.join('?')}` : ''
  targetUrl.hash = ''
  return targetUrl.toString()
}

export function getCrossDomainRedirectUrl(
  url: string | RoutingUrl,
  config: DomainRoutingConfig = createDomainRoutingConfig()
): string | null {
  const parsedUrl = parseRoutingUrl(url)
  const hostType = classifyDomainHost(parsedUrl.host, config)
  const pathWithSearch = getPathWithSearch(parsedUrl)

  if (
    hostType === 'admin' &&
    isPlatformPath(parsedUrl.pathname, 'mobile') &&
    config.canonicalMobileHost &&
    normalizeCanonicalHost(parsedUrl.host) !== config.canonicalMobileHost
  ) {
    return buildUrlWithHost(parsedUrl, config.canonicalMobileHost, pathWithSearch)
  }

  if (
    hostType === 'mobile' &&
    isPlatformPath(parsedUrl.pathname, 'admin') &&
    config.canonicalAdminHost &&
    normalizeCanonicalHost(parsedUrl.host) !== config.canonicalAdminHost
  ) {
    return buildUrlWithHost(parsedUrl, config.canonicalAdminHost, pathWithSearch)
  }

  return null
}

export function buildCanonicalPlatformUrl(
  platform: Platform,
  currentUrl: string | RoutingUrl,
  config: DomainRoutingConfig = createDomainRoutingConfig()
): string {
  const parsedUrl = parseRoutingUrl(currentUrl)
  const targetHost = platform === 'admin' ? config.canonicalAdminHost : config.canonicalMobileHost

  if (!targetHost) {
    return `/${platform}`
  }

  return buildUrlWithHost(parsedUrl, targetHost, `/${platform}`)
}

export function getCookieDomain(
  config: DomainRoutingConfig = createDomainRoutingConfig()
): string | undefined {
  if (config.appEnv !== 'production') {
    return undefined
  }

  return config.cookieDomain
}
