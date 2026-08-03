// 런타임 JSON 적재 (개발 로드맵 8/2, DEC-UI-024)
//
// `generated/runtime/` 은 승인 CSV에서 `npm run data:build` 로 만든다.
// 이 폴더는 커밋하지 않으므로 저장소를 갓 받은 상태에서는 비어 있다.
// 그때 **빈 값으로 조용히 넘어가지 않고 데이터 오류로 올린다** (AGENTS.md 6절).
//
// `import.meta.glob` 을 쓰는 이유: `generated/` 는 `publicDir` 밖이라 정적 경로로
// fetch 할 수 없다. 번들에 포함시켜야 개발 서버와 빌드 결과가 같은 경로로 동작한다.
// 파일이 하나도 없으면 glob 결과가 빈 객체이고, 그것 자체가 "승인 데이터 없음" 신호다.

import type { RuntimeData, RuntimeManifest, RuntimeTableName } from './types.ts'
import { DataMissingError } from './run-config.ts'

/** 빌드 시점에 확정되는 모듈 목록. 키는 `/generated/runtime/crops.json` 형태다 */
const MODULES = import.meta.glob<unknown>('/generated/runtime/*.json', {
  import: 'default',
})

const RUNTIME_DIR = '/generated/runtime/'

function pathFor(file: string): string {
  return `${RUNTIME_DIR}${file}`
}

async function loadJson(file: string): Promise<unknown> {
  const loadModule = MODULES[pathFor(file)]
  if (loadModule === undefined) {
    throw new DataMissingError(
      `${file} 이(가) generated/runtime/ 에 없다. npm run data:build 를 먼저 실행한다`,
    )
  }
  return loadModule()
}

/**
 * 승인 데이터를 모두 읽는다.
 *
 * 매니페스트가 없으면 아무것도 승인되지 않은 것이므로 즉시 오류다.
 * 매니페스트에 적힌 파일이 실제로 없어도 오류다 — 생성물이 손상된 상태이지
 * "그 테이블은 원래 없는 것"이 아니다.
 */
export async function loadRuntimeData(): Promise<RuntimeData> {
  if (Object.keys(MODULES).length === 0) {
    throw new DataMissingError(
      'generated/runtime/ 이 비어 있다. data/approved/ 에 승인 CSV를 올리고 ' +
        'npm run data:build 를 실행한다 (DEC-PIPELINE-010)',
    )
  }

  const manifest = (await loadJson('manifest.json')) as RuntimeManifest
  if (!Array.isArray(manifest.files)) {
    throw new DataMissingError('manifest.json 에 files 목록이 없다')
  }

  const data = { manifest } as RuntimeData

  for (const file of manifest.files) {
    const table = file.replace(/\.json$/, '') as RuntimeTableName
    const rows = await loadJson(file)
    if (!Array.isArray(rows)) {
      throw new DataMissingError(`${file} 의 최상위가 배열이 아니다`)
    }
    // 테이블 이름은 매니페스트가 정한다. 여기서 목록을 다시 적으면
    // 새 테이블이 생겼을 때 두 곳을 고쳐야 한다.
    ;(data as unknown as Record<string, unknown>)[table] = rows
  }

  return data
}

/**
 * 이 단계에 반드시 있어야 하는 테이블을 확인한다.
 *
 * 호출하는 쪽이 무엇이 필요한지 밝히게 해서, 빠진 테이블이
 * `undefined` 로 흘러 들어가 한참 뒤에 이상한 증상으로 나타나는 것을 막는다.
 */
export function requireTables<K extends RuntimeTableName>(
  data: RuntimeData,
  tables: readonly K[],
): void {
  const missing = tables.filter((name) => {
    const rows = data[name]
    return rows === undefined || rows.length === 0
  })

  if (missing.length > 0) {
    throw new DataMissingError(
      `승인된 행이 없는 필수 테이블: ${missing.join(', ')}. ` +
        'data/approved/ 로 올린 뒤 npm run data:build 를 다시 실행한다',
    )
  }
}
