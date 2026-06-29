import { Client } from '@notionhq/client'
import { getTodoDataSourceId, todoSchema, toTodo } from '../lib/todo-utils.js'

const notion = new Client({ auth: process.env.NOTION_TOKEN })

function todoSort(a, b) {
  if (a.done !== b.done) return a.done ? 1 : -1

  const dateA = a.date || '9999-12-31'
  const dateB = b.date || '9999-12-31'
  if (dateA !== dateB) return dateA.localeCompare(dateB)

  return (a.createdTime || '').localeCompare(b.createdTime || '')
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const dataSourceId = getTodoDataSourceId()
    const dataSource = await notion.dataSources.retrieve({
      data_source_id: dataSourceId,
    })
    const schema = todoSchema(dataSource)
    const response = await notion.dataSources.query({
      data_source_id: dataSourceId,
      page_size: 100,
    })
    const todos = response.results
      .map(page => toTodo(page, schema))
      .sort(todoSort)

    return res.status(200).json({
      ok: true,
      todos,
      schema,
    })
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message,
    })
  }
}
