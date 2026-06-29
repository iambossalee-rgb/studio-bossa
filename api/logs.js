import { Client } from '@notionhq/client'
import { getLogDataSourceId, toLog } from '../lib/log-utils.js'

const notion = new Client({ auth: process.env.NOTION_TOKEN })

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const response = await notion.dataSources.query({
      data_source_id: getLogDataSourceId(),
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
