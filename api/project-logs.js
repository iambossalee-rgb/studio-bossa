import { Client } from '@notionhq/client'
import { getLogDataSourceId, toLog } from '../lib/log-utils.js'

const notion = new Client({ auth: process.env.NOTION_TOKEN })

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const project = String(req.query?.project || '').trim()

    if (!project) {
      return res.status(400).json({ ok: false, error: 'Missing project' })
    }

    const dataSourceId = getLogDataSourceId()
    const dataSource = await notion.dataSources.retrieve({ data_source_id: dataSourceId })
    const projectOptions = dataSource.properties['프로젝트']?.select?.options || []
    const hasProjectOption = projectOptions.some(option => option.name === project)

    if (!hasProjectOption) {
      return res.status(200).json({ ok: true, logs: [] })
    }

    const response = await notion.dataSources.query({
      data_source_id: dataSourceId,
      page_size: 20,
      filter: {
        property: '프로젝트',
        select: {
          equals: project,
        },
      },
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
