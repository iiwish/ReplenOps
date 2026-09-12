export function normalizeAuthOrigin(value: string, allowLocalHttp: boolean): string {
  const trimmed = value.trim()
  if (!/^https?:\/\/[^/?#\\\s]+\/?$/i.test(trimmed)) throw new Error('地址只能包含协议、域名和端口')
  const url = new URL(trimmed)
  const local = allowLocalHttp && ['localhost', '127.0.0.1'].includes(url.hostname)
  if (
    url.username ||
    url.password ||
    (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))
  ) {
    throw new Error('请输入 HTTPS 地址；本地开发可使用 localhost 或 127.0.0.1 的 HTTP 地址')
  }
  return url.origin
}
