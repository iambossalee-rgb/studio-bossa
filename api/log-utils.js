export function getLogDataSourceId() {
  const dataSourceId =
    process.env.BOSSA_LOG_DATA_SOURCE_ID ||
    process.env.NOTION_LOG_DATA_SOURCE_ID ||
    process.env.BOSSA_LOG_DATABASE_ID

  if (!dataSourceId) {
    throw new Error('Missing BOSSA_LOG_DATA_SOURCE_ID. Share the BOSSA Log data source with the Notion integration and add its data source ID to the environment.')
  }

  return dataSourceId
}

export function text(richText = []) {
  return richText.map(item => item.plain_text).join('')
}

function getTitle(prop) { return text(prop?.title) }
function getText(prop) { return text(prop?.rich_text) }
function getSelect(prop) { return prop?.select?.name || '' }
function getDate(prop) { return prop?.date?.start || '' }
function getCheckbox(prop) { return Boolean(prop?.checkbox) }

export function toLog(page) {
  const props = page.properties
  const content = getText(props['본문'])

  return {
    id: page.id,
    title: getTitle(props['기록명']) || '제목 없는 기록',
    content,
    preview: content.replace(/\s+/g, ' ').trim().slice(0, 120),
    project: getSelect(props['프로젝트']),
    status: getSelect(props['상태']),
    date: getDate(props['날짜']),
    isPublic: getCheckbox(props['공개']),
  }
}
