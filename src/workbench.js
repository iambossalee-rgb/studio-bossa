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
          <span>2026.06.25 WED</span>
          <button onclick="goHome()">Gallery 보기</button>
        </header>

        <section class="wb-hero">
          <h2>오늘,<br>무엇을 남길까요?</h2>
          <p>정리하려고 애쓰지 말고 지금 떠오른 것을 그대로 남겨요.</p>
        </section>

        <section class="wb-write">
          <input id="logTitle" placeholder="기록 제목" />
          <textarea id="logContent" placeholder="생각, 아이디어, 회의 메모, 오늘의 장면..."></textarea>

          <div class="wb-field-row">
            <select id="logProject">
              <option value="">프로젝트 선택</option>
              <option value="Studio BOSSA">Studio BOSSA</option>
              <option value="초로록">초로록</option>
              <option value="미구">미구</option>
              <option value="죽어도 안 죽어지는">죽어도 안 죽어지는</option>
            </select>

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
            <button onclick="createBossaLog()">기록하기</button>
          </div>

          <p id="saveMessage" class="wb-message"></p>
        </section>

        <section class="wb-list">
          <div class="wb-section-head">
            <h3>오늘의 기록</h3>
            <small>recent</small>
          </div>

          <article>
            <time>방금</time>
            <div>
              <h4>이제부터 기록이 Notion에 저장됩니다</h4>
              <p>위 입력창에 기록을 남기고 저장하면 BOSSA Log 데이터베이스로 들어갑니다.</p>
            </div>
            <em>v0.1</em>
          </article>
        </section>
      </main>
    </div>
  `
}

window.createBossaLog = async function () {
  const title = document.querySelector('#logTitle').value.trim()
  const content = document.querySelector('#logContent').value.trim()
  const project = document.querySelector('#logProject').value
  const status = document.querySelector('#logStatus').value
  const isPublic = document.querySelector('#logPublic').checked
  const message = document.querySelector('#saveMessage')

  if (!title && !content) {
    message.textContent = '기록할 내용을 먼저 적어주세요.'
    return
  }

  message.textContent = '저장 중...'

  try {
    const response = await fetch('/api/create-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content, project, status, isPublic }),
    })

    const result = await response.json()

    if (!result.ok) {
      throw new Error(result.error || '저장 실패')
    }

    message.textContent = '저장되었습니다.'

    document.querySelector('#logTitle').value = ''
    document.querySelector('#logContent').value = ''
    document.querySelector('#logPublic').checked = false
  } catch (error) {
    message.textContent = `저장 실패: ${error.message}`
  }
}