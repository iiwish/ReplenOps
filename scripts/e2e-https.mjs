import { spawn, execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:https'
import { request } from 'node:http'

// CI exercises the production server behind a loopback-only HTTPS reverse proxy.
const port = Number(process.env.PLAYWRIGHT_PORT || 3001)
const backendPort = port + 1
const directory = mkdtempSync(join(tmpdir(), 'replenops-e2e-tls-'))
const key = join(directory, 'key.pem')
const cert = join(directory, 'cert.pem')
execFileSync(
  'openssl',
  [
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-days',
    '1',
    '-subj',
    '/CN=localhost',
    '-addext',
    'subjectAltName=DNS:localhost,IP:127.0.0.1',
    '-keyout',
    key,
    '-out',
    cert,
  ],
  { stdio: 'ignore' }
)
const backend = spawn(
  process.execPath,
  [
    'node_modules/next/dist/bin/next',
    'start',
    '--hostname',
    '127.0.0.1',
    '--port',
    String(backendPort),
  ],
  { stdio: 'inherit' }
)
const server = createServer({ key: readFileSync(key), cert: readFileSync(cert) }, (req, res) => {
  const upstream = request(
    {
      hostname: '127.0.0.1',
      port: backendPort,
      path: req.url,
      method: req.method,
      headers: {
        ...req.headers,
        host: `localhost:${port}`,
        'x-forwarded-host': `localhost:${port}`,
        'x-forwarded-proto': 'https',
        'x-forwarded-port': String(port),
      },
    },
    (response) => {
      res.writeHead(response.statusCode || 502, response.headers)
      response.pipe(res)
    }
  )
  upstream.on('error', () => {
    if (!res.headersSent) res.writeHead(502)
    res.end()
  })
  req.pipe(upstream)
  res.on('close', () => upstream.destroy())
})
server.listen(port, 'localhost')
const cleanup = () => {
  server.close()
  backend.kill('SIGTERM')
  rmSync(directory, { recursive: true, force: true })
}
process.on('SIGTERM', cleanup)
process.on('SIGINT', cleanup)
backend.on('exit', (code) => {
  cleanup()
  process.exitCode = code || 0
})
