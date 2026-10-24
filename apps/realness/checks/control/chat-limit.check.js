#!/usr/bin/env node
import { createHmac as create_hmac } from 'node:crypto'
import { readFileSync as read_file_sync } from 'node:fs'
import { out_path } from '#root/lib/output.js'

const API = process.env.API ?? 'http://127.0.0.1:18080'
const owner = '+14156667777'
const secret =
  process.env.HALO_PASS_SECRET ??
  read_file_sync(out_path('halo-pass-secret'), 'utf8').trim()
const pass = () => {
  const body = Buffer.from(
    JSON.stringify({
      aud: 'realness-halo',
      phone: owner,
      exp: Math.floor(Date.now() / 1000) + 240
    })
  ).toString('base64url')
  return `${body}.${create_hmac('sha256', secret).update(body).digest('base64url')}`
}
const api = async (path, options = {}) => {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { authorization: `Bearer ${pass()}` }
  })
  if (!response.ok) throw new Error(`${path}: ${response.status}`)
  return response.status === 204 ? null : response.json()
}

let actor
try {
  actor = (await api('/v1/actors', { method: 'POST' })).id
  const reply = await fetch(`${API}/v1/actors/${actor}/chat/limit`, {
    headers: { authorization: `Bearer ${pass()}` }
  })
  const status = await reply.json()
  if (reply.status !== 200 || !status.free?.day)
    throw new Error(`chat limit: ${reply.status} ${JSON.stringify(status)}`)
  console.log(
    `PASS: chat limit says ${status.plan}, ${status.free.day.used} of ${status.free.day.limit} tokens today, warn ${status.warn ? status.warn.percent + '%' : 'none'}`
  )
} finally {
  if (actor) await api(`/v1/actors/${actor}`, { method: 'DELETE' })
}
