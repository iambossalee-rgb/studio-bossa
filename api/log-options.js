import { Client } from '@notionhq/client'
import { getLogDataSourceId } from './log-utils.js'

const notion = new Client({ auth: process.env.NOTION_TOKEN })

function selectOptions(prop) {
  if (prop?.type !== 'select') return []

  return prop.select.options.map(option => ({
    id: option.id,
    name: option.name,
    color: option.color,
  }))
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const dataSource = await notion.dataSources.retrieve({
      data_source_id: getLogDataSourceId(),
    })

    return res.status(200).json({
      ok: true,
      projects: selectOptions(dataSource.properties['프로젝트']),
    })
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message,
    })
  }
}
