import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

// Strip accidental surrounding whitespace, trailing commas, or quotes from .env values
function cleanEnvValue(raw: string | undefined): string {
  if (!raw) return ''
  return raw
    .trim()
    .replace(/,+$/g, '')
    .trim()
    .replace(/^['"]+|['"]+$/g, '')
    .trim()
    .replace(/,+$/g, '')
    .trim()
}

const REQUIRED_FIREBASE_ENV_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const

const missingFirebaseEnvKeys = REQUIRED_FIREBASE_ENV_KEYS.filter((key) => {
  const val = cleanEnvValue(import.meta.env[key])
  return !val || val === 'demo-api-key' || val.startsWith('demo-project')
})

if (missingFirebaseEnvKeys.length > 0) {
  console.error(
    `[Scholivo Firebase Config] Missing or placeholder Firebase environment variables in .env: ${missingFirebaseEnvKeys.join(', ')}. ` +
      'Copy .env.example to .env in the project root, populate your Firebase Web App credentials from Firebase Console → Project Settings → Your apps, and restart the Vite dev server.'
  )
}

const firebaseConfig = {
  apiKey: cleanEnvValue(import.meta.env.VITE_FIREBASE_API_KEY),
  authDomain: cleanEnvValue(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: cleanEnvValue(import.meta.env.VITE_FIREBASE_PROJECT_ID),
  storageBucket: cleanEnvValue(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: cleanEnvValue(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  appId: cleanEnvValue(import.meta.env.VITE_FIREBASE_APP_ID),
}

// Initialize Firebase (avoid re-initialization in hot reload)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
// Bound Firebase Storage internal retry windows so failed or blocked uploads fail fast instead of hanging for 2-10 minutes
storage.maxUploadRetryTime = 15000
storage.maxOperationRetryTime = 15000

export default app
