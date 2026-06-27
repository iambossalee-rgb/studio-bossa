import fs from 'node:fs/promises'
import path from 'node:path'
import formidable from 'formidable'
import { put } from '@vercel/blob'

const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

export const config = {
  api: {
    bodyParser: false,
  },
}

function parseForm(req) {
  const form = formidable({
    multiples: false,
    maxFileSize: MAX_IMAGE_SIZE,
    filter: part => ALLOWED_IMAGE_TYPES.has(part.mimetype || ''),
  })

  return new Promise((resolve, reject) => {
    form.parse(req, (error, fields, files) => {
      if (error) reject(error)
      else resolve({ fields, files })
    })
  })
}

function firstFile(files) {
  const file = files.file || files.image
  return Array.isArray(file) ? file[0] : file
}

function safeFileName(file) {
  const original = file.originalFilename || 'image'
  const ext = path.extname(original).toLowerCase() || '.jpg'
  const base = path
    .basename(original, ext)
    .toLowerCase()
    .replace(/[^a-z0-9가-힣_-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'image'

  return `logs/${Date.now()}-${base}${ext}`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({
      ok: false,
      error: 'Missing BLOB_READ_WRITE_TOKEN. Add a Vercel Blob read/write token to the environment.',
    })
  }

  try {
    const { files } = await parseForm(req)
    const file = firstFile(files)

    if (!file) {
      return res.status(400).json({ ok: false, error: '이미지 파일을 선택해주세요.' })
    }

    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype || '')) {
      return res.status(400).json({ ok: false, error: 'JPG, PNG, WEBP, GIF 이미지만 업로드할 수 있습니다.' })
    }

    if (file.size > MAX_IMAGE_SIZE) {
      return res.status(400).json({ ok: false, error: '이미지는 5MB 이하만 업로드할 수 있습니다.' })
    }

    const data = await fs.readFile(file.filepath)
    const blob = await put(safeFileName(file), data, {
      access: 'public',
      contentType: file.mimetype,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })

    return res.status(200).json({ ok: true, url: blob.url })
  } catch (error) {
    const message = error.code === 1009
      ? '이미지는 5MB 이하만 업로드할 수 있습니다.'
      : error.message

    return res.status(500).json({ ok: false, error: message })
  }
}
