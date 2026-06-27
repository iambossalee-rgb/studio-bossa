import { Client } from '@notionhq/client'

const notion = new Client({ auth: process.env.NOTION_TOKEN })

function text(richText = []) {
  return richText.map(item => item.plain_text).join('')
}

function getTitle(prop) { return text(prop?.title) }
function getText(prop) { return text(prop?.rich_text) }
function getSelect(prop) { return prop?.select?.name || '' }
function getMultiSelect(prop) { return prop?.multi_select?.map(option => option.name) || [] }
function getNumber(prop) { return prop?.number || '' }
function getCheckbox(prop) { return prop?.checkbox ?? true }

function getFileUrl(file) {
  if (!file) return ''
  return file.type === 'file' ? file.file.url : file.external?.url || ''
}

function getNotionImageUrl(prop) {
  return getFileUrl(prop?.files?.[0])
}

function getPageCoverUrl(page) {
  return getFileUrl(page.cover)
}

function getUrl(prop) {
  return prop?.url || ''
}

function isVercelBlobUrl(url = '') {
  return /\.blob\.vercel-storage\.com\//.test(url)
}

function compactUnique(items = []) {
  return items.filter((item, index, array) => item && array.indexOf(item) === index)
}

function getImageUrlsFromProperty(prop) {
  if (!prop) return []

  if (prop.type === 'files') return prop.files?.map(getFileUrl).filter(Boolean) || []
  if (prop.type === 'url') return [getUrl(prop)].filter(Boolean)
  if (prop.type === 'rich_text') {
    return getText(prop)
      .split(/\s+/)
      .map(item => item.trim())
      .filter(item => /^https?:\/\//.test(item))
  }

  return []
}

function getProjectImageCandidates(page) {
  const props = page.properties || {}
  const imageProperties = [
    props['대표이미지'],
    props['이미지'],
    props['image'],
    props['Image'],
    props['cover'],
    props['Cover'],
    props['thumbnail'],
    props['Thumbnail'],
    props['썸네일'],
    props['이미지URL'],
    props['Image URLs'],
  ]

  const propertyImages = compactUnique(imageProperties.flatMap(getImageUrlsFromProperty))
  const blobImages = propertyImages.filter(isVercelBlobUrl)
  const nonBlobImages = propertyImages.filter(url => !isVercelBlobUrl(url))

  return compactUnique([
    ...blobImages,
    ...nonBlobImages,
    getPageCoverUrl(page),
  ])
}

function getProjectsDataSourceId() {
  if (!process.env.NOTION_DATABASE_ID) {
    throw new Error('Missing NOTION_DATABASE_ID for Projects data source.')
  }

  return process.env.NOTION_DATABASE_ID
}

function toProject(page) {
  const props = page.properties
  const imageCandidates = getProjectImageCandidates(page)
  const image = imageCandidates[0] || ''

  return {
    id: page.id,
    title: getTitle(props['프로젝트명']) || '제목 없는 프로젝트',
    brand: getSelect(props['브랜드']),
    category: getSelect(props['카테고리']),
    status: getSelect(props['상태']) || getSelect(props['진행상태']),
    tags: getMultiSelect(props['태그']).length
      ? getMultiSelect(props['태그'])
      : getMultiSelect(props['Tags']),
    year: getNumber(props['년도']) || getNumber(props['연도']),
    summary: getText(props['요약']),
    image,
    imageCandidates,
    url: page.url || '',
    public: getCheckbox(props['공개']),
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate')

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const response = await notion.dataSources.query({
      data_source_id: getProjectsDataSourceId(),
      page_size: 50,
    })

    const includePrivate = req.query?.includePrivate === '1'
    const projects = response.results
      .map(toProject)
      .filter(project => includePrivate || project.public)

    return res.status(200).json({ ok: true, projects })
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message,
    })
  }
}
