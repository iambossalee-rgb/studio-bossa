import { Client } from '@notionhq/client'
import { getLogDataSourceId, toLog } from './log-utils.js'

const notion = new Client({ auth: process.env.NOTION_TOKEN })

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const { id, title, content, project, status, isPublic } = body

    const properties = {
      기록명: {
        title: [{ text: { content: title || '제목 없는 기록' } }],
      },
      본문: {
        rich_text: [{ text: { content: content || '' } }],
      },
      프로젝트: {
        select: project ? { name: project } : null,
      },
      상태: {
        select: { name: status || '작업중' },
      },
      공개: {
        checkbox: Boolean(isPublic),
      },
    }

    let page

    if (req.method === 'PATCH') {
      if (!id) {
        return res.status(400).json({ ok: false, error: 'Missing log id' })
      }

      page = await notion.pages.update({
        page_id: id,
        properties,
      })
    } else {
      page = await notion.pages.create({
        parent: {
          data_source_id: getLogDataSourceId(),
        },
        properties: {
          ...properties,
          날짜: {
            date: { start: new Date().toISOString() },
          },
        },
      })
    }

    return res.status(200).json({ ok: true, log: toLog(page) })
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message,
    })
  }
}
