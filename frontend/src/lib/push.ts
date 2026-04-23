const PUSH_STORAGE_KEY = 'cult:push:enabled'

export function isPushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
}

export function readPushEnabled() {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(PUSH_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function setPushEnabled(enabled: boolean) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PUSH_STORAGE_KEY, enabled ? '1' : '0')
  } catch {}
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}

export async function enablePushNotifications(walletAddress: string) {
  if (!isPushSupported()) {
    throw new Error('Push notifications are not supported on this device.')
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted.')
  }

  const registration = await navigator.serviceWorker.ready
  const configRes = await fetch('/api/push-subscribe')
  const config = await configRes.json()

  if (!config?.configured || !config?.vapidPublicKey) {
    throw new Error('Push is not fully configured on the server yet.')
  }

  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(config.vapidPublicKey),
    })
  }

  const response = await fetch('/api/push-subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress, subscription }),
  })

  const result = await response.json()
  if (!response.ok || !result?.ok) {
    throw new Error(result?.error || 'Failed to save push subscription.')
  }

  setPushEnabled(true)
  return result
}
