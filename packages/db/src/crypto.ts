// AES-256-GCM encryption for provider API keys.
// Master key from AI_MASTER_KEY env (64 hex chars).

import crypto from 'node:crypto'

const ALG = 'aes-256-gcm'
const IV_LEN = 12
const TAG_LEN = 16

function getKey(): Buffer {
  const hex = process.env['AI_MASTER_KEY']
  if (!hex) throw new Error('AI_MASTER_KEY not set')
  const key = Buffer.from(hex, 'hex')
  if (key.length !== 32) throw new Error(`AI_MASTER_KEY must be 64 hex chars (32 bytes). Got ${key.length}.`)
  return key
}

/** Returns base64(iv || tag || ciphertext) */
export function encryptApiKey(plaintext: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(IV_LEN)
  const cipher = crypto.createCipheriv(ALG, key, iv)
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, ct]).toString('base64')
}

export function decryptApiKey(encoded: string): string {
  const key = getKey()
  const buf = Buffer.from(encoded, 'base64')
  const iv = buf.subarray(0, IV_LEN)
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN)
  const ct = buf.subarray(IV_LEN + TAG_LEN)
  const decipher = crypto.createDecipheriv(ALG, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
}
