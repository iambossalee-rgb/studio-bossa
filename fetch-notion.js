import 'dotenv/config'
import { Client } from '@notionhq/client'
import fs from 'fs'

const notion = new Client({ auth: process.env.NOTION_TOKEN })

function text(richText = []) {
  return richText.map(t => t.plain_text).join('')
}

function getTitle(prop) {
  return text(prop?.title)
}

function getText(prop) {
  return text(prop?.rich_text)
}

function getSelect(prop) {
  return prop?.select?.name || ''
}

function getNumber(prop) {
  return prop?.number || ''
}

function getCheckbox(prop) {
  return prop?.checkbox ?? true
}

function getImage(prop) {
  const file = prop?.files?.[0]
  if (!file) return ''
  return file.type === 'file' ? file.file.url : file.external.url
}

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^\w가-힣\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

function blockToContent(block) {
  const type = block.type
  const data = block[type]

  if (type === 'paragraph') {
    return { type, text: text(data.rich_text) }
  }

  if (type === 'heading_1' || type === 'heading_2' || type === 'heading_3') {
    return { type, text: text(data.rich_text) }
  }

  if (type === 'bulleted_list_item' || type === 'numbered_list_item') {
    return { type, text: text(data.rich_text) }
  }

  if (type === 'quote') {
    return { type, text: text(data.rich_text) }
  }

  if (type === 'divider') {
    return { type }
  }

  if (type === 'image') {
    const imageUrl =
      data.type === 'file' ? data.file.url : data.external.url

    return {
      type: 'image',
      url: imageUrl,
      caption: text(data.caption)
    }
  }

  return null
}

async function getBlocks(pageId) {
  const response = await notion.blocks.children.list({
    block_id: pageId,
    page_size: 100
  })

  return response.results
    .map(blockToContent)
    .filter(Boolean)
    .filter(block => block.type !== 'paragraph' || block.text.trim() !== '')
}

async function run() {
  const response = await notion.dataSources.query({
    data_source_id: process.env.NOTION_DATABASE_ID,
  })

  const projects = []

  fs.mkdirSync('public/projects', { recursive: true })

  for (const page of response.results) {
    const props = page.properties

    const title = getTitle(props['프로젝트명'])
    const slug = slugify(title)

    const project = {
      id: page.id,
      slug,
      title,
      brand: getSelect(props['브랜드']),
      category: getSelect(props['카테고리']),
      year: getNumber(props['년도']) || getNumber(props['연도']),
      summary: getText(props['요약']),
      image: getImage(props['대표이미지']),
      public: getCheckbox(props['공개'])
    }

    if (!project.public) continue

    const blocks = await getBlocks(page.id)

    projects.push(project)

    fs.writeFileSync(
      `public/projects/${slug}.json`,
      JSON.stringify({ ...project, blocks }, null, 2)
    )
  }

  fs.writeFileSync(
    'public/projects.json',
    JSON.stringify(projects, null, 2)
  )

  console.log('완료: projects.json + 상세 JSON 생성')
  console.log(projects.map(p => p.title))
}

run()