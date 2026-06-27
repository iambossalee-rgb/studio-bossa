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
let selectedProjectCategory = null
let selectedProjectId = null
let selectedProjectTab = 'intro'
let projectBodiesByProject = {}
let projectBodyLoadingProjectId = null
let relatedLogsByProject = {}
let relatedLogsLoadingProjectId = null
let organizingLogId = null
let completionLogId = null
let projectCreateLogId = null
let selectedArchiveGroup = null
let captureTypePreset = ''
let captureImageFiles = []
let detailImageFiles = []
let detailImageUrls = []
const coreLogTypes = ['생각', '회의', '작업', '자료', '결과물', '글']
const workspaceRecordTypes = ['생각', '회의', '작업']
const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

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

function dateKey(date) {
  if (!date) return ''

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
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

function logImages(log) {
  return Array.isArray(log.images) ? log.images : log.image ? [log.image] : []
}

function imageId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function renderImagePreviewItems(items = [], removeHandler = '') {
  if (!items.length) return ''

  return `
    <div class="wb-image-preview-grid">
      ${items.map(item => `
        <figure class="wb-image-preview">
          <img src="${escapeAttr(item.url)}" alt="${escapeAttr(item.name || 'uploaded image')}" />
          ${removeHandler ? `<button type="button" onclick="${removeHandler}('${escapeAttr(item.id)}')">삭제</button>` : ''}
        </figure>
      `).join('')}
    </div>
  `
}

function renderLogImages(log, { editable = false } = {}) {
  const items = logImages(log).map(url => ({ id: url, url, name: 'log image' }))
  if (!items.length) return ''

  return `
    <div class="wb-log-images">
      ${items.map(item => `
        <figure>
          <img src="${escapeAttr(item.url)}" alt="${escapeAttr(log.title)}" onclick="openLogImageLightbox('${escapeAttr(item.url)}')" />
          ${editable ? `<button type="button" onclick="removeExistingDetailImage('${escapeAttr(item.url)}')">삭제</button>` : ''}
        </figure>
      `).join('')}
    </div>
  `
}

function projectMeta(project) {
  return [
    project.brand || '',
    project.category || '',
    project.status || '',
    project.year || '',
  ].filter(Boolean)
}

function projectDetailMeta(project) {
  const tags = Array.isArray(project.tags) ? project.tags : []

  return [
    project.category || '',
    project.status || '',
    ...tags.map(tag => `#${tag}`),
  ].filter(Boolean)
}

function projectCategory(project) {
  return project.category || project.type || project.tag || '기타'
}

function projectCategories(projects = bossaProjects) {
  return [...new Set(projects.map(projectCategory))]
    .sort((a, b) => {
      if (a === '기타') return 1
      if (b === '기타') return -1
      return a.localeCompare(b, 'ko')
    })
}

function archiveGroupForLog(log) {
  return log.type?.trim() || '기타'
}

function archiveLogsForGroup(group) {
  return bossaLogs.filter(log => archiveGroupForLog(log) === group)
}

function archiveTypeGroups(logs = bossaLogs) {
  const groups = new Map()

  for (const log of logs) {
    const group = archiveGroupForLog(log)
    groups.set(group, (groups.get(group) || 0) + 1)
  }

  return [...groups.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count
      return a.name.localeCompare(b.name, 'ko')
    })
}

function renderArchiveMenu() {
  const groups = archiveTypeGroups()

  if (!groups.length) {
    return `
      <article class="wb-empty">
        <time>모아보기</time>
        <div>
          <h4>아직 기록이 없습니다.</h4>
        </div>
        <em>empty</em>
      </article>
    `
  }

  return `
    <nav class="wb-archive-menu" aria-label="Log type archive">
      ${groups.map(group => `
        <button onclick="openArchiveGroup('${escapeAttr(group.name)}')">
          <span>${escapeHtml(group.name)}</span>
          <em>${group.count}</em>
        </button>
      `).join('')}
    </nav>
  `
}

function renderArchiveHeader(group) {
  return `
    <div class="wb-archive-category-head">
      <button onclick="closeArchiveGroup()">← 모아보기</button>
      <h4>${escapeHtml(group)}</h4>
    </div>
  `
}

function renderArchiveLogs(logs = []) {
  if (!logs.length) {
    return `
      <article class="wb-empty">
        <time>${escapeHtml(selectedArchiveGroup || '모아보기')}</time>
        <div>
          <h4>아직 기록이 없습니다.</h4>
        </div>
        <em>empty</em>
      </article>
    `
  }

  return renderLogs(logs)
}

function renderArchiveWorkbench() {
  if (!selectedArchiveGroup) {
    return renderArchiveMenu()
  }

  return `
    ${renderArchiveHeader(selectedArchiveGroup)}
    <div class="wb-archive-log-list">
      ${renderArchiveLogs(archiveLogsForGroup(selectedArchiveGroup))}
    </div>
  `
}

function todayLogsCount() {
  const today = dateKey(new Date())
  return bossaLogs.filter(log => dateKey(log.date) === today).length
}

function uniqueLogTypeCount() {
  return new Set(bossaLogs.map(log => log.type?.trim()).filter(Boolean)).size
}

function renderSidebarProjects() {
  if (!bossaProjects.length) {
    return '<p class="wb-sidebar-empty">아직 프로젝트가 없습니다.</p>'
  }

  return `
    <ul class="wb-sidebar-projects">
      ${bossaProjects.slice(0, 3).map(project => `<li>${escapeHtml(project.title)}</li>`).join('')}
    </ul>
  `
}

function renderSidebarWorkspace() {
  const sidebar = document.querySelector('#workbenchSidebar')
  if (!sidebar) return

  const todayCount = todayLogsCount()
  const recentCount = bossaLogs.length || todayCount

  sidebar.innerHTML = `
    <div>
      <div class="wb-sidebar-brand">
        <h1>BOSSA</h1>
        <p>WORKBENCH</p>
      </div>

      <section class="wb-sidebar-status" aria-label="Workspace status">
        <h2>지피터 실장</h2>
        <strong>출근중</strong>
        <p>오늘도 기록부터 시작해볼까요?</p>
      </section>

      <section class="wb-sidebar-stats" aria-label="Today stats">
        <dl>
          <div>
            <dt>오늘 기록</dt>
            <dd>${todayCount}</dd>
          </div>
          <div>
            <dt>프로젝트</dt>
            <dd>${bossaProjects.length}</dd>
          </div>
          <div>
            <dt>유형</dt>
            <dd>${uniqueLogTypeCount()}</dd>
          </div>
          <div>
            <dt>최근 작성</dt>
            <dd>${recentCount}</dd>
          </div>
        </dl>
      </section>

      <section class="wb-sidebar-recent" aria-label="Recent projects">
        <h3>최근 프로젝트</h3>
        ${renderSidebarProjects()}
      </section>
    </div>

    <button class="wb-sidebar-public" onclick="goHome()">공개 사이트 →</button>
  `
}

function renderProjectCategoryMenu(projects = bossaProjects) {
  const categories = projectCategories(projects)

  if (!categories.length) {
    return `
      <article class="wb-empty">
        <time>프로젝트</time>
        <div>
          <h4>프로젝트를 불러오지 못했습니다</h4>
          <p>Projects 데이터 소스에 항목이 있으면 카테고리로 정리됩니다.</p>
        </div>
        <em>empty</em>
      </article>
    `
  }

  return `
    <nav class="wb-project-category-menu" aria-label="Project categories">
      ${categories.map(category => {
        const count = projects.filter(project => projectCategory(project) === category).length

        return `
          <button onclick="openProjectCategory('${escapeAttr(category)}')">
            <span>${escapeHtml(category)}</span>
            <em>${count}</em>
          </button>
        `
      }).join('')}
    </nav>
  `
}

function renderProjectCategoryHeader(category) {
  return `
    <div class="wb-project-category-head">
      <button onclick="closeProjectCategory()">← 카테고리</button>
      <h4>${escapeHtml(category)}</h4>
    </div>
  `
}

function projectImageCandidates(project = {}) {
  const candidates = []
  const push = value => {
    if (value && !candidates.includes(value)) candidates.push(value)
  }

  if (Array.isArray(project.imageCandidates)) {
    project.imageCandidates.forEach(push)
  }

  push(project.image)
  push(project.thumbnail)
  push(project.cover)

  return candidates
}

function renderProjectImagePlaceholder(project, variant = 'card') {
  const initials = (project.title || 'BOSSA').trim().slice(0, 2).toUpperCase()

  return `
    <div class="wb-project-image-placeholder wb-project-image-placeholder-${escapeAttr(variant)}">
      <span>${escapeHtml(initials)}</span>
    </div>
  `
}

function renderProjectImage(project, className = '', variant = 'card') {
  const candidates = projectImageCandidates(project)
  if (!candidates.length) return renderProjectImagePlaceholder(project, variant)

  return `
    <img
      class="${escapeAttr(className)}"
      src="${escapeAttr(candidates[0])}"
      alt="${escapeAttr(project.title)}"
      data-image-candidates="${escapeAttr(encodeURIComponent(JSON.stringify(candidates)))}"
      data-image-index="0"
      data-image-title="${escapeAttr(project.title || 'BOSSA')}"
      data-image-variant="${escapeAttr(variant)}"
      onerror="handleProjectImageError(this)"
    />
  `
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
      <article class="wb-project-card" onclick="openProjectDetail('${escapeAttr(project.id)}')">
        ${renderProjectImage(project, 'wb-project-card-image', 'card')}
        <div>
          ${meta.length ? `<div class="wb-project-meta">${meta.map(item => `<span>${escapeHtml(item)}</span>`).join('')}</div>` : ''}
          <h4>${escapeHtml(project.title)}</h4>
          <p>${escapeHtml(project.summary || project.category || '요약이 없습니다.')}</p>
        </div>
      </article>
    `
  }).join('')
}

function renderProjectWorkbench(projects = bossaProjects) {
  if (!selectedProjectCategory) {
    return renderProjectCategoryMenu(projects)
  }

  const filteredProjects = projects.filter(project => projectCategory(project) === selectedProjectCategory)
  return `
    ${renderProjectCategoryHeader(selectedProjectCategory)}
    <div class="wb-project-card-list">
      ${renderProjectCards(filteredProjects)}
    </div>
  `
}

function currentProject() {
  return bossaProjects.find(project => project.id === selectedProjectId) || null
}

function mergedOptionList(items = [], requiredNames = []) {
  const merged = []

  for (const name of requiredNames) {
    if (name && !merged.some(item => item.name === name)) {
      merged.push({ name })
    }
  }

  for (const item of items) {
    if (item?.name && !merged.some(option => option.name === item.name)) {
      merged.push(item)
    }
  }

  return merged
}

function relatedProjectLogs(project) {
  return relatedLogsByProject[project.id] || []
}

function projectLogsForSection(project, section) {
  const logs = relatedProjectLogs(project)

  if (section === 'timeline') {
    return [...logs].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0))
  }

  if (section === 'assets') {
    return logs.filter(log => log.type === '자료')
  }

  if (section === 'results') {
    return logs.filter(log => log.type === '결과물')
  }

  return logs.filter(log => !['자료', '결과물'].includes(log.type) || workspaceRecordTypes.includes(log.type))
}

function projectSectionCounts(project) {
  return {
    total: projectLogsForSection(project, 'timeline').length,
    logs: projectLogsForSection(project, 'logs').length,
    assets: projectLogsForSection(project, 'assets').length,
    results: projectLogsForSection(project, 'results').length,
  }
}

function renderRelatedLogCard(log, { variant = 'timeline' } = {}) {
  const tags = Array.isArray(log.tags) ? log.tags : []
  const meta = [
    log.type || '',
    ...tags.map(tag => `#${tag}`),
    log.status || '',
  ].filter(Boolean)

  if (variant === 'resource') {
    return `
      <article class="wb-related-log wb-related-log-resource" onclick="openRelatedLog('${escapeAttr(log.id)}')">
        ${logImages(log)[0] ? `<img class="wb-related-thumb" src="${escapeAttr(logImages(log)[0])}" alt="${escapeAttr(log.title)}" />` : ''}
        <div>
          <h5>${escapeHtml(log.title)}</h5>
          <time>${escapeHtml(formatDate(log.date))}</time>
          <p>${escapeHtml(logPreview(log))}</p>
        </div>
      </article>
    `
  }

  if (variant === 'result') {
    return `
      <article class="wb-related-log wb-related-log-result" onclick="openRelatedLog('${escapeAttr(log.id)}')">
        ${logImages(log)[0] ? `<img src="${escapeAttr(logImages(log)[0])}" alt="${escapeAttr(log.title)}" />` : ''}
        <div>
          <h5>${escapeHtml(log.title)}</h5>
          <p>${escapeHtml(logPreview(log))}</p>
        </div>
      </article>
    `
  }

  if (variant === 'project-history') {
    return `
      <article class="wb-related-log wb-project-history-item" onclick="openRelatedLog('${escapeAttr(log.id)}')">
        <time>${escapeHtml(formatDate(log.date))}</time>
        <div>
          ${logImages(log)[0] ? `<img class="wb-project-history-thumb" src="${escapeAttr(logImages(log)[0])}" alt="${escapeAttr(log.title)}" />` : ''}
          <h5>${escapeHtml(log.title)}</h5>
          <p>${escapeHtml(logPreview(log))}</p>
          ${meta.length ? `<div class="wb-log-meta">${meta.map(item => `<span>${escapeHtml(item)}</span>`).join('')}</div>` : ''}
        </div>
      </article>
    `
  }

  return `
    <article class="wb-related-log wb-related-log-${escapeAttr(variant)}" onclick="openRelatedLog('${escapeAttr(log.id)}')">
      <time>${escapeHtml(formatDate(log.date))}</time>
      <div>
        <h5>${escapeHtml(log.title)}</h5>
        <p>${escapeHtml(logPreview(log))}</p>
        ${meta.length ? `<div class="wb-log-meta">${meta.map(item => `<span>${escapeHtml(item)}</span>`).join('')}</div>` : ''}
      </div>
    </article>
  `
}

function renderRelatedLogs(project, {
  section = 'logs',
  emptyTitle = '아직 기록이 없습니다.',
  emptyBody = '',
  variant = 'timeline',
} = {}) {
  if (relatedLogsLoadingProjectId === project.id) {
    return `
      <article class="wb-empty">
        <time>기록</time>
        <div>
          <h4>관련 기록을 불러오는 중입니다</h4>
          <p>BOSSA Log에서 프로젝트명이 같은 기록을 찾고 있습니다.</p>
        </div>
        <em>load</em>
      </article>
    `
  }

  const relatedLogs = projectLogsForSection(project, section)

  if (!relatedLogs.length) {
    return `
      <article class="wb-empty wb-related-empty">
        <div>
          <h4>${escapeHtml(emptyTitle)}</h4>
          ${emptyBody ? `<p>${escapeHtml(emptyBody)}</p>` : ''}
        </div>
      </article>
    `
  }

  return relatedLogs.map(log => renderRelatedLogCard(log, { variant })).join('')
}

function renderProjectSummaryStrip(project) {
  const counts = projectSectionCounts(project)

  return `
    <div class="wb-project-summary-strip">
      <span>전체 ${counts.total}</span>
      <span>기록 ${counts.logs}</span>
      <span>자료 ${counts.assets}</span>
      <span>결과물 ${counts.results}</span>
    </div>
  `
}

function renderProjectWorkspaceTabs() {
  const tabs = [
    ['intro', '소개'],
    ['timeline', '타임라인'],
    ['logs', '기록'],
    ['assets', '자료'],
    ['results', '결과물'],
  ]

  return `
    <nav class="wb-project-workspace-tabs" aria-label="Project workspace sections">
      ${tabs.map(([tab, label]) => `
        <button
          class="${selectedProjectTab === tab ? 'active' : ''}"
          onclick="switchProjectTab('${tab}')"
        >${label}</button>
      `).join('')}
    </nav>
  `
}

function renderProjectIntroPanel(project, meta) {
  return `
    <section class="wb-project-workspace-panel" data-project-tab="intro">
      ${renderProjectImage(project, 'wb-project-detail-image', 'detail')}
      <h3>${escapeHtml(project.title)}</h3>
      ${meta.length ? `<div class="wb-project-meta">${meta.map(item => `<span>${escapeHtml(item)}</span>`).join('')}</div>` : ''}
      ${renderProjectDocument(project)}
      ${project.url ? `<a class="wb-notion-link wb-project-intro-link" href="${escapeAttr(project.url)}" target="_blank" rel="noopener noreferrer">노션에서 열기</a>` : ''}
    </section>
  `
}

function renderProjectTimelinePanel(project) {
  return `
    <section class="wb-project-workspace-panel wb-project-history-panel" data-project-tab="timeline">
      <div class="wb-section-head">
        <h3>프로젝트 히스토리</h3>
      </div>
      <div class="wb-related-list wb-related-timeline wb-project-history-list">
        ${renderRelatedLogs(project, {
          section: 'timeline',
          emptyTitle: '아직 프로젝트 히스토리가 없습니다.',
          emptyBody: '이 프로젝트로 기록을 남기면 이곳에 시간순으로 쌓입니다.',
          variant: 'project-history',
        })}
      </div>
    </section>
  `
}

function renderProjectLogsPanel(project) {
  return `
    <section class="wb-project-workspace-panel wb-project-logs-panel" data-project-tab="logs">
      <div class="wb-section-head">
        <h3>관련 기록</h3>
        <button onclick="quickAddProjectLog('${escapeAttr(project.id)}', '생각')">기록 추가</button>
      </div>
      <div class="wb-related-list wb-related-timeline">
        ${renderRelatedLogs(project, {
          section: 'logs',
          emptyTitle: '아직 기록이 없습니다.',
          variant: 'timeline',
        })}
      </div>
    </section>
  `
}

function renderProjectAssetsPanel(project) {
  return `
    <section class="wb-project-workspace-panel" data-project-tab="assets">
      <div class="wb-section-head">
        <h3>자료</h3>
        <button onclick="quickAddProjectLog('${escapeAttr(project.id)}', '자료')">자료 추가</button>
      </div>
      <div class="wb-related-list wb-resource-list">
        ${renderRelatedLogs(project, {
          section: 'assets',
          emptyTitle: '아직 등록된 자료가 없습니다.',
          emptyBody: '자료 유형으로 기록하면 이곳에 모입니다.',
          variant: 'resource',
        })}
      </div>
    </section>
  `
}

function renderProjectResultsPanel(project) {
  return `
    <section class="wb-project-workspace-panel" data-project-tab="results">
      <div class="wb-section-head">
        <h3>결과물</h3>
        <button onclick="quickAddProjectLog('${escapeAttr(project.id)}', '결과물')">결과물 추가</button>
      </div>
      <div class="wb-related-list wb-result-list">
        ${renderRelatedLogs(project, {
          section: 'results',
          emptyTitle: '아직 등록된 결과물이 없습니다.',
          emptyBody: '결과물 유형으로 기록하면 이곳에 모입니다.',
          variant: 'result',
        })}
      </div>
    </section>
  `
}

function renderProjectWorkspacePanel(project, meta) {
  if (selectedProjectTab === 'timeline') return renderProjectTimelinePanel(project)

  if (selectedProjectTab === 'logs') return renderProjectLogsPanel(project)

  if (selectedProjectTab === 'assets') return renderProjectAssetsPanel(project)

  if (selectedProjectTab === 'results') return renderProjectResultsPanel(project)

  return renderProjectIntroPanel(project, meta)
}

function renderProjectBlock(block) {
  if (block.type === 'heading_1') return `<h1>${escapeHtml(block.text)}</h1>`
  if (block.type === 'heading_2') return `<h2>${escapeHtml(block.text)}</h2>`
  if (block.type === 'heading_3') return `<h3>${escapeHtml(block.text)}</h3>`
  if (block.type === 'paragraph') return block.text.trim() ? `<p>${escapeHtml(block.text)}</p>` : ''
  if (block.type === 'bulleted_list_item') return `<p class="wb-project-doc-list">• ${escapeHtml(block.text)}</p>`
  if (block.type === 'numbered_list_item') return `<p class="wb-project-doc-list wb-project-doc-numbered">${escapeHtml(block.text)}</p>`
  if (block.type === 'quote') return `<blockquote>${escapeHtml(block.text)}</blockquote>`

  if (block.type === 'image' && block.url) {
    return `
      <figure>
        <img src="${escapeAttr(block.url)}" alt="${escapeAttr(block.caption || '')}" />
        ${block.caption ? `<figcaption>${escapeHtml(block.caption)}</figcaption>` : ''}
      </figure>
    `
  }

  return ''
}

function renderProjectDocument(project) {
  if (projectBodyLoadingProjectId === project.id) {
    return `
      <section class="wb-project-document">
        <p>프로젝트 문서를 불러오는 중입니다.</p>
      </section>
    `
  }

  const blocks = projectBodiesByProject[project.id] || []

  if (!blocks.length) {
    return `
      <section class="wb-project-document">
        <p>Notion 프로젝트 페이지에 본문을 추가하면 이곳에 표시됩니다.</p>
      </section>
    `
  }

  return `
    <section class="wb-project-document">
      ${blocks.map(renderProjectBlock).join('')}
    </section>
  `
}

function renderProjectDetailCard(project) {
  const meta = projectDetailMeta(project)

  return `
    <div class="wb-project-lightbox">
      <div class="wb-detail-overlay"></div>
      <div class="wb-detail-modal wb-project-detail-modal" onclick="event.stopPropagation()">
        ${renderProjectSummaryStrip(project)}
        ${renderProjectWorkspaceTabs()}
        ${renderProjectWorkspacePanel(project, meta)}

        <div class="wb-detail-actions">
          <button onclick="closeProjectDetail()">닫기</button>
        </div>
      </div>
    </div>
  `
}

function renderProjectDetailHost() {
  const detailHost = document.querySelector('#projectDetailHost')
  const project = currentProject()
  if (detailHost) detailHost.innerHTML = project ? renderProjectDetailCard(project) : ''
}

function renderCompletionState(log) {
  if (completionLogId !== log.id) return ''

  return `
    <div class="wb-completion">
      <p>저장되었습니다.</p>
      <div>
        <button onclick="openCreateProjectModal('${escapeAttr(log.id)}')">프로젝트로 만들기</button>
        <button class="wb-secondary-action" onclick="continueWriting()">계속 기록하기</button>
      </div>
    </div>
  `
}

function renderCreateProjectModal() {
  const host = document.querySelector('#createProjectHost')
  if (!host) return

  const log = bossaLogs.find(item => item.id === projectCreateLogId)
  if (!log) {
    host.innerHTML = ''
    return
  }

  host.innerHTML = `
    <div class="wb-delete-confirm-layer wb-project-create-layer">
      <div class="wb-delete-confirm-overlay"></div>
      <div class="wb-delete-confirm wb-project-create" onclick="event.stopPropagation()">
        <h3>새 프로젝트로 만들까요?</h3>
        <label>
          <span>프로젝트명</span>
          <input id="createProjectTitle" value="${escapeAttr(log.title)}" placeholder="프로젝트명" />
        </label>
        <label>
          <span>요약</span>
          <textarea id="createProjectSummary" placeholder="프로젝트 소개는 나중에 정리해도 됩니다."></textarea>
        </label>
        <div>
          <button onclick="closeCreateProjectModal()">취소</button>
          <button onclick="createProjectFromLog()">만들기</button>
        </div>
      </div>
    </div>
  `
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
  const completionState = renderCompletionState(log)
  const detailImages = renderLogImages({ ...log, images: detailImageUrls }, { editable: isMetadataEditing })
  const stagedDetailImages = renderImagePreviewItems(detailImageFiles, 'removeDetailImage')

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
        ${detailImages}
        ${isMetadataEditing ? `
          <div class="wb-image-upload wb-detail-image-upload">
            <label for="detailImages">이미지 추가</label>
            <input id="detailImages" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onchange="handleDetailImages(event)" />
            <p>이미지는 5MB 이하의 JPG, PNG, WEBP, GIF만 가능합니다.</p>
            ${stagedDetailImages}
          </div>
        ` : ''}
        ${completionState}
        <div class="wb-detail-fields" ${completionState ? 'hidden' : ''}>
          <input id="detailProject" list="logProjectOptions" value="${escapeAttr(log.project || '')}" placeholder="프로젝트" ${editLock} />
          <input id="detailType" list="logTypeOptions" value="${escapeAttr(log.type || '')}" placeholder="유형" ${editLock} />
          <input id="detailTags" class="wb-tag-input" value="${escapeAttr((log.tags || []).join(', '))}" placeholder="태그, 쉼표로 구분" ${editLock} />
          <select id="detailStatus" ${editLock}>
            ${renderStatusOptions(log.status || '작업중')}
          </select>
          <label class="wb-check">
            <input id="detailPublic" type="checkbox" ${log.isPublic ? 'checked' : ''} ${editLock} />
            공개
          </label>
        </div>
        <div class="wb-detail-actions" ${completionState ? 'hidden' : ''}>
          <button onclick="closeLogDetail()">닫기</button>
          <button class="wb-danger-action" onclick="requestDeleteLog('${escapeAttr(log.id)}')">삭제</button>
          <button class="wb-secondary-action" onclick="openCreateProjectModal('${escapeAttr(log.id)}')">프로젝트로 만들기</button>
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
          ${logImages(log)[0] ? `<img class="wb-log-thumb" src="${escapeAttr(logImages(log)[0])}" alt="${escapeAttr(log.title)}" />` : ''}
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

function validateImageFile(file) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return 'JPG, PNG, WEBP, GIF 이미지만 업로드할 수 있습니다.'
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return '이미지는 5MB 이하만 업로드할 수 있습니다.'
  }

  return ''
}

function addImageFiles(target, files = []) {
  const added = []

  for (const file of files) {
    const error = validateImageFile(file)
    if (error) {
      setMessage(error)
      continue
    }

    added.push({
      id: imageId(),
      file,
      name: file.name,
      url: URL.createObjectURL(file),
    })
  }

  return [...target, ...added]
}

function revokeImageItems(items = []) {
  for (const item of items) {
    if (item.url?.startsWith('blob:')) URL.revokeObjectURL(item.url)
  }
}

async function uploadImageFile(item) {
  const formData = new FormData()
  formData.append('file', item.file)

  const response = await fetch('/api/upload-image', {
    method: 'POST',
    body: formData,
  })
  const result = await readApiResponse(response)

  if (!result.ok || !result.url) {
    throw new Error(result.error || '이미지 업로드 실패')
  }

  return result.url
}

async function uploadImageItems(items = []) {
  const urls = []

  for (const item of items) {
    urls.push(await uploadImageFile(item))
  }

  return urls
}

function resetCaptureImages() {
  revokeImageItems(captureImageFiles)
  captureImageFiles = []
  renderCaptureImagePreviews()
}

function resetDetailImages() {
  revokeImageItems(detailImageFiles)
  detailImageFiles = []
  detailImageUrls = []
}

function renderCaptureImagePreviews() {
  const host = document.querySelector('#captureImagePreviews')
  if (host) host.innerHTML = renderImagePreviewItems(captureImageFiles, 'removeCaptureImage')
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
  renderWorkbenchArchive()
  renderSidebarWorkspace()
  renderLogDetailHost()
}

function renderWorkbenchView() {
  const logPanel = document.querySelector('#workbenchLogPanel')
  const projectPanel = document.querySelector('#workbenchProjectPanel')
  const archivePanel = document.querySelector('#workbenchArchivePanel')
  const tabs = document.querySelectorAll('.wb-tab')

  for (const tab of tabs) {
    tab.classList.toggle('active', tab.dataset.view === workbenchView)
  }

  if (logPanel) logPanel.hidden = workbenchView !== 'logs'
  if (projectPanel) projectPanel.hidden = workbenchView !== 'projects'
  if (archivePanel) archivePanel.hidden = workbenchView !== 'archive'
}

function renderWorkbenchProjects(projects = bossaProjects) {
  const list = document.querySelector('#projectList')
  if (list) list.innerHTML = renderProjectWorkbench(projects)
  renderSidebarWorkspace()
  renderProjectDetailHost()
}

function renderWorkbenchArchive() {
  const list = document.querySelector('#archiveList')
  if (list) list.innerHTML = renderArchiveWorkbench()
}

function renderProjectOptions() {
  renderDatalist('#logProjectOptions', bossaProjectOptions)
  renderDatalist('#logTypeOptions', mergedOptionList(bossaTypeOptions, coreLogTypes))
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
  detailImageUrls = logImages(log)
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
      <aside id="workbenchSidebar" class="wb-sidebar"></aside>

      <main class="wb-main">
        <header class="wb-top">
          <span>${todayLabel()}</span>
          <button onclick="goHome()">공개 사이트</button>
        </header>

        <section class="wb-hero">
          <h2>✍🏻</h2>
          <p>일단 대충 써.</p>
        </section>

        <nav class="wb-tabs" aria-label="Workbench view">
          <button class="wb-tab active" data-view="logs" onclick="switchWorkbenchView('logs')">기록</button>
          <button class="wb-tab" data-view="projects" onclick="switchWorkbenchView('projects')">프로젝트</button>
          <button class="wb-tab" data-view="archive" onclick="switchWorkbenchView('archive')">모아보기</button>
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

            <div class="wb-image-upload">
              <label for="logImages">이미지</label>
              <input id="logImages" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onchange="handleCaptureImages(event)" />
              <p>이미지는 5MB 이하의 JPG, PNG, WEBP, GIF만 가능합니다.</p>
              <div id="captureImagePreviews"></div>
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
        <section id="workbenchArchivePanel" class="wb-archive" hidden>
          <div class="wb-section-head">
            <h3>모아보기</h3>
            <small>archive</small>
          </div>

          <div id="archiveList">
            <article class="wb-empty">
              <time>모아보기</time>
              <div>
                <h4>기록을 분류하는 중입니다</h4>
                <p>유형별로 최근 기록을 모으고 있습니다.</p>
              </div>
              <em>load</em>
            </article>
          </div>
        </section>
        <div id="logDetailHost">${renderSelectedLogDetail()}</div>
        <div id="projectDetailHost"></div>
        <div id="createProjectHost"></div>
      </main>
    </div>
  `
}

export function initWorkbench() {
  setupEditorPaste()
  renderSidebarWorkspace()
  renderWorkbenchView()
  loadBossaLogs()
  loadProjectOptions()
  loadWorkbenchProjects()
}

window.switchWorkbenchView = function (view) {
  workbenchView = view
  if (view !== 'logs') captureTypePreset = ''
  closeLogDetail()
  closeProjectDetail()
  closeCreateProjectModal()
  if (view === 'projects') selectedProjectCategory = null
  if (view === 'archive') selectedArchiveGroup = null
  renderWorkbenchView()

  if (view === 'projects') {
    loadWorkbenchProjects({ force: true })
  }

  if (view === 'archive') {
    renderWorkbenchArchive()
  }
}

window.handleProjectImageError = function (img) {
  let candidates = []

  try {
    candidates = JSON.parse(decodeURIComponent(img.dataset.imageCandidates || '[]'))
  } catch {
    candidates = []
  }

  const currentIndex = Number(img.dataset.imageIndex || 0)
  const nextUrl = candidates[currentIndex + 1]

  if (nextUrl) {
    img.dataset.imageIndex = String(currentIndex + 1)
    img.src = nextUrl
    return
  }

  const variant = img.dataset.imageVariant || 'card'
  const title = img.dataset.imageTitle || 'BOSSA'
  const placeholder = document.createElement('div')
  placeholder.className = `wb-project-image-placeholder wb-project-image-placeholder-${variant}`

  const label = document.createElement('span')
  label.textContent = title.trim().slice(0, 2).toUpperCase() || 'B'
  placeholder.appendChild(label)
  img.replaceWith(placeholder)
}

window.openProjectCategory = function (category) {
  selectedProjectCategory = category || null
  closeProjectDetail()
  renderWorkbenchProjects()
}

window.closeProjectCategory = function () {
  selectedProjectCategory = null
  closeProjectDetail()
  renderWorkbenchProjects()
}

window.openArchiveGroup = function (group) {
  selectedArchiveGroup = archiveTypeGroups().some(item => item.name === group) ? group : null
  closeLogDetail()
  renderWorkbenchArchive()
}

window.closeArchiveGroup = function () {
  selectedArchiveGroup = null
  closeLogDetail()
  renderWorkbenchArchive()
}

window.handleCaptureImages = function (event) {
  captureImageFiles = addImageFiles(captureImageFiles, Array.from(event.target.files || []))
  event.target.value = ''
  renderCaptureImagePreviews()
}

window.removeCaptureImage = function (id) {
  const item = captureImageFiles.find(image => image.id === id)
  revokeImageItems(item ? [item] : [])
  captureImageFiles = captureImageFiles.filter(image => image.id !== id)
  renderCaptureImagePreviews()
}

window.handleDetailImages = function (event) {
  detailImageFiles = addImageFiles(detailImageFiles, Array.from(event.target.files || []))
  event.target.value = ''
  renderLogDetailHost()
}

window.removeDetailImage = function (id) {
  const item = detailImageFiles.find(image => image.id === id)
  revokeImageItems(item ? [item] : [])
  detailImageFiles = detailImageFiles.filter(image => image.id !== id)
  renderLogDetailHost()
}

window.removeExistingDetailImage = function (url) {
  detailImageUrls = detailImageUrls.filter(imageUrl => imageUrl !== url)
  renderLogDetailHost()
}

window.openLogImageLightbox = function (url) {
  const host = document.querySelector('#createProjectHost')
  if (!host) return

  host.innerHTML = `
    <div class="wb-image-lightbox">
      <div class="wb-delete-confirm-overlay" onclick="closeLogImageLightbox()"></div>
      <figure onclick="event.stopPropagation()">
        <img src="${escapeAttr(url)}" alt="" />
        <button onclick="closeLogImageLightbox()">닫기</button>
      </figure>
    </div>
  `
}

window.closeLogImageLightbox = function () {
  const host = document.querySelector('#createProjectHost')
  if (host) host.innerHTML = ''
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
    bossaTypeOptions = mergedOptionList(result.types || [], coreLogTypes)
    bossaTagOptions = result.tags || []
    renderProjectOptions()
  } catch (error) {
    setMessage(`프로젝트 옵션 로드 실패: ${error.message}`)
  }
}

window.loadWorkbenchProjects = async function ({ force = false } = {}) {
  const list = document.querySelector('#projectList')

  if (bossaProjectsLoaded && !force) {
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
    const response = await fetch('/api/projects?includePrivate=1', { cache: 'no-store' })
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

window.openProjectDetail = function (id) {
  const project = bossaProjects.find(item => item.id === id)
  if (!project) return

  closeLogDetail()
  closeCreateProjectModal()
  selectedProjectId = id
  selectedProjectTab = 'intro'
  renderProjectDetailHost()
  loadProjectDocument(project)
  loadRelatedLogs(project)
}

window.closeProjectDetail = function () {
  selectedProjectId = null
  selectedProjectTab = 'intro'
  projectBodyLoadingProjectId = null
  relatedLogsLoadingProjectId = null
  renderProjectDetailHost()
}

window.switchProjectTab = function (tab) {
  selectedProjectTab = ['intro', 'timeline', 'logs', 'assets', 'results'].includes(tab) ? tab : 'intro'
  renderProjectDetailHost()
}

window.quickAddProjectLog = function (projectId, type = '생각') {
  const project = bossaProjects.find(item => item.id === projectId)
  if (!project) return

  captureTypePreset = type
  workbenchView = 'logs'
  closeProjectDetail()
  closeLogDetail()
  closeCreateProjectModal()
  renderWorkbenchView()

  const projectField = document.querySelector('#logProject')
  if (projectField) projectField.value = project.title

  const titleField = document.querySelector('#logTitle')
  const contentField = document.querySelector('#logContent')
  if (titleField && !titleField.value) titleField.focus()
  if (!titleField && contentField) contentField.focus()

  setMessage(`${project.title}에 ${type} 기록을 추가합니다.`)
}

window.openCreateProjectModal = function (id) {
  const log = bossaLogs.find(item => item.id === id)
  if (!log) return

  projectCreateLogId = id
  renderCreateProjectModal()
  document.querySelector('#createProjectTitle')?.focus()
}

window.closeCreateProjectModal = function () {
  projectCreateLogId = null
  renderCreateProjectModal()
}

window.loadProjectDocument = async function (project) {
  if (!project?.id) return

  if (projectBodiesByProject[project.id]) {
    renderProjectDetailHost()
    return
  }

  projectBodyLoadingProjectId = project.id
  renderProjectDetailHost()

  try {
    const response = await fetch(`/api/project-detail?id=${encodeURIComponent(project.id)}`)
    const result = await readApiResponse(response)

    if (!result.ok) {
      throw new Error(result.error || '프로젝트 문서를 불러오지 못했습니다')
    }

    projectBodiesByProject = {
      ...projectBodiesByProject,
      [project.id]: result.blocks || [],
    }
  } catch (error) {
    projectBodiesByProject = {
      ...projectBodiesByProject,
      [project.id]: [],
    }
    setMessage(`프로젝트 문서 로드 실패: ${error.message}`)
  } finally {
    projectBodyLoadingProjectId = null
    renderProjectDetailHost()
  }
}

window.loadRelatedLogs = async function (project) {
  if (!project?.id || !project.title) return

  relatedLogsLoadingProjectId = project.id
  renderProjectDetailHost()

  try {
    const response = await fetch(`/api/project-logs?project=${encodeURIComponent(project.title)}`)
    const result = await readApiResponse(response)

    if (!result.ok) {
      throw new Error(result.error || '관련 기록을 불러오지 못했습니다')
    }

    relatedLogsByProject = {
      ...relatedLogsByProject,
      [project.id]: result.logs || [],
    }
  } catch (error) {
    relatedLogsByProject = {
      ...relatedLogsByProject,
      [project.id]: [],
    }
    setMessage(`관련 기록 로드 실패: ${error.message}`)
  } finally {
    relatedLogsLoadingProjectId = null
    renderProjectDetailHost()
  }
}

window.openRelatedLog = function (id) {
  const relatedLogs = Object.values(relatedLogsByProject).flat()
  const log = relatedLogs.find(item => item.id === id) || bossaLogs.find(item => item.id === id)
  if (!log) return

  bossaLogs = [
    log,
    ...bossaLogs.filter(item => item.id !== log.id),
  ]
  closeProjectDetail()
  resetDetailImages()
  selectedLogId = log.id
  detailImageUrls = logImages(log)
  editingLogId = null
  metadataEditingLogId = null
  deleteConfirmLogId = null
  organizingLogId = null
  completionLogId = null
  renderWorkbenchLogs()
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

  resetDetailImages()
  selectedLogId = id
  detailImageUrls = logImages(log)
  editingLogId = null
  metadataEditingLogId = null
  deleteConfirmLogId = null
  organizingLogId = null
  completionLogId = null
  closeCreateProjectModal()
  renderWorkbenchLogs()
  setMessage('')
}

window.closeLogDetail = function () {
  selectedLogId = null
  editingLogId = null
  metadataEditingLogId = null
  deleteConfirmLogId = null
  organizingLogId = null
  completionLogId = null
  resetDetailImages()
  closeCreateProjectModal()
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
  const log = currentLog()
  setEditingState(null)
  metadataEditingLogId = null
  deleteConfirmLogId = null
  organizingLogId = null
  completionLogId = null
  captureTypePreset = ''
  resetDetailImages()
  if (log) detailImageUrls = logImages(log)
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
    organizingLogId = null
    completionLogId = null
    resetDetailImages()
    closeCreateProjectModal()
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
    tags: [...new Set(parseTags(document.querySelector('#detailTags')?.value || ''))],
    status: document.querySelector('#detailStatus')?.value || '작업중',
    isPublic: Boolean(document.querySelector('#detailPublic')?.checked),
    images: detailImageUrls,
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
  const shouldShowCompletion = organizingLogId === log.id

  try {
    const uploadedImages = await uploadImageItems(detailImageFiles)
    const updatedLog = await saveLogPayload({
      ...detailMetadataPayload(log),
      images: [...detailImageUrls, ...uploadedImages],
    }, { successMessage: '저장되었습니다.' })
    resetDetailImages()
    detailImageUrls = logImages(updatedLog)
    selectedLogId = updatedLog.id
    metadataEditingLogId = null
    editingLogId = null
    organizingLogId = null
    completionLogId = shouldShowCompletion ? updatedLog.id : null
    renderWorkbenchLogs()
  } catch (error) {
    setMessage(`저장 실패: ${error.message}`)
  }
}

window.continueWriting = function () {
  completionLogId = null
  organizingLogId = null
  selectedLogId = null
  metadataEditingLogId = null
  editingLogId = null
  captureTypePreset = ''
  resetCaptureImages()
  closeCreateProjectModal()
  renderWorkbenchLogs()
  setMessage('')
}

window.createProjectFromLog = async function () {
  const log = bossaLogs.find(item => item.id === projectCreateLogId)
  if (!log) return

  const title = document.querySelector('#createProjectTitle')?.value.trim() || ''
  const summary = document.querySelector('#createProjectSummary')?.value.trim() || ''

  if (!title) {
    setMessage('프로젝트명을 입력해주세요.')
    return
  }

  setMessage('프로젝트를 만드는 중...')

  try {
    const response = await fetch('/api/create-project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        logId: log.id,
        title,
        summary,
      }),
    })
    const result = await readApiResponse(response)

    if (!result.ok) {
      throw new Error(result.error || '프로젝트 생성 실패')
    }

    upsertLog(result.log)
    completionLogId = null
    organizingLogId = null
    selectedLogId = null
    metadataEditingLogId = null
    editingLogId = null
    closeCreateProjectModal()

    await loadBossaLogs({ silent: true })
    await loadProjectOptions()
    bossaProjectsLoaded = false
    bossaProjects = []
    selectedProjectCategory = null
    relatedLogsByProject = {}
    projectBodiesByProject = {}
    if (workbenchView === 'projects') {
      await loadWorkbenchProjects()
    }

    const stableMessage = result.schema?.stableProjectProperty
      ? ` 프로젝트 ID는 ${result.schema.stableProjectProperty}에 저장되었습니다.`
      : ' 안정적인 프로젝트 ID를 저장할 기존 Log 속성은 없어서 프로젝트명으로 연결했습니다.'
    const imageMessage = result.schema?.imageProperty
      ? ` 이미지 속성은 ${result.schema.imageProperty}를 확인했습니다.`
      : ' Projects DB에 이미지 속성이 없습니다.'

    renderWorkbenchLogs()
    setMessage(`프로젝트를 만들었습니다.${stableMessage}${imageMessage}`)
  } catch (error) {
    setMessage(`프로젝트 생성 실패: ${error.message}`)
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
  const type = isEditing ? document.querySelector('#detailType')?.value.trim() || '' : captureTypePreset
  const tags = isEditing
    ? [...new Set(parseTags(document.querySelector('#detailTags')?.value || ''))]
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
    const uploadedImages = isEditing
      ? await uploadImageItems(detailImageFiles)
      : await uploadImageItems(captureImageFiles)
    const images = isEditing ? [...detailImageUrls, ...uploadedImages] : uploadedImages
    const log = await saveLogPayload(
      { id: editingLogId, title, content, project: metadataProject, type, tags, status, isPublic, images },
      { successMessage: isEditing ? '저장되었습니다.' : '저장되었습니다. 이어서 정리해보세요.' },
    )
    resetDetailImages()
    detailImageUrls = logImages(log)
    editingLogId = null
    selectedLogId = log?.id || null

    if (!isEditing) {
      document.querySelector('#logTitle').value = ''
      document.querySelector('#logContent').value = ''
      document.querySelector('#logProject').value = ''
      captureTypePreset = ''
      resetCaptureImages()
      metadataEditingLogId = log?.id || null
      organizingLogId = log?.id || null
      completionLogId = null
    } else {
      metadataEditingLogId = null
      organizingLogId = null
      completionLogId = null
    }

    renderWorkbenchLogs()
  } catch (error) {
    message.textContent = `저장 실패: ${error.message}`
  }
}
