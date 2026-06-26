import { Client } from '@notionhq/client'
import { getLogDataSourceId } from './log-utils.js'

const notion = new Client({ auth: process.env.NOTION_TOKEN })

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const { id } = body || {}

    if (!id) {
      return res.status(400).json({ ok: false, error: 'Missing log id' })
    }

    const page = await notion.pages.retrieve({ page_id: id })
    const parentDataSourceId = page.parent?.data_source_id

    if (parentDataSourceId !== getLogDataSourceId()) {
      return res.status(403).json({ ok: false, error: 'Log does not belong to BOSSA Log data source' })
    }

    await notion.pages.update({
      page_id: id,
      archived: true,
    })

    return res.status(200).json({ ok: true, id })
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message,
    })
  }
}
