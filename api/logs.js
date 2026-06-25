import { Client } from '@notionhq/client'

const notion = new Client({ auth: process.env.NOTION_TOKEN })

function text(richText = []) {
  return richText.map(item => item.plain_text).join('')
}

function getTitle(prop) { return text(prop?.title) }
function getText(prop) { return text(prop?.rich_text) }
function getSelect(prop) { return prop?.select?.name || '' }
function getDate(prop) { return prop?.date?.start || '' }
function getCheckbox(prop) { return Boolean(prop?.checkbox) }

function toLog(page) {
  const props = page.properties
  const content = getText(props['본문'])

  return {
    id: page.id,
    title: getTitle(props['기록명']) || '제목 없는 기록',
    content,
    preview: content.replace(/\s+/g, ' ').trim().slice(0, 120),
    project: getSelect(props['프로젝트']),
    status: getSelect(props['상태']),
    date: getDate(props['날짜']),
    isPublic: getCheckbox(props['공개']),
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const response = await notion.dataSources.query({
      data_source_id: process.env.BOSSA_LOG_DATA_SOURCE_ID,
      page_size: 30,
      sorts: [
        {
          property: '날짜',
          direction: 'descending',
        },
      ],
    })

    return res.status(200).json({
      ok: true,
      logs: response.results.map(toLog),
    })
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message,
    })
  }
}
