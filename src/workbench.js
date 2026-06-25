let bossaLogs = []
let bossaProjectOptions = []
let bossaTypeOptions = []
let bossaTagOptions = []
let selectedLogId = null
let editingLogId = null
let workbenchView = 'all'
let workbenchFilter = null

function escapeHtml(text = '') {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function escapeAttr(text = '') {
  return escapeHtml(text).replaceAll("'", '&#039;')
}

function todayLabel() {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).format(new Date())
}

function formatDate(date) {
  if (!date) return ''

  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

function logPreview(log) {
  return log.preview || log.content || '본문이 비어 있습니다.'
}

function parseTags(value = '') {
  return String(value)
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean)
}

function currentLog() {
  return bossaLogs.find(log => log.id === selectedLogId) || null
}

function groupName(value) {
  return value || '미분류'
}

function viewLabel() {
  if (workbenchFilter) return workbenchFilter.value
  if (workbenchView === 'type') return '유형'
  if (workbenchView === 'project') return '프로젝트'
  return '전체'
}

function filteredLogs() {
  if (!workbenchFilter) return bossaLogs

  return bossaLogs.filter(log => groupName(log[workbenchFilter.kind]) === workbenchFilter.value)
}

function groupLogs(logs, key) {
  const groups = new Map()

  for (const log of logs) {
    const name = groupName(log[key])
    if (!groups.has(name)) groups.set(name, [])
    groups.get(name).push(log)
  }

  return [...groups.entries()]
    .map(([name, items]) => ({ name, items }))
    .sort((a, b) => {
      if (a.name === '미분류') return 1
      if (b.name === '미분류') return -1
      return new Date(b.items[0]?.date || 0) - new Date(a.items[0]?.date || 0)
    })
}

function renderMetaChips(log) {
  const tags = Array.isArray(log.tags) ? log.tags : []
  const chips = [
    log.project || '',
    log.type || '',
    ...tags.map(tag => `#${tag}`),
  ].filter(Boolean)

  return chips.length
    ? `<div class="wb-log-meta">${chips.map(chip => `<span>${escapeHtml(chip)}</span>`).join('')}</div>`
    : ''
}

function renderLogDetailCard(log) {
  return `
    <div class="wb-detail-lightbox">
      <div class="wb-detail-overlay"></div>
      <div class="wb-detail-modal" onclick="event.stopPropagation()">
        <div class="wb-detail-meta">
          <time>${escapeHtml(formatDate(log.date))}</time>
          <span>${escapeHtml(log.project || '프로젝트 없음')}</span>
          ${log.type ? `<span>${escapeHtml(log.type)}</span>` : ''}
          ${(log.tags || []).map(tag => `<span>#${escapeHtml(tag)}</span>`).join('')}
          <em>${escapeHtml(log.status || '작업중')}</em>
        </div>
        <h3>${escapeHtml(log.title)}</h3>
        <div class="wb-detail-body">${escapeHtml(log.content || '본문이 비어 있습니다.')}</div>
        <div class="wb-detail-actions">
          <button onclick="closeLogDetail()">닫기</button>
          <button onclick="editSelectedLog()">수정하기</button>
        </div>
      </div>
    </div>
  `
}

function renderSelectedLogDetail() {
  const log = currentLog()
  return log ? renderLogDetailCard(log) : ''
}

function renderLogs(logs = []) {
  if (!logs.length) {
    return `
      <article class="wb-empty">
        <time>오늘</time>
        <div>
          <h4>아직 기록이 없습니다</h4>
          <p>위 입력창에 오늘의 생각을 남기면 이곳에 쌓입니다.</p>
        </div>
        <em>empty</em>
      </article>
    `
  }

  return logs.map(log => {
    const isSelected = selectedLogId === log.id

    return `
    <article class="wb-log ${isSelected ? 'active' : ''}" onclick="openLogDetail('${escapeAttr(log.id)}')">
      <div class="wb-log-summary">
        <time>${escapeHtml(formatDate(log.date))}</time>
        <div>
          <h4>${escapeHtml(log.title)}</h4>
          <p>${escapeHtml(logPreview(log))}</p>
          ${renderMetaChips(log)}
        </div>
        <em>${escapeHtml(log.status || '작업중')}</em>
      </div>
    </article>
  `
  }).join('')
}

function renderViewTabs() {
  const tabs = [
    ['all', '전체'],
    ['type', '유형'],
    ['project', '프로젝트'],
  ]

  return `
    <div class="wb-view-tabs">
      ${tabs.map(([view, label]) => `
        <button class="${workbenchView === view ? 'active' : ''}" onclick="setWorkbenchView('${view}')">${label}</button>
      `).join('')}
    </div>
  `
}

function renderFilterHeader() {
  return `
    <div class="wb-filter-head">
      <div>
        <h4>${escapeHtml(viewLabel())}</h4>
        <small>${filteredLogs().length} records</small>
      </div>
      ${workbenchFilter ? `<button onclick="clearWorkbenchFilter()">전체 보기</button>` : ''}
    </div>
  `
}

function renderGroupCards(kind) {
  const groups = groupLogs(bossaLogs, kind)

  if (!groups.length) {
    return renderLogs([])
  }

  return `
    <div class="wb-group-grid">
      ${groups.map(group => `
        <article class="wb-group-card" onclick="setWorkbenchFilter('${kind}', '${escapeAttr(group.name)}')">
          <div class="wb-group-top">
            <h4>${escapeHtml(group.name)}</h4>
            <span>${group.items.length}</span>
          </div>
          <div class="wb-group-recent">
            ${group.items.slice(0, 3).map(log => `
              <p>${escapeHtml(log.title)}</p>
            `).join('')}
          </div>
        </article>
      `).join('')}
    </div>
  `
}

function renderLogBrowser() {
  const logs = filteredLogs()

  if (workbenchFilter || workbenchView === 'all') {
    return `
      ${renderViewTabs()}
      ${renderFilterHeader()}
      ${renderLogs(logs)}
    `
  }

  return `
    ${renderViewTabs()}
    ${renderFilterHeader()}
    ${renderGroupCards(workbenchView)}
  `
}

function setMessage(text) {
  const message = document.querySelector('#saveMessage')
  if (message) message.textContent = text
}

function setSelectValue(selector, value) {
  const field = document.querySelector(selector)
  if (!field) return

  if (field.tagName === 'SELECT' && value && !Array.from(field.options).some(option => option.value === value)) {
    field.add(new Option(value, value))
  }

  field.value = value || ''
}

function renderLogList() {
  const list = document.querySelector('#logList')
  if (list) list.innerHTML = renderLogBrowser()
}

function renderLogDetailHost() {
  const detailHost = document.querySelector('#logDetailHost')
  if (detailHost) detailHost.innerHTML = renderSelectedLogDetail()
}

function renderWorkbenchLogs(logs = bossaLogs) {
  renderLogList(logs)
  renderLogDetailHost()
}

function renderProjectOptions() {
  renderDatalist('#logProjectOptions', bossaProjectOptions)
  renderDatalist('#logTypeOptions', bossaTypeOptions)
  renderDatalist('#logTagOptions', bossaTagOptions)
}

function renderDatalist(selector, items) {
  const options = document.querySelector(selector)
  if (!options) return

  options.innerHTML = items
    .map(item => `<option value="${escapeAttr(item.name)}"></option>`)
    .join('')
}

function insertTextIntoField(field, text) {
  const start = field.selectionStart ?? field.value.length
  const end = field.selectionEnd ?? field.value.length

  field.setRangeText(text, start, end, 'end')

  try {
    field.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      inputType: 'insertFromPaste',
      data: text,
    }))
  } catch {
    field.dispatchEvent(new Event('input', { bubbles: true }))
  }
}

function setupEditorPaste() {
  const editor = document.querySelector('#logContent')
  if (!editor || editor.dataset.pasteReady === 'true') return

  editor.dataset.pasteReady = 'true'
  editor.addEventListener('paste', event => {
    const text = event.clipboardData?.getData('text/plain')
    if (!text) return

    event.preventDefault()
    insertTextIntoField(editor, text)
  })
}

function upsertLog(log) {
  if (!log?.id) return

  bossaLogs = [
    log,
    ...bossaLogs.filter(item => item.id !== log.id),
  ]
  selectedLogId = log.id
  renderWorkbenchLogs()

  if (log.project && !bossaProjectOptions.some(project => project.name === log.project)) {
    bossaProjectOptions = [...bossaProjectOptions, { name: log.project }]
    renderProjectOptions()
  }

  if (log.type && !bossaTypeOptions.some(type => type.name === log.type)) {
    bossaTypeOptions = [...bossaTypeOptions, { name: log.type }]
    renderProjectOptions()
  }

  for (const tag of log.tags || []) {
    if (!bossaTagOptions.some(option => option.name === tag)) {
      bossaTagOptions = [...bossaTagOptions, { name: tag }]
    }
  }

  renderProjectOptions()
}

function setEditingState(log) {
  editingLogId = log?.id || null
  selectedLogId = log?.id || selectedLogId

  document.querySelector('#logTitle').value = log?.title || ''
  document.querySelector('#logContent').value = log?.content || ''
  setSelectValue('#logProject', log?.project || '')
  setSelectValue('#logType', log?.type || '')
  document.querySelector('#logTags').value = (log?.tags || []).join(', ')
  setSelectValue('#logStatus', log?.status || '작업중')
  document.querySelector('#logPublic').checked = Boolean(log?.isPublic)
  document.querySelector('#logSubmit').textContent = log ? '수정하기' : '기록하기'
  document.querySelector('#logCancel').hidden = !log

  renderWorkbenchLogs()
}

export function workbenchPage() {
  return `
    <div class="workbench">
      <aside class="wb-sidebar">
        <div>
          <h1>BOSSA</h1>
          <p>WORKBENCH</p>

          <nav>
            <a class="active">오늘</a>
            <a>기록</a>
            <a>프로젝트</a>
            <a>생각</a>
            <a>이미지</a>
          </nav>
        </div>

        <small>bossa.kr/me<br>나만 보는 작업대</small>
      </aside>

      <main class="wb-main">
        <header class="wb-top">
          <span>${todayLabel()}</span>
          <button onclick="goHome()">Gallery 보기</button>
        </header>

        <section class="wb-hero">
          <h2>일단 대충 써.</h2>
          <p>지금 안적으면 다 까먹는다.</p>
        </section>

        <section class="wb-write">
          <input id="logTitle" placeholder="기록 제목" />
          <textarea id="logContent" placeholder="생각, 아이디어, 회의 메모, 오늘의 장면..."></textarea>

          <div class="wb-field-row">
            <input id="logProject" list="logProjectOptions" placeholder="프로젝트" />
            <datalist id="logProjectOptions"></datalist>

            <input id="logType" list="logTypeOptions" placeholder="유형" />
            <datalist id="logTypeOptions"></datalist>

            <input id="logTags" list="logTagOptions" placeholder="태그, 쉼표로 구분" />
            <datalist id="logTagOptions"></datalist>

            <select id="logStatus">
              <option value="작업중">작업중</option>
              <option value="공개후보">공개후보</option>
              <option value="공개">공개</option>
              <option value="보관">보관</option>
            </select>

            <label class="wb-check">
              <input id="logPublic" type="checkbox" />
              공개
            </label>
          </div>

          <div class="wb-actions">
            <span>이미지</span>
            <span>음성</span>
            <span># 태그</span>
            <button id="logCancel" class="wb-secondary-action" onclick="cancelLogEditing()" hidden>취소</button>
            <button id="logSubmit" onclick="createBossaLog()">기록하기</button>
          </div>

          <p id="saveMessage" class="wb-message"></p>
        </section>

        <section class="wb-list">
          <div class="wb-section-head">
            <h3>오늘의 기록</h3>
            <small>recent</small>
          </div>

          <div id="logList">
            <article class="wb-empty">
              <time>로딩</time>
              <div>
                <h4>기록을 불러오는 중입니다</h4>
                <p>Notion에서 최근 기록을 가져오고 있습니다.</p>
              </div>
              <em>load</em>
            </article>
          </div>
          <div id="logDetailHost">${renderSelectedLogDetail()}</div>
        </section>
      </main>
    </div>
  `
}

export function initWorkbench() {
  setupEditorPaste()
  loadBossaLogs()
  loadProjectOptions()
}

window.loadBossaLogs = async function ({ silent = false } = {}) {
  const list = document.querySelector('#logList')
  if (list && !silent) {
    list.innerHTML = `
      <article class="wb-empty">
        <time>로딩</time>
        <div>
          <h4>기록을 불러오는 중입니다</h4>
          <p>Notion에서 최근 기록을 가져오고 있습니다.</p>
        </div>
        <em>load</em>
      </article>
    `
  }

  try {
    const response = await fetch('/api/logs')
    const result = await readApiResponse(response)

    if (!result.ok) {
      throw new Error(result.error || '기록을 불러오지 못했습니다')
    }

    bossaLogs = result.logs || []
    renderWorkbenchLogs()
  } catch (error) {
    if (list) {
      list.innerHTML = `
        <article class="wb-empty">
          <time>오류</time>
          <div>
            <h4>기록을 불러오지 못했습니다</h4>
            <p>${escapeHtml(error.message)}</p>
          </div>
          <em>error</em>
        </article>
      `
    }
  }
}

window.setWorkbenchView = function (view) {
  workbenchView = view
  workbenchFilter = null
  selectedLogId = null
  renderWorkbenchLogs()
}

window.setWorkbenchFilter = function (kind, value) {
  workbenchFilter = { kind, value }
  selectedLogId = null
  renderWorkbenchLogs()
}

window.clearWorkbenchFilter = function () {
  workbenchFilter = null
  selectedLogId = null
  renderWorkbenchLogs()
}

window.loadProjectOptions = async function () {
  try {
    const response = await fetch('/api/log-options')
    const result = await readApiResponse(response)

    if (!result.ok) {
      throw new Error(result.error || '프로젝트 옵션을 불러오지 못했습니다')
    }

    bossaProjectOptions = result.projects || []
    bossaTypeOptions = result.types || []
    bossaTagOptions = result.tags || []
    renderProjectOptions()
  } catch (error) {
    setMessage(`프로젝트 옵션 로드 실패: ${error.message}`)
  }
}

async function readApiResponse(response) {
  const contentType = response.headers.get('content-type') || ''

  if (!contentType.includes('application/json')) {
    const text = await response.text()
    throw new Error(`API 응답 오류 (${response.status}): ${text.slice(0, 120)}`)
  }

  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.error || `API 요청 실패 (${response.status})`)
  }

  return result
}

window.openLogDetail = function (id) {
  const log = bossaLogs.find(item => item.id === id)
  if (!log) return

  selectedLogId = id
  renderWorkbenchLogs()
  setMessage('')
}

window.closeLogDetail = function () {
  selectedLogId = null
  renderWorkbenchLogs()
}

window.editSelectedLog = function () {
  const log = currentLog()
  if (!log) return

  setEditingState(log)
  setMessage('기록을 편집 중입니다.')
  document.querySelector('#logTitle').focus()
}

window.cancelLogEditing = function () {
  setEditingState(null)
  setMessage('')
}

window.createBossaLog = async function () {
  const title = document.querySelector('#logTitle').value.trim()
  const content = document.querySelector('#logContent').value.trim()
  const project = document.querySelector('#logProject').value
  const type = document.querySelector('#logType').value.trim()
  const tags = parseTags(document.querySelector('#logTags').value)
  const status = document.querySelector('#logStatus').value
  const isPublic = document.querySelector('#logPublic').checked
  const message = document.querySelector('#saveMessage')

  if (!title && !content) {
    message.textContent = '기록할 내용을 먼저 적어주세요.'
    return
  }

  message.textContent = '저장 중...'

  try {
    const method = editingLogId ? 'PATCH' : 'POST'
    const response = await fetch('/api/create-log', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingLogId, title, content, project, type, tags, status, isPublic }),
    })

    const result = await readApiResponse(response)

    if (!result.ok) {
      throw new Error(result.error || '저장 실패')
    }

    message.textContent = '저장되었습니다.'
    editingLogId = null
    selectedLogId = result.log?.id || null

    document.querySelector('#logTitle').value = ''
    document.querySelector('#logContent').value = ''
    document.querySelector('#logProject').value = ''
    document.querySelector('#logType').value = ''
    document.querySelector('#logTags').value = ''
    document.querySelector('#logPublic').checked = false
    document.querySelector('#logSubmit').textContent = '기록하기'
    document.querySelector('#logCancel').hidden = true

    upsertLog(result.log)
    await loadBossaLogs({ silent: true })
    await loadProjectOptions()
  } catch (error) {
    message.textContent = `저장 실패: ${error.message}`
  }
}
