import { Client } from '@notionhq/client'
import { getLogDataSourceId, toLog } from './log-utils.js'

const notion = new Client({ auth: process.env.NOTION_TOKEN })
const RICH_TEXT_CHUNK_SIZE = 1900
const MAX_SUMMARY_LENGTH = 1900

function getProjectsDataSourceId() {
  if (!process.env.NOTION_DATABASE_ID) {
    throw new Error('Missing NOTION_DATABASE_ID for Projects data source.')
  }

  return process.env.NOTION_DATABASE_ID
}

function richText(value = '') {
  const text = String(value).slice(0, MAX_SUMMARY_LENGTH)
  const chunks = []

  for (let i = 0; i < text.length; i += RICH_TEXT_CHUNK_SIZE) {
    chunks.push({ text: { content: text.slice(i, i + RICH_TEXT_CHUNK_SIZE) } })
  }

  return chunks
}

function hasProperty(dataSource, name, type) {
  return dataSource.properties[name]?.type === type
}

function findStableProjectProperty(dataSource) {
  const candidates = [
    'Project ID',
    '프로젝트 ID',
    '프로젝트ID',
    'Project Page ID',
    '프로젝트 페이지 ID',
    '관련 프로젝트',
    '프로젝트 관계',
  ]

  return candidates.find(name => dataSource.properties[name])
}

function stableProjectValue(prop, projectId) {
  if (!prop || !projectId) return null

  if (prop.type === 'rich_text') {
    return { rich_text: [{ text: { content: projectId } }] }
  }

  if (prop.type === 'url') {
    return { url: `https://www.notion.so/${projectId.replaceAll('-', '')}` }
  }

  if (prop.type === 'relation') {
    return { relation: [{ id: projectId }] }
  }

  return null
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const logId = String(body?.logId || '').trim()
    const title = String(body?.title || '').trim()
    const summary = String(body?.summary || '').trim()

    if (!logId) {
      return res.status(400).json({ ok: false, error: 'Missing log id' })
    }

    if (!title) {
      return res.status(400).json({ ok: false, error: '프로젝트명을 입력해주세요.' })
    }

    const projectDataSourceId = getProjectsDataSourceId()
    const [projectDataSource, logDataSource] = await Promise.all([
      notion.dataSources.retrieve({ data_source_id: projectDataSourceId }),
      notion.dataSources.retrieve({ data_source_id: getLogDataSourceId() }),
    ])

    const skipped = []
    const imageProperty =
      hasProperty(projectDataSource, '대표이미지', 'files')
        ? '대표이미지'
        : Object.entries(projectDataSource.properties).find(([, prop]) => prop.type === 'files')?.[0] || ''

    const properties = {}

    if (hasProperty(projectDataSource, '프로젝트명', 'title')) {
      properties['프로젝트명'] = {
        title: [{ text: { content: title } }],
      }
    } else {
      throw new Error('Projects DB에 title 속성(프로젝트명)이 없습니다.')
    }

    if (hasProperty(projectDataSource, '요약', 'rich_text')) {
      properties['요약'] = {
        rich_text: richText(summary),
      }
    } else {
      skipped.push('요약')
    }

    if (hasProperty(projectDataSource, '공개', 'checkbox')) {
      properties['공개'] = {
        checkbox: false,
      }
    } else {
      skipped.push('공개')
    }

    const projectPage = await notion.pages.create({
      parent: {
        data_source_id: projectDataSourceId,
      },
      properties,
    })

    const logProperties = {
      프로젝트: {
        select: { name: title },
      },
    }

    const stablePropertyName = findStableProjectProperty(logDataSource)
    const stableProperty = stablePropertyName ? logDataSource.properties[stablePropertyName] : null
    const stableValue = stableProjectValue(stableProperty, projectPage.id)

    if (stablePropertyName && stableValue) {
      logProperties[stablePropertyName] = stableValue
    } else if (stablePropertyName) {
      skipped.push(`${stablePropertyName}(${stableProperty.type})`)
    }

    const updatedLog = await notion.pages.update({
      page_id: logId,
      properties: logProperties,
    })

    return res.status(200).json({
      ok: true,
      project: {
        id: projectPage.id,
        title,
        summary,
        public: false,
      },
      log: toLog(updatedLog),
      schema: {
        imageProperty,
        stableProjectProperty: stableValue ? stablePropertyName : '',
        skipped,
      },
    })
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message,
    })
  }
}
