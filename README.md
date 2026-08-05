# 밭두렁난투

NAN 해커톤 사전과제 게임 프로젝트 저장소.

> 플레이어는 낮에 무작위 작물을 재배하고 야생동물을 막으며, 정비 단계에서 수확물을 판매해
> 재료를 사고 무기와 회복 아이템을 제작한다. 습격일 밤에는 사연을 가진 주민과 대화·협상하거나
> 싸우고, 누적된 관계·공포도·작물 활용 기록으로 엔딩이 결정된다.
>
> — `docs/planning/밭두렁난투_시스템_UIUX_기획서_현재본.md` 2절

---

## 기준 문서

작업을 시작하기 전에 읽는다. **이 저장소의 문서는 기획 문서를 요약하거나 다시 설명하지 않는다.**
게임 규칙에 대한 설명이 필요하면 아래 문서를 직접 본다.

| 문서 | 위치 |
|---|---|
| 모든 AI의 최상위 작업 규칙 | [`AGENTS.md`](AGENTS.md) |
| 기획 결정 로그 (단일 원본) | [`docs/planning/밭두렁난투_기획_결정로그_현재본.md`](docs/planning/밭두렁난투_기획_결정로그_현재본.md) |
| 시스템·UI/UX 기획서 | [`docs/planning/밭두렁난투_시스템_UIUX_기획서_현재본.md`](docs/planning/밭두렁난투_시스템_UIUX_기획서_현재본.md) |
| 콘텐츠 데이터 준비도 점검 | [`docs/planning/밭두렁난투_콘텐츠_데이터_준비도_점검.md`](docs/planning/밭두렁난투_콘텐츠_데이터_준비도_점검.md) |
| DEC 변경 시 영향 문서·절 매핑 | [`docs/governance/document-impact-map.csv`](docs/governance/document-impact-map.csv) |

문서 해석 순서는 `AGENTS.md` 2절을 따른다. Claude Code는 [`CLAUDE.md`](CLAUDE.md)를 통해
`AGENTS.md`를 불러온다.

---

## 시작하기

```bash
npm install
npm run dev
```

| 명령 | 하는 일 |
|---|---|
| `npm run dev` | 개발 서버 실행 |
| `npm run build` | 배포용 빌드 (`dist/`) |
| `npm run data:normalize` | `data/drafts/` → `data/candidates/` 정규화 + 변경 보고서 |
| `npm run data:validate` | `data/approved/` 검증 |
| `npm run data:build` | `data/approved/` → `generated/runtime/` 생성 |
| `npm run docs:check` | 기획 문서 구조 자동 검수 |
| `npm run progress` | Git 이력 → `docs/progress/PROGRESS.md` 생성 |
| `npm run test` | 단위 테스트 |

> 도구는 순차적으로 구현 중이다. 아직 없는 명령은 실행되지 않는다.

---

## 담당 영역

폴더를 담당자별로 나눠 세 명이 동시에 작업해도 같은 파일을 건드리지 않게 한다.

| 담당 | 역할 | 주 작업 폴더 |
|---|---|---|
| 전성민 | 기획 | `docs/planning/`, `docs/governance/` |
| 김민주 | 기획 + 콘텐츠·레벨 데이터 | `data/drafts/`, `data/candidates/` |
| 최수정 | 개발 | `src/`, `tools/`, `schema/`, `api/` |
| 공용 | — | `data/approved/`, `docs/submission/`, `README.md` |

커밋·브랜치·라이선스 기록 규칙은 [`docs/team-rules.md`](docs/team-rules.md)에 있다.

---

## 폴더 구조

```
batdureong-nantu/
├── AGENTS.md                  모든 AI의 최상위 작업 규칙
├── CLAUDE.md                  Claude Code 진입점
├── index.html                 게임 진입점
├── package.json  vite.config.js
├── .env.example               환경변수 예시 (실제 .env는 커밋 금지)
│
├── public/                    빌드 없이 그대로 서빙되는 정적 파일
│
├── docs/
│   ├── planning/              기획 기준 문서 3종
│   ├── governance/            document-impact-map.csv
│   ├── team-rules.md          커밋·브랜치·라이선스 기록 규칙
│   ├── progress/
│   │   ├── PROGRESS.md          Git 이력에서 자동 생성 (직접 수정 금지)
│   │   └── sessions/            개인별 작업 로그
│   └── submission/            제출 자료 원본
│       └── CREDITS.md           외부 에셋·폰트·오픈소스 출처와 라이선스
│
├── schema/                    콘텐츠 CSV 구조 정의
│   ├── common_entry.json        독립 콘텐츠 공통 열
│   ├── schema_manifest.json     schema_version 등 3종 버전
│   ├── enums.json               고정 허용 목록
│   ├── ending_prompt_system.md  엔딩 LLM 고정 시스템 프롬프트
│   ├── ending_input.schema.json 엔딩 LLM 입력 객체 구조
│   └── tables/                  콘텐츠 CSV의 필드·범위·참조 정의
│
├── data/
│   ├── drafts/                작업용 초안 (UTF-8 BOM 허용)
│   ├── candidates/            승인 후보
│   │   └── reports/             변경 보고서와 검수표
│   └── approved/              승인본 — AI가 직접 쓰지 않는다
│
├── generated/runtime/         승인 CSV에서 생성한 런타임 JSON
│                                커밋하지 않고 npm run data:build 로 재생성한다.
│
├── tools/                     검증·생성 명령
├── api/                       서버리스 함수 (엔딩 기록문 생성)
│
├── src/
│   ├── app/       부트스트랩·씬 전환·빌드 플래그
│   ├── core/      clock · rng · transaction · errors
│   ├── data/      런타임 JSON 로더·참조 인덱스·부팅 검증
│   ├── state/     런 상태
│   ├── systems/   게임 규칙
│   ├── render/    viewport · asset-resolver · placeholder · layers
│   ├── audio/     효과음·BGM
│   ├── scenes/    화면 흐름
│   ├── ui/        DOM 오버레이
│   ├── input/     키 바인딩·입력 잠금
│   └── llm/       엔딩 입력 조립·api 호출·폴백
│
├── assets/{placeholder,final}/
├── tests/{fixtures,*.test.mjs}
├── .github/workflows/ci.yml
└── .claude/settings.json
```

---

## 콘텐츠 데이터 흐름

```
schema/tables/         구조 정의
        │
        ▼
data/drafts/           담당자와 AI가 값을 채우는 작업용 CSV
        │  npm run data:normalize
        ▼
data/candidates/       정규화된 승인 후보 + 변경 보고서
        │  담당자가 검토하고 직접 승인
        ▼
data/approved/         승인본
        │  npm run data:validate → npm run data:build
        ▼
generated/runtime/     게임이 읽는 JSON
```

절차와 권한은 `AGENTS.md` 4절·7절과 `DEC-PIPELINE-004`, `DEC-PIPELINE-007`을 따른다.
CSV 제작 순서와 단계별 진행 방법은 `docs/planning/밭두렁난투_콘텐츠_데이터_준비도_점검.md`에 있다.

---

## 제출 자료

에셋·폰트·오픈소스를 추가할 때는 그 커밋에서 [`docs/submission/CREDITS.md`](docs/submission/CREDITS.md)에
출처·라이선스·생성 도구·프롬프트를 기록한다. 외부 에셋의 출처와 라이선스 명시는 대회 제출
필수 요건이다.
