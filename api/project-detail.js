import { Client } from '@notionhq/client'

const notion = new Client({ auth: process.env.NOTION_TOKEN })

function text(richText = []) {
  return richText.map(item => item.plain_text).join('')
}

function getFileUrl(file) {
  if (!file) return ''
  return file.type === 'file' ? file.file.url : file.external?.url || ''
}

function toBlock(block) {
  const data = block[block.type]

  if (block.type === 'paragraph') return { type: block.type, text: text(data.rich_text) }
  if (block.type === 'heading_1') return { type: block.type, text: text(data.rich_text) }
  if (block.type === 'heading_2') return { type: block.type, text: text(data.rich_text) }
  if (block.type === 'heading_3') return { type: block.type, text: text(data.rich_text) }
  if (block.type === 'bulleted_list_item') return { type: block.type, text: text(data.rich_text) }
  if (block.type === 'numbered_list_item') return { type: block.type, text: text(data.rich_text) }
  if (block.type === 'quote') return { type: block.type, text: text(data.rich_text) }

  if (block.type === 'image') {
    return {
      type: block.type,
      url: getFileUrl(data),
      caption: text(data.caption),
    }
  }

  return null
}

async function listBlocks(blockId) {
  const blocks = []
  let cursor

  do {
    const response = await notion.blocks.children.list({
      block_id: blockId,
      page_size: 100,
      start_cursor: cursor,
    })

    blocks.push(...response.results.map(toBlock).filter(Boolean))
    cursor = response.has_more ? response.next_cursor : undefined
  } while (cursor)

  return blocks
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const id = String(req.query?.id || '').trim()

    if (!id) {
      return res.status(400).json({ ok: false, error: 'Missing project id' })
    }

    const blocks = await listBlocks(id)

    return res.status(200).json({
      ok: true,
      blocks,
    })
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message,
    })
  }
}
