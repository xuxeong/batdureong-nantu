#!/usr/bin/env node
//
// Git 커밋 이력에서 docs/progress/PROGRESS.md 를 생성한다.
//
//   npm run progress
//
// 이 파일을 손으로 관리하지 않는 이유는 세 명이 같은 파일에 덧붙이면 매번 충돌하기
// 때문이다. 재생성 방식이라 충돌이 발생하지 않고, Git 이력이 이미 정확한 원본이라
// 따로 관리할 필요도 없다.
//
// 출력은 커밋 이력에서만 결정된다. 새 커밋이 없으면 다시 실행해도 파일이 바뀌지
// 않는다. (생성 시각 같은 값을 넣지 않는다)

import { execFileSync } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const OUTPUT = 'docs/progress/PROGRESS.md'

const RS = '\x1e'
const US = '\x1f'

// 커밋 메시지 태그. docs/team-rules.md 의 컨벤션.
const TAGS = ['Feat', 'Fix', 'Data', 'Docs', 'Art', 'Refactor', 'Test', 'Chore']

/**
 * 저장소 최상위 폴더를 작업 영역으로 본다.
 * docs/ 와 data/ 는 하위 폴더까지 구분한다. 담당이 그 아래에서 갈리기 때문이다.
 */
function areaOf(path) {
  const parts = path.split('/')
  const top = parts[0]

  if (parts.length === 1) return '(루트)'

  // docs/planning/... → docs/planning, docs/team-rules.md → docs
  if ((top === 'docs' || top === 'data') && parts.length >= 3) {
    return `${top}/${parts[1]}`
  }

  return top
}

function readCommits() {
  let raw
  try {
    raw = execFileSync(
      'git',
      [
        // 한글 파일명을 \353\260\255 처럼 이스케이프하지 않게 한다
        '-c',
        'core.quotepath=false',
        'log',
        '--reverse',
        `--pretty=format:${RS}%H${US}%an${US}%ad${US}%s`,
        '--date=short',
        '--name-only',
      ],
      { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }
    )
  } catch {
    return null
  }

  return raw
    .split(RS)
    .filter((chunk) => chunk.trim() !== '')
    .map((chunk) => {
      const [head, ...rest] = chunk.split('\n')
      const [hash, author, date, subject] = head.split(US)
      const files = rest.map((l) => l.trim()).filter(Boolean)

      const match = subject.match(/^\[(\w+)\]\s*(.*)$/)
      const tag = match && TAGS.includes(match[1]) ? match[1] : null
      const title = match && tag ? match[2] : subject

      return {
        hash: hash.slice(0, 7),
        author,
        date,
        tag,
        title,
        files,
        areas: [...new Set(files.map(areaOf))].sort(),
      }
    })
}

function buildSummary(commits) {
  const byAuthor = new Map()
  for (const c of commits) {
    if (!byAuthor.has(c.author)) {
      byAuthor.set(c.author, { total: 0, tags: {}, areas: new Set() })
    }
    const entry = byAuthor.get(c.author)
    entry.total++
    const key = c.tag ?? '(태그 없음)'
    entry.tags[key] = (entry.tags[key] ?? 0) + 1
    for (const a of c.areas) entry.areas.add(a)
  }

  const lines = [
    '## 담당자별 요약',
    '',
    '| 담당자 | 커밋 | 주요 태그 | 작업한 영역 |',
    '|---|---|---|---|',
  ]

  const authors = [...byAuthor.entries()].sort((a, b) => b[1].total - a[1].total)
  for (const [author, entry] of authors) {
    const tags = Object.entries(entry.tags)
      .sort((a, b) => b[1] - a[1])
      .map(([t, n]) => `${t} ${n}`)
      .join(' · ')
    const areas = [...entry.areas].sort().join(', ') || '—'
    lines.push(`| ${author} | ${entry.total} | ${tags} | ${areas} |`)
  }

  return lines
}

function buildTimeline(commits) {
  // 읽는 게 목적이라 한 줄씩만 둔다.
  // 어떤 영역을 맡았는지는 담당자별 요약 표에서 본다.
  const lines = ['## 날짜별 기록', '']

  const byDate = new Map()
  for (const c of commits) {
    if (!byDate.has(c.date)) byDate.set(c.date, [])
    byDate.get(c.date).push(c)
  }

  const dates = [...byDate.keys()].sort().reverse()
  for (const date of dates) {
    lines.push(`### ${date}`)
    lines.push('')
    for (const c of byDate.get(date)) {
      const tag = c.tag ? `\`[${c.tag}]\` ` : ''
      lines.push(`- ${tag}${c.title} — ${c.author} · \`${c.hash}\``)
    }
    lines.push('')
  }

  return lines
}

function main() {
  const commits = readCommits()

  if (commits === null) {
    console.error('git 이력을 읽지 못했다. 저장소 안에서 실행한다.')
    process.exit(1)
  }

  const header = [
    '# 작업 진행 기록',
    '',
    '> **이 파일은 자동 생성된다. 직접 수정하지 않는다.**',
    '>',
    '> ```bash',
    '> npm run progress',
    '> ```',
    '>',
    '> Git 커밋 이력에서 만든다. 커밋 메시지에 담기 어려운 맥락은',
    '> `docs/progress/sessions/<본인>.md` 에 남긴다.',
    '',
  ]

  if (commits.length === 0) {
    header.push('아직 커밋이 없다.')
    write(header.join('\n') + '\n')
    console.log(`${OUTPUT} 생성 (커밋 0개)`)
    return
  }

  const out = [
    ...header,
    `커밋 ${commits.length}개 · ${commits[0].date} ~ ${commits[commits.length - 1].date}`,
    '',
    ...buildSummary(commits),
    '',
    ...buildTimeline(commits),
  ]

  write(out.join('\n').replace(/\n{3,}/g, '\n\n') + '\n')
  console.log(`${OUTPUT} 생성 (커밋 ${commits.length}개)`)
}

function write(text) {
  mkdirSync(dirname(OUTPUT), { recursive: true })
  writeFileSync(OUTPUT, text, 'utf8')
}

main()
