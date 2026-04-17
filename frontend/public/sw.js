const STATIC_CACHE = 'cult-static-v2'
const RUNTIME_CACHE = 'cult-runtime-v2'
const APP_SHELL = ['/', '/manifest.json', '/offline.html', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL))
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => ![STATIC_CACHE, RUNTIME_CACHE].includes(key))
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  const isSameOrigin = url.origin === self.location.origin
  const isDocument = request.mode === 'navigate'
  const isStaticAsset = isSameOrigin && (
    url.pathname.startsWith('/assets/') ||
    url.pathname === '/' ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.wasm') ||
    url.pathname.endsWith('.json')
  )

  if (isDocument) {
    event.respondWith(networkFirst(request, '/offline.html'))
    return
  }

  if (isStaticAsset) {
    event.respondWith(staleWhileRevalidate(request))
  }
})

async function networkFirst(request, fallbackPath) {
  const cache = await caches.open(RUNTIME_CACHE)
  try {
    const response = await fetch(request)
    cache.put(request, response.clone())
    return response
  } catch {
    const cached = await cache.match(request)
    if (cached) return cached
    return caches.match(fallbackPath)
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE)
  const cached = await cache.match(request)

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response && response.status === 200) {
        cache.put(request, response.clone())
      }
      return response
    })
    .catch(() => undefined)

  return cached || fetchPromise || Response.error()
}
