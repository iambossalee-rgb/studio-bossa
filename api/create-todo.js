import { Client } from '@notionhq/client'
import { getTodoDataSourceId, todoPropertiesFromPayload, todoSchema, toTodo } from '../lib/todo-utils.js'

const notion = new Client({ auth: process.env.NOTION_TOKEN })

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const title = String(body?.title || '').trim()

    if (!title) {
      return res.status(400).json({ ok: false, error: '할일을 입력해주세요.' })
    }

    const dataSourceId = getTodoDataSourceId()
    const dataSource = await notion.dataSources.retrieve({
      data_source_id: dataSourceId,
    })
    const schema = todoSchema(dataSource)
    const properties = todoPropertiesFromPayload({
      ...body,
      title,
      done: body?.done ?? false,
    }, schema)

    const page = await notion.pages.create({
      parent: {
        data_source_id: dataSourceId,
      },
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
