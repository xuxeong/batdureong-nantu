#!/usr/bin/env node
//
// 고정 시스템 프롬프트 원본(.md)을 서버리스 함수가 import 할 모듈로 굽는다.
//
//   node tools/build-prompts.mjs        (npm run build / npm run dev 가 먼저 부른다)
//
// ── 왜 필요한가 ────────────────────────────────────────────
//
// api/ 는 edge 런타임에서 돌아야 한다. Vercel 의 Node 런타임은 기본 export 를
// (req, res) 로 취급해 표준 Response 반환이 죽는다 (api/health.ts 주석, 8/5에 재현).
// 그런데 edge 에는 파일 시스템이 없어 .md 를 읽을 수 없다.
//
// **그렇다고 프롬프트 문장을 코드에 복사할 수는 없다.** DEC-PIPELINE-012 와
// DEC-JOURNAL-004 가 고정 시스템 지시문의 단일 원본을 파일 하나로 정했다.
// 그래서 빌드 시점에 .md 에서 모듈을 생성한다 — 원본은 여전히 .md 하나뿐이고,
// 생성물은 커밋하지 않는다 (generated/runtime/ 과 같은 취급).
//
// 편집용 HTML 주석은 사람에게 주는 설명이지 모델에게 주는 지시가 아니라 걷어낸다.

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const SRC = 'schema'
const OUT = join('api', '_prompts.ts')

const FILES = [
  { name: 'ENDING_SYSTEM_PROMPT', file: 'ending_prompt_system.md' },
  { name: 'JOURNAL_SYSTEM_PROMPT', file: 'journal_prompt_system.md' },
]

function body(raw) {
  return raw.replace(/<!--[\s\S]*?-->/g, '').trim()
}

const parts = [
  '// 자동 생성물. 직접 수정하지 않는다.',
  '//',
  '// 원본은 schema/*_prompt_system.md 이고 tools/build-prompts.mjs 가 굽는다.',
  '// 프롬프트를 고치려면 .md 를 고치고 다시 빌드한다 (DEC-PIPELINE-012, DEC-JOURNAL-004).',
  '',
]

for (const { name, file } of FILES) {
  const text = body(readFileSync(join(SRC, file), 'utf8'))
  if (text.length === 0) {
    console.error(`${file} 의 본문이 비어 있다. 프롬프트 없이 생성하지 않는다.`)
    process.exit(1)
  }
  parts.push(`export const ${name} = ${JSON.stringify(text)}`)
  parts.push('')
}

writeFileSync(OUT, parts.join('\n'), 'utf8')
console.log(`${OUT} 생성 — ${FILES.map((f) => f.file).join(', ')}`)
