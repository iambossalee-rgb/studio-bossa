import { Client } from '@notionhq/client'

const notion = new Client({ auth: process.env.NOTION_TOKEN })

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const { title, content, project, status, isPublic } = body

    await notion.pages.create({
      parent: {
        data_source_id: process.env.BOSSA_LOG_DATA_SOURCE_ID,
      },
      properties: {
        기록명: {
          title: [{ text: { content: title || '제목 없는 기록' } }],
        },
        날짜: {
          date: { start: new Date().toISOString() },
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
      },
    })

    return res.status(200).json({ ok: true })
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message,
    })
  }
}