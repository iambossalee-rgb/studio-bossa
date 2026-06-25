import 'dotenv/config'
import { Client } from '@notionhq/client'
import fs from 'fs'
import path from 'path'

const notion = new Client({ auth: process.env.NOTION_TOKEN })

function text(richText = []) {
  return richText.map(t => t.plain_text).join('')
}

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^\w가-힣\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

function getTitle(prop) { return text(prop?.title) }
function getText(prop) { return text(prop?.rich_text) }
function getSelect(prop) { return prop?.select?.name || '' }
function getNumber(prop) { return prop?.number || '' }
function getCheckbox(prop) { return prop?.checkbox ?? true }

function getNotionImageUrl(prop) {
  const file = prop?.files?.[0]
  if (!file) return ''
  return file.type === 'file' ? file.file.url : file.external.url
}

function imageExt(url) {
  const clean = new URL(url).pathname
  const ext = path.extname(clean).split('?')[0]
  return ext || '.jpg'
}

async function downloadImage(url, filePath) {
  if (!url) return ''
  const response = await fetch(url)
  if (!response.ok) return ''

  const buffer = Buffer.from(await response.arrayBuffer())
  fs.writeFileSync(filePath, buffer)
  return filePath
}

async function saveImage(url, slug, name) {
  if (!url) return ''

  const dir = `public/images/${slug}`
  fs.mkdirSync(dir, { recursive: true })

  const ext = imageExt(url)
  const fileName = `${name}${ext}`
  const localPath = `${dir}/${fileName}`

  await downloadImage(url, localPath)

  return `/images/${slug}/${fileName}`
}

async function blockToContent(block, slug, index) {
  const type = block.type
  const data = block[type]

  if (type === 'paragraph') return { type, text: text(data.rich_text) }
  if (type === 'heading_1') return { type, text: text(data.rich_text) }
  if (type === 'heading_2') return { type, text: text(data.rich_text) }
  if (type === 'heading_3') return { type, text: text(data.rich_text) }
  if (type === 'bulleted_list_item') return { type, text: text(data.rich_text) }
  if (type === 'numbered_list_item') return { type, text: text(data.rich_text) }
  if (type === 'quote') return { type, text: text(data.rich_text) }
  if (type === 'divider') return { type }

  if (type === 'image') {
    const notionUrl = data.type === 'file' ? data.file.url : data.external.url
    const localUrl = await saveImage(notionUrl, slug, `block-${index}`)

    return {
      type: 'image',
      url: localUrl,
      caption: text(data.caption)
    }
  }

  return null
}

async function getBlocks(pageId, slug) {
  const response = await notion.blocks.children.list({
    block_id: pageId,
    page_size: 100
  })

  const blocks = []

  for (let i = 0; i < response.results.length; i++) {
    const block = await blockToContent(response.results[i], slug, i)
    if (block && (block.type !== 'paragraph' || block.text.trim() !== '')) {
      blocks.push(block)
    }
  }

  return blocks
}

async function run() {
  const response = await notion.dataSources.query({
    data_source_id: process.env.NOTION_DATABASE_ID,
  })

  const projects = []

  fs.mkdirSync('public/projects', { recursive: true })
  fs.mkdirSync('public/images', { recursive: true })

  for (const page of response.results) {
    const props = page.properties

    const title = getTitle(props['프로젝트명'])
    const slug = slugify(title)

    const notionImage = getNotionImageUrl(props['대표이미지'])
    const localImage = await saveImage(notionImage, slug, 'cover')

    const project = {
      id: page.id,
      slug,
      title,
      brand: getSelect(props['브랜드']),
      category: getSelect(props['카테고리']),
      year: getNumber(props['년도']) || getNumber(props['연도']),
      summary: getText(props['요약']),
      image: localImage,
      public: getCheckbox(props['공개'])
    }

    if (!project.public) continue

    const blocks = await getBlocks(page.id, slug)

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

  console.log('완료: 이미지 로컬 저장 + JSON 생성')
  console.log(projects.map(p => p.title))
}

run()