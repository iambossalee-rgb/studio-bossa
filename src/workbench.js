let bossaLogs = []
let bossaProjectOptions = []
let bossaTypeOptions = []
let bossaTagOptions = []
let selectedLogId = null
let editingLogId = null
let metadataEditingLogId = null
let deleteConfirmLogId = null
let workbenchView = 'logs'
let bossaProjects = []
let bossaProjectsLoaded = false

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

function projectMeta(project) {
  return [
    project.brand || '',
    project.category || '',
    project.status || '',
    project.year || '',
  ].filter(Boolean)
}

function renderProjectCards(projects = []) {
  if (!projects.length) {
    return `
      <article class="wb-empty">
        <time>프로젝트</time>
        <div>
          <h4>프로젝트를 불러오지 못했습니다</h4>
          <p>Projects 데이터 소스에 공개된 항목이 있으면 이곳에 표시됩니다.</p>
        </div>
        <em>empty</em>
      </article>
    `
  }

  return projects.map(project => {
    const meta = projectMeta(project)

    return `
      <article class="wb-project-card">
        ${project.image ? `<img src="${escapeAttr(project.image)}" alt="${escapeAttr(project.title)}" />` : ''}
        <div>
          ${meta.length ? `<div class="wb-project-meta">${meta.map(item => `<span>${escapeHtml(item)}</span>`).join('')}</div>` : ''}
          <h4>${escapeHtml(project.title)}</h4>
          <p>${escapeHtml(project.summary || project.category || '요약이 없습니다.')}</p>
        </div>
      </article>
    `
  }).join('')
}

function renderLogDetailCard(log) {
  const isEditing = editingLogId === log.id
  const isMetadataEditing = isEditing || metadataEditingLogId === log.id
  const isConfirmingDelete = deleteConfirmLogId === log.id
  const editLock = isMetadataEditing ? '' : 'disabled'
  const detailTitle = isEditing
    ? `<input id="detailTitle" class="wb-detail-title-input" value="${escapeAttr(log.title)}" placeholder="기록 제목" />`
    : `<h3>${escapeHtml(log.title)}</h3>`
  const detailBody = isEditing
    ? `<textarea id="detailContent" class="wb-detail-body-input" placeholder="본문">${escapeHtml(log.content || '')}</textarea>`
    : `<div class="wb-detail-body">${escapeHtml(log.content || '본문이 비어 있습니다.')}</div>`

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
        ${detailTitle}
        ${detailBody}
        <div class="wb-detail-fields">
          <input id="detailProject" list="logProjectOptions" value="${escapeAttr(log.project || '')}" placeholder="프로젝트" ${editLock} />
          <input id="detailType" list="logTypeOptions" value="${escapeAttr(log.type || '')}" placeholder="유형" ${editLock} />
          <select id="detailTagSelect" class="wb-tag-select" multiple aria-label="태그 선택" ${editLock}>
            ${renderMultiSelectOptionMarkup(bossaTagOptions, log.tags || [])}
          </select>
          <input id="detailTags" class="wb-tag-input" list="logTagOptions" placeholder="새 태그, 쉼표로 구분" ${editLock} />
          <select id="detailStatus" ${editLock}>
            ${renderStatusOptions(log.status || '작업중')}
          </select>
          <label class="wb-check">
            <input id="detailPublic" type="checkbox" ${log.isPublic ? 'checked' : ''} ${editLock} />
            공개
          </label>
        </div>
        <div class="wb-detail-actions">
          <button onclick="closeLogDetail()">닫기</button>
          <button class="wb-danger-action" onclick="requestDeleteLog('${escapeAttr(log.id)}')">삭제</button>
          ${
            isEditing
              ? '<button onclick="createBossaLog()">저장하기</button>'
              : isMetadataEditing
                ? '<button onclick="saveLogMetadata()">확인</button>'
                : '<button onclick="editSelectedLog()">수정하기</button>'
          }
        </div>
      </div>
      ${isConfirmingDelete ? `
        <div class="wb-delete-confirm-layer">
          <div class="wb-delete-confirm-overlay"></div>
          <div class="wb-delete-confirm" onclick="event.stopPropagation()">
            <p>삭제하시겠습니까?</p>
            <div>
              <button onclick="cancelDeleteLog()">취소</button>
              <button onclick="confirmDeleteLog('${escapeAttr(log.id)}')">확인</button>
            </div>
          </div>
        </div>
      ` : ''}
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

function renderLogList(logs = bossaLogs) {
  const list = document.querySelector('#logList')
  if (list) list.innerHTML = renderLogs(logs)
}

function renderLogDetailHost() {
  const detailHost = document.querySelector('#logDetailHost')
  if (detailHost) detailHost.innerHTML = renderSelectedLogDetail()
}

function renderWorkbenchLogs(logs = bossaLogs) {
  renderLogList(logs)
  renderLogDetailHost()
}

function renderWorkbenchView() {
  const logPanel = document.querySelector('#workbenchLogPanel')
  const projectPanel = document.querySelector('#workbenchProjectPanel')
  const tabs = document.querySelectorAll('.wb-tab')

  for (const tab of tabs) {
    tab.classList.toggle('active', tab.dataset.view === workbenchView)
  }

  if (logPanel) logPanel.hidden = workbenchView !== 'logs'
  if (projectPanel) projectPanel.hidden = workbenchView !== 'projects'
}

function renderWorkbenchProjects(projects = bossaProjects) {
  const list = document.querySelector('#projectList')
  if (list) list.innerHTML = renderProjectCards(projects)
}

function renderProjectOptions() {
  renderDatalist('#logProjectOptions', bossaProjectOptions)
  renderDatalist('#logTypeOptions', bossaTypeOptions)
  renderTagSelectOptions('#detailTagSelect')
  renderDatalist('#logTagOptions', bossaTagOptions)
}

function renderDatalist(selector, items) {
  const options = document.querySelector(selector)
  if (!options) return

  options.innerHTML = items
    .map(item => `<option value="${escapeAttr(item.name)}"></option>`)
    .join('')
}

function renderSelectOptions(selector, items, placeholder) {
  const select = document.querySelector(selector)
  if (!select) return

  const currentValue = select.value
  select.innerHTML = renderSelectOptionMarkup(items, placeholder, currentValue)
  select.value = currentValue
}

function renderSelectOptionMarkup(items, placeholder, selectedValue = '') {
  return `
    <option value="">${escapeHtml(placeholder)}</option>
    ${items.map(item => `
      <option value="${escapeAttr(item.name)}" ${item.name === selectedValue ? 'selected' : ''}>${escapeHtml(item.name)}</option>
    `).join('')}
  `
}

function renderMultiSelectOptionMarkup(items, selectedValues = []) {
  return items.map(item => `
    <option value="${escapeAttr(item.name)}" ${selectedValues.includes(item.name) ? 'selected' : ''}>${escapeHtml(item.name)}</option>
  `).join('')
}

function renderStatusOptions(selectedValue = '작업중') {
  return ['작업중', '공개후보', '공개', '보관']
    .map(status => `<option value="${escapeAttr(status)}" ${status === selectedValue ? 'selected' : ''}>${escapeHtml(status)}</option>`)
    .join('')
}

function renderTagSelectOptions(selector) {
  const select = document.querySelector(selector)
  if (!select) return

  const selectedValues = selectedOptions(select)
  select.innerHTML = renderMultiSelectOptionMarkup(bossaTagOptions, selectedValues)

  setMultiSelectValues(selector, selectedValues)
}

function selectedOptions(field) {
  return Array.from(field?.selectedOptions || []).map(option => option.value)
}

function setMultiSelectValues(selector, values = []) {
  const field = document.querySelector(selector)
  if (!field) return

  for (const option of field.options) {
    option.selected = values.includes(option.value)
  }
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
  metadataEditingLogId = null
  selectedLogId = log?.id || selectedLogId

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

        <nav class="wb-tabs" aria-label="Workbench view">
          <button class="wb-tab active" data-view="logs" onclick="switchWorkbenchView('logs')">기록</button>
          <button class="wb-tab" data-view="projects" onclick="switchWorkbenchView('projects')">프로젝트</button>
        </nav>

        <div id="workbenchLogPanel">
          <section class="wb-write">
            <input id="logTitle" placeholder="기록 제목" />
            <textarea id="logContent" placeholder="생각, 아이디어, 회의 메모, 오늘의 장면..."></textarea>

            <div class="wb-field-row">
              <input id="logProject" list="logProjectOptions" placeholder="프로젝트" />
              <datalist id="logProjectOptions"></datalist>
              <datalist id="logTypeOptions"></datalist>
              <datalist id="logTagOptions"></datalist>
            </div>

            <div class="wb-actions">
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
        </div>

        <section id="workbenchProjectPanel" class="wb-projects" hidden>
          <div class="wb-section-head">
            <h3>프로젝트</h3>
            <small>curated</small>
          </div>

          <div id="projectList">
            <article class="wb-empty">
              <time>프로젝트</time>
              <div>
                <h4>프로젝트를 불러오는 중입니다</h4>
                <p>Projects 데이터 소스에서 포트폴리오 항목을 가져오고 있습니다.</p>
              </div>
              <em>load</em>
            </article>
          </div>
        </section>
      </main>
    </div>
  `
}

export function initWorkbench() {
  setupEditorPaste()
  renderWorkbenchView()
  loadBossaLogs()
  loadProjectOptions()
}

window.switchWorkbenchView = function (view) {
  workbenchView = view
  closeLogDetail()
  renderWorkbenchView()

  if (view === 'projects') {
    loadWorkbenchProjects()
  }
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

window.loadWorkbenchProjects = async function () {
  const list = document.querySelector('#projectList')

  if (bossaProjectsLoaded) {
    renderWorkbenchProjects()
    return
  }

  if (list) {
    list.innerHTML = `
      <article class="wb-empty">
        <time>프로젝트</time>
        <div>
          <h4>프로젝트를 불러오는 중입니다</h4>
          <p>Projects 데이터 소스에서 포트폴리오 항목을 가져오고 있습니다.</p>
        </div>
        <em>load</em>
      </article>
    `
  }

  try {
    const response = await fetch('/api/projects')
    const result = await readApiResponse(response)

    if (!result.ok) {
      throw new Error(result.error || '프로젝트를 불러오지 못했습니다')
    }

    bossaProjects = result.projects || []
    bossaProjectsLoaded = true
    renderWorkbenchProjects()
  } catch (error) {
    if (list) {
      list.innerHTML = `
        <article class="wb-empty">
          <time>오류</time>
          <div>
            <h4>프로젝트를 불러오지 못했습니다</h4>
            <p>${escapeHtml(error.message)}</p>
          </div>
          <em>error</em>
        </article>
      `
    }
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
  editingLogId = null
  metadataEditingLogId = null
  deleteConfirmLogId = null
  renderWorkbenchLogs()
  setMessage('')
}

window.closeLogDetail = function () {
  selectedLogId = null
  editingLogId = null
  metadataEditingLogId = null
  deleteConfirmLogId = null
  renderWorkbenchLogs()
}

window.editSelectedLog = function () {
  const log = currentLog()
  if (!log) return

  setEditingState(log)
  setMessage('기록을 편집 중입니다.')
  document.querySelector('#detailTitle')?.focus()
}

window.cancelLogEditing = function () {
  setEditingState(null)
  metadataEditingLogId = null
  deleteConfirmLogId = null
  setMessage('')
}

window.requestDeleteLog = function (id) {
  deleteConfirmLogId = id
  renderLogDetailHost()
}

window.cancelDeleteLog = function () {
  deleteConfirmLogId = null
  renderLogDetailHost()
}

window.confirmDeleteLog = async function (id) {
  if (!id) return

  setMessage('삭제 중...')

  try {
    const response = await fetch('/api/delete-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const result = await readApiResponse(response)

    if (!result.ok) {
      throw new Error(result.error || '삭제 실패')
    }

    bossaLogs = bossaLogs.filter(log => log.id !== id)
    selectedLogId = null
    editingLogId = null
    metadataEditingLogId = null
    deleteConfirmLogId = null
    renderWorkbenchLogs()
    setMessage('삭제되었습니다.')
  } catch (error) {
    setMessage(`삭제 실패: ${error.message}`)
  }
}

function detailMetadataPayload(log) {
  return {
    id: log.id,
    title: log.title,
    content: log.content,
    project: document.querySelector('#detailProject')?.value || '',
    type: document.querySelector('#detailType')?.value.trim() || '',
    tags: [...new Set([
      ...selectedOptions(document.querySelector('#detailTagSelect')),
      ...parseTags(document.querySelector('#detailTags')?.value || ''),
    ])],
    status: document.querySelector('#detailStatus')?.value || '작업중',
    isPublic: Boolean(document.querySelector('#detailPublic')?.checked),
  }
}

async function saveLogPayload(payload, { successMessage = '저장되었습니다.' } = {}) {
  const response = await fetch('/api/create-log', {
    method: payload.id ? 'PATCH' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const result = await readApiResponse(response)

  if (!result.ok) {
    throw new Error(result.error || '저장 실패')
  }

  setMessage(successMessage)
  upsertLog(result.log)
  await loadBossaLogs({ silent: true })
  await loadProjectOptions()

  return result.log
}

window.saveLogMetadata = async function () {
  const log = currentLog()
  if (!log) return

  setMessage('정리 저장 중...')

  try {
    await saveLogPayload(detailMetadataPayload(log), { successMessage: '정리되었습니다.' })
    selectedLogId = null
    metadataEditingLogId = null
    editingLogId = null
    renderWorkbenchLogs()
  } catch (error) {
    setMessage(`저장 실패: ${error.message}`)
  }
}

window.createBossaLog = async function () {
  const isEditing = Boolean(editingLogId)
  const title = isEditing
    ? document.querySelector('#detailTitle')?.value.trim() || ''
    : document.querySelector('#logTitle').value.trim()
  const content = isEditing
    ? document.querySelector('#detailContent')?.value.trim() || ''
    : document.querySelector('#logContent').value.trim()
  const project = document.querySelector('#logProject').value
  const type = isEditing ? document.querySelector('#detailType')?.value.trim() || '' : ''
  const tags = isEditing
    ? [...new Set([
      ...selectedOptions(document.querySelector('#detailTagSelect')),
      ...parseTags(document.querySelector('#detailTags')?.value || ''),
    ])]
    : []
  const status = isEditing ? document.querySelector('#detailStatus')?.value || '작업중' : '작업중'
  const isPublic = isEditing ? Boolean(document.querySelector('#detailPublic')?.checked) : false
  const metadataProject = isEditing ? document.querySelector('#detailProject')?.value || '' : project
  const message = document.querySelector('#saveMessage')

  if (!title && !content) {
    message.textContent = '기록할 내용을 먼저 적어주세요.'
    return
  }

  message.textContent = '저장 중...'

  try {
    const log = await saveLogPayload(
      { id: editingLogId, title, content, project: metadataProject, type, tags, status, isPublic },
      { successMessage: isEditing ? '저장되었습니다.' : '저장되었습니다. 이어서 정리해보세요.' },
    )
    editingLogId = null
    selectedLogId = log?.id || null

    if (!isEditing) {
      document.querySelector('#logTitle').value = ''
      document.querySelector('#logContent').value = ''
      document.querySelector('#logProject').value = ''
      metadataEditingLogId = log?.id || null
    } else {
      metadataEditingLogId = null
    }

    renderWorkbenchLogs()
  } catch (error) {
    message.textContent = `저장 실패: ${error.message}`
  }
}
