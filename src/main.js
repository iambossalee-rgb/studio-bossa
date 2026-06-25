import { initWorkbench, workbenchPage } from './workbench.js'
import './style.css'

async function loadProjects() {
  const response = await fetch('/projects.json')
  return await response.json()
}

async function loadProjectDetail(slug) {
  const response = await fetch(`/projects/${slug}.json`)
  return await response.json()
}

function escapeHtml(text = '') {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function homePage(projects = []) {
  return `
  <div class="site">
    <section class="hero">
      <p class="eyebrow">STUDIO BOSSA</p>
      <h1>사람의 이야기를 발견하고,<br>디자인과 콘텐츠로 연결합니다.</h1>
      <p class="intro">
        브랜드, 디자인, 글쓰기, 교육, 제작. Studio BOSSA는 사람과 브랜드의 가능성을 발견하고
        그것을 현실의 형태로 연결합니다.
      </p>
    </section>

    <section class="section">
      <div class="section-head">
        <h2>Projects</h2>
      </div>

      <div class="grid">
        ${projects.map(project => `
          <article class="card" onclick="openProject('${project.slug}')">
            ${project.image ? `<img class="card-image" src="${project.image}" alt="${escapeHtml(project.title)}">` : ''}
            <div class="card-body">
              <span class="label">${escapeHtml(project.brand)}</span>
              <h3>${escapeHtml(project.title)}</h3>
              <p>${escapeHtml(project.summary || project.category)}</p>
            </div>
          </article>
        `).join('')}
      </div>
    </section>
  </div>
  `
}

function renderBlock(block) {
  if (block.type === 'heading_1') return `<h2 class="content-h1">${escapeHtml(block.text)}</h2>`
  if (block.type === 'heading_2') return `<h2 class="content-h2">${escapeHtml(block.text)}</h2>`
  if (block.type === 'heading_3') return `<h3 class="content-h3">${escapeHtml(block.text)}</h3>`
  if (block.type === 'paragraph') return `<p class="content-p">${escapeHtml(block.text)}</p>`
  if (block.type === 'bulleted_list_item') return `<p class="content-list">• ${escapeHtml(block.text)}</p>`
  if (block.type === 'quote') return `<blockquote class="content-quote">${escapeHtml(block.text)}</blockquote>`
  if (block.type === 'divider') return `<hr class="content-divider">`

  if (block.type === 'image') {
    return `
      <figure class="content-image-wrap">
        <img class="content-image zoomable" src="${block.url}" alt="${escapeHtml(block.caption || '')}" onclick="openLightbox('${block.url}')">
        ${block.caption ? `<figcaption>${escapeHtml(block.caption)}</figcaption>` : ''}
      </figure>
    `
  }

  return ''
}

function projectPage(project) {
  return `
  <div class="project">
    <button class="back" onclick="goHome()">← Projects</button>

    <div class="project-header">
      <span>${escapeHtml(project.brand)}</span>
      <h1>${escapeHtml(project.title)}</h1>
      <p>${escapeHtml(project.summary || project.category)}</p>
    </div>

    ${project.image ? `
      <figure class="project-hero-image">
        <img class="zoomable" src="${project.image}" alt="${escapeHtml(project.title)}" onclick="openLightbox('${project.image}')">
      </figure>
    ` : ''}

    <article class="project-content">
      ${
        project.blocks && project.blocks.length
          ? project.blocks.map(renderBlock).join('')
          : `<p class="content-p">노션 본문에 기록을 추가하면 이 영역에 자동으로 표시됩니다.</p>`
      }
    </article>
  </div>
  `
}

window.openProject = function(slug) {
  loadProjectDetail(slug).then(project => {
    document.querySelector('#app').innerHTML = projectPage(project)
    window.scrollTo(0, 0)
  })
}

window.goHome = function() {
  loadProjects().then(data => {
    document.querySelector('#app').innerHTML = homePage(data)
    window.scrollTo(0, 0)
  })
}

window.openLightbox = function(url) {
  const lightbox = document.createElement('div')
  lightbox.className = 'lightbox'
  lightbox.innerHTML = `
    <button class="lightbox-close" onclick="this.parentElement.remove()">×</button>
    <img src="${url}" alt="">
  `
  lightbox.onclick = event => {
    if (event.target.className === 'lightbox') lightbox.remove()
  }
  document.body.appendChild(lightbox)
}

if (window.location.pathname === '/me') {
  document.querySelector('#app').innerHTML = workbenchPage()
  initWorkbench()
} else {
  loadProjects().then(data => {
    document.querySelector('#app').innerHTML = homePage(data)
  })
}
