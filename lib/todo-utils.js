export function getTodoDataSourceId() {
  const dataSourceId = process.env.TODO_DATABASE_ID

  if (!dataSourceId) {
    throw new Error('Missing TODO_DATABASE_ID. Share the Today Todo Notion database with the integration and add its data source ID to the environment.')
  }

  return dataSourceId
}

export function text(richText = []) {
  return richText.map(item => item.plain_text).join('')
}

function richText(value = '') {
  return [{ text: { content: String(value || '') } }]
}

function propertyByName(properties = {}, names = []) {
  for (const name of names) {
    if (properties[name]) return { name, property: properties[name] }
  }

  const lowerEntries = Object.entries(properties).map(([name, property]) => [name.toLocaleLowerCase('ko'), name, property])
  for (const name of names) {
    const found = lowerEntries.find(([lowerName]) => lowerName === name.toLocaleLowerCase('ko'))
    if (found) return { name: found[1], property: found[2] }
  }

  return null
}

export const todoFields = {
  title: ['할일', '제목', 'Name', 'name', 'title', 'Title'],
  date: ['날짜', 'Date', 'date'],
  detail: ['세부내용', '상세', '내용', 'Detail', 'detail', 'Description', 'description'],
  status: ['상태', 'Status', 'status'],
  category: ['분류', '카테고리', 'Category', 'category'],
  priority: ['중요도', '언제까지', 'Priority', 'priority'],
  counterparty: ['상대', 'Counterparty', 'counterparty', 'Client', 'client'],
  done: ['완료', 'Done', 'done', 'Complete', 'complete'],
  url: ['URL', 'Url', 'url', '링크', 'Link', 'link'],
  note: ['비고', '메모', 'Note', 'note'],
}

export function todoSchema(dataSource) {
  const properties = dataSource.properties || {}
  const schema = {}

  for (const [field, names] of Object.entries(todoFields)) {
    const match = propertyByName(properties, names)
    if (match) {
      schema[field] = {
        name: match.name,
        type: match.property.type,
      }
    }
  }

  return schema
}

function propValue(prop) {
  if (!prop) return ''

  if (prop.type === 'title') return text(prop.title)
  if (prop.type === 'rich_text') return text(prop.rich_text)
  if (prop.type === 'select') return prop.select?.name || ''
  if (prop.type === 'status') return prop.status?.name || ''
  if (prop.type === 'multi_select') return prop.multi_select?.map(option => option.name).join(', ') || ''
  if (prop.type === 'date') return prop.date?.start || ''
  if (prop.type === 'url') return prop.url || ''
  if (prop.type === 'checkbox') return Boolean(prop.checkbox)
  if (prop.type === 'number') return prop.number ?? ''

  return ''
}

function valueFor(page, schema, field) {
  const propertyName = schema[field]?.name
  return propertyName ? propValue(page.properties[propertyName]) : ''
}

export function toTodo(page, schema = todoSchema({ properties: page.properties || {} })) {
  const title = valueFor(page, schema, 'title') || '제목 없는 할일'

  return {
    id: page.id,
    date: valueFor(page, schema, 'date'),
    title,
    detail: valueFor(page, schema, 'detail'),
    status: valueFor(page, schema, 'status'),
    category: valueFor(page, schema, 'category'),
    priority: valueFor(page, schema, 'priority'),
    counterparty: valueFor(page, schema, 'counterparty'),
    done: Boolean(valueFor(page, schema, 'done')),
    url: valueFor(page, schema, 'url'),
    note: valueFor(page, schema, 'note'),
    createdTime: page.created_time || '',
    lastEditedTime: page.last_edited_time || '',
  }
}

function setTextProperty(properties, schema, field, value, { includeEmpty = false } = {}) {
  if (value === undefined || (!includeEmpty && value === '')) return

  const target = schema[field]
  if (!target) return

  if (target.type === 'rich_text') {
    properties[target.name] = { rich_text: richText(value) }
  } else if (target.type === 'url') {
    properties[target.name] = { url: String(value || '') || null }
  }
}

function setSelectLikeProperty(properties, schema, field, value) {
  if (value === undefined || value === '') return

  const target = schema[field]
  if (!target) return

  const names = String(value)
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)

  if (!names.length) return

  if (target.type === 'select') {
    properties[target.name] = { select: { name: names[0] } }
  } else if (target.type === 'status') {
    properties[target.name] = { status: { name: names[0] } }
  } else if (target.type === 'multi_select') {
    properties[target.name] = { multi_select: names.map(name => ({ name })) }
  } else if (target.type === 'rich_text') {
    properties[target.name] = { rich_text: richText(value) }
  }
}

function setDateProperty(properties, schema, field, value) {
  if (value === undefined || value === '') return

  const target = schema[field]
  if (!target || target.type !== 'date') return

  properties[target.name] = {
    date: { start: String(value) },
  }
}

function setCheckboxProperty(properties, schema, field, value) {
  if (value === undefined) return

  const target = schema[field]
  if (!target || target.type !== 'checkbox') return

  properties[target.name] = { checkbox: Boolean(value) }
}

export function todoPropertiesFromPayload(payload = {}, schema = {}, { partial = false } = {}) {
  const properties = {}

  if (!partial || payload.title !== undefined) {
    const titleTarget = schema.title
    if (!titleTarget || titleTarget.type !== 'title') {
      throw new Error('Todo DB에 제목 속성(할일)을 찾지 못했습니다.')
    }

    properties[titleTarget.name] = {
      title: [{ text: { content: payload.title || '제목 없는 할일' } }],
    }
  }

  setDateProperty(properties, schema, 'date', payload.date)
  setTextProperty(properties, schema, 'detail', payload.detail, { includeEmpty: partial })
  setSelectLikeProperty(properties, schema, 'status', payload.status)
  setSelectLikeProperty(properties, schema, 'category', payload.category)
  setSelectLikeProperty(properties, schema, 'priority', payload.priority)
  setSelectLikeProperty(properties, schema, 'counterparty', payload.counterparty)
  setCheckboxProperty(properties, schema, 'done', payload.done)
  setTextProperty(properties, schema, 'url', payload.url, { includeEmpty: partial })
  setTextProperty(properties, schema, 'note', payload.note, { includeEmpty: partial })

  return properties
}
