import { Client } from '@notionhq/client'
import { getTodoDataSourceId, todoPropertiesFromPayload, todoSchema, toTodo } from '../lib/todo-utils.js'

const notion = new Client({ auth: process.env.NOTION_TOKEN })

export default async function handler(req, res) {
  if (req.method !== 'PATCH' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body

    if (!body?.id) {
      return res.status(400).json({ ok: false, error: 'Missing todo id' })
    }

    const dataSource = await notion.dataSources.retrieve({
      data_source_id: getTodoDataSourceId(),
    })
    const schema = todoSchema(dataSource)
    const properties = todoPropertiesFromPayload(body, schema, { partial: true })

    const page = await notion.pages.update({
      page_id: body.id,
      properties,
    })

    return res.status(200).json({
      ok: true,
      todo: toTodo(page, schema),
      schema,
    })
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message,
    })
  }
}
