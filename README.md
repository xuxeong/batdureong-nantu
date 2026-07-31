# 밭두렁난투

NAN 해커톤 사전과제 게임 프로젝트. PC 브라우저에서 실행하는 HTML 프로토타입이다.

낮에는 무작위 작물을 재배하고 야생동물을 막으며, 정비 단계에서 수확물을 팔아 무기와 회복
아이템을 만든다. 습격일 밤에는 사연을 가진 주민과 대화·협상하거나 싸우고, 누적된 관계·공포도·
작물 활용 기록으로 엔딩이 결정된다.

---

## 시작하기

```bash
npm install
npm run dev
```

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 실행 |
| `npm run build` | 배포용 빌드 (`dist/`) |
| `npm run data:normalize` | 작업용 CSV → 승인 후보 CSV + 변경 보고서 |
| `npm run data:validate` | 승인 CSV 전체 검증 (차단·주의·제안) |
| `npm run data:build` | 승인 CSV → 런타임 JSON 생성 |
| `npm run docs:check` | 기획 문서 구조 자동 검수 (DEC ID 중복·참조·형식) |
| `npm run progress` | Git 커밋 이력 → `docs/progress/PROGRESS.md` 생성 |
| `npm run test` | 판정 알고리즘 단위 테스트 |

> 데이터·문서 도구는 순차적으로 구현 중이다. 아직 없는 명령은 실행되지 않는다.

---

## 기준 문서

작업 전에 반드시 확인한다. 문서가 서로 다르면 **위에 있는 문서를 따른다.**

| 순위 | 문서 | 역할 |
|---|---|---|
| 1 | [`AGENTS.md`](AGENTS.md) | 모든 AI의 최상위 작업 규칙·승인 절차·변경 안전 규칙 |
| 2 | [`docs/planning/밭두렁난투_기획_결정로그_현재본.md`](docs/planning/밭두렁난투_기획_결정로그_현재본.md) | 확정·보류·폐기 결정(DEC)의 단일 원본 |
| 3 | [`docs/planning/밭두렁난투_시스템_UIUX_기획서_현재본.md`](docs/planning/밭두렁난투_시스템_UIUX_기획서_현재본.md) | 현재 게임 구조를 설명하는 읽기용 기획서 |
| 4 | [`docs/planning/밭두렁난투_콘텐츠_데이터_준비도_점검.md`](docs/planning/밭두렁난투_콘텐츠_데이터_준비도_점검.md) | 콘텐츠 CSV 제작 순서와 출력 형식 |

- `확정` DEC만 현재 규칙으로 사용한다.
- `보류` DEC는 재검토 조건이 충족되기 전까지 임의로 채우지 않는다.
- `폐기` DEC는 과거 기록이며 반드시 `대체 결정`을 확인한다.
- 게임을 처음 이해한다면 **시스템·UI/UX 기획서**부터 읽는다. 결정로그는 처음부터 끝까지 읽는
  문서가 아니라 근거를 확인하는 원장이다.

[`docs/governance/document-impact-map.csv`](docs/governance/document-impact-map.csv)는 DEC가 바뀔 때
영향을 받는 문서와 절을 찾는 매핑표다.

Claude Code는 [`CLAUDE.md`](CLAUDE.md)를 통해 `AGENTS.md`를 자동으로 불러온다.

---

## 담당 영역

**폴더가 담당자별로 나뉘어 있어 세 명이 동시에 작업해도 같은 파일을 건드릴 일이 거의 없다.**

| 담당 | 역할 | 주 작업 폴더 |
|---|---|---|
| 전성민 | 기획 | `docs/planning/`, `docs/governance/` |
| 김민주 | 기획 + 콘텐츠·레벨 데이터 | `data/drafts/`, `data/candidates/` |
| 최수정 | 개발 | `src/`, `tools/`, `schema/`, `api/` |
| 공용 | — | `data/approved/`, `docs/submission/`, `README.md` |

공용 파일을 수정할 때는 [`docs/team-rules.md`](docs/team-rules.md)의 규칙을 따른다.

---

## 폴더 구조

```
batdureong-nantu/
├── AGENTS.md                  모든 AI의 최상위 작업 규칙
├── CLAUDE.md                  Claude Code 진입점 (@AGENTS.md 임포트)
├── index.html                 게임 진입점
├── package.json               명령·의존성
├── vite.config.js             빌드 설정
├── .env.example               환경변수 예시 (실제 .env는 커밋 금지)
│
├── public/                    빌드 없이 그대로 서빙되는 정적 파일
│                                favicon, og 이미지
│
├── docs/
│   ├── planning/              기획 기준 문서 3종
│   ├── governance/            document-impact-map.csv
│   ├── team-rules.md          커밋 규칙·브랜치·라이선스 기록 규칙
│   ├── progress/
│   │   ├── PROGRESS.md          Git 이력에서 자동 생성 (직접 수정 금지)
│   │   └── sessions/            개인별 작업 로그 (파일 분리로 충돌 방지)
│   └── submission/            제출 자료 원본
│       ├── 01-게임소개.md
│       ├── 02-AI활용기술.md
│       ├── 03-팀원롤.md
│       ├── CREDITS.md           외부 에셋·폰트·오픈소스 출처와 라이선스
│       └── links.md             배포 URL·영상·저장소 링크
│
├── schema/                    데이터 규칙의 단일 원본
│   ├── schema_manifest.json     schema_version 등 3종 버전 (DEC-PIPELINE-012)
│   ├── ending_prompt_system.md  엔딩 LLM 고정 시스템 프롬프트
│   ├── ending_input.schema.json LLM 입력 객체 구조
│   ├── enums.json               system_result.* 등 고정 허용 목록
│   └── tables/                  콘텐츠 CSV 31종의 필드·자료형·참조·부모 정의
│
├── data/                      콘텐츠 CSV (사람과 AI가 편집하는 원본)
│   ├── drafts/                  작업용 초안. 엑셀 편집 가능 (UTF-8 BOM 허용)
│   ├── candidates/              AI가 정규화한 승인 후보
│   │   └── reports/               변경 보고서와 검수표
│   └── approved/                담당자가 승인한 CSV — AI가 직접 쓰지 않는다
│
├── generated/runtime/         승인 CSV에서 생성한 런타임 JSON
│                                자동 생성물이므로 직접 수정하지 않는다.
│                                커밋하지 않고 `npm run data:build`로 재생성한다.
│
├── tools/                     검증·생성 명령
│   ├── normalize.mjs            drafts → candidates + 변경 보고서
│   ├── validate.mjs             승인 CSV 전체 검증
│   ├── build-runtime.mjs        approved → 런타임 JSON
│   ├── check-docs.mjs           기획 문서 구조 자동 검수
│   ├── progress.mjs             Git 이력 → PROGRESS.md
│   └── lib/                     공용 CSV 파싱·정규화·보고서 모듈
│
├── api/                       서버리스 함수
│   ├── ending.mjs               POST /api/ending — 엔딩 기록문 생성
│   └── _lib/                    (_ 로 시작하는 파일은 엔드포인트로 노출되지 않음)
│       ├── prompt.mjs             schema/의 프롬프트를 읽는다 (코드에 복사 금지)
│       ├── guard.mjs              플레이어 이름을 인용 데이터로 처리
│       └── validate-out.mjs       출력 구조·길이·형식 검사
│
├── src/                       게임 코드
│   ├── app/                     부트스트랩, 씬 전환, 개발·제출 빌드 플래그
│   ├── core/                    엔진에 의존하지 않는 기반
│   │   ├── clock.js               타임스케일과 정지 규칙
│   │   ├── rng.js                 시드 기반 결정적 난수
│   │   ├── transaction.js         원자적 처리
│   │   └── errors.js              차단·주의·제안 오류 체계
│   ├── data/                    런타임 JSON 로더, 참조 인덱스, 부팅 검증
│   ├── state/                   런 상태의 단일 원본
│   ├── systems/                 게임 규칙 (렌더링에 의존하지 않아 테스트 가능)
│   ├── render/                  그리기 전담
│   │   ├── viewport.js            논리 월드 좌표 ↔ 화면 픽셀
│   │   ├── asset-resolver.js      논리 에셋 ID → 실제 파일 경로
│   │   ├── placeholder.js         아트가 없을 때의 대체 표현
│   │   └── layers/                맵·경작지·작물·개체·투사체·이펙트
│   ├── audio/                   효과음·BGM 재생, 음량과 음소거
│   ├── scenes/                  화면 흐름 (DEC-RUN-012)
│   ├── ui/                      DOM 오버레이 (HUD·상점·제작·대화·결과)
│   │   └── dev/                   개발 빌드 전용 표시
│   ├── input/                   키 바인딩과 입력 소유권·잠금
│   └── llm/                     엔딩 입력 조립 → api 호출 → 실패 시 폴백
│
├── assets/
│   ├── placeholder/             프로토타입용 임시 리소스
│   └── final/                   실제 아트 (DEC-ART-001 확정 후)
│         sprites/ ui/ fonts/ sfx/ bgm/
│
├── tests/
│   ├── fixtures/                테스트용 데이터 (DEC-PIPELINE-016)
│   └── *.test.mjs               판정 알고리즘 단위 테스트
│
├── .github/workflows/ci.yml   PR에서 CSV 검증·테스트 자동 실행
└── .claude/settings.json      팀 공유 훅 설정
```

---

## 콘텐츠 데이터 흐름

```
schema/tables/         구조 정의 (필드·자료형·참조)
        │
        ▼
data/drafts/           담당자와 AI가 값을 채우는 작업용 CSV
        │  npm run data:normalize
        ▼
data/candidates/       정규화된 승인 후보 + 변경 보고서
        │  담당자가 검토하고 직접 승인
        ▼
data/approved/         승인본 — AI가 직접 쓰지 않는다
        │  npm run data:validate → npm run data:build
        ▼
generated/runtime/     게임이 읽는 JSON — 직접 수정하지 않는다
```

`AGENTS.md` 7절과 `DEC-PIPELINE-004`에 따른 구분이다. **AI는 `data/approved/`와
`generated/runtime/`을 직접 덮어쓰지 않는다.**

---

## 역할별 작업 시작 방법

### 콘텐츠·레벨 (CSV 작성)

1. AI에게 `AGENTS.md` 적용을 확인시킨 뒤 기준 문서 2~4번을 함께 읽게 한다.
2. `docs/planning/밭두렁난투_콘텐츠_데이터_준비도_점검.md`의 제작 순서를 따라 한 단계씩 진행한다.
   (1단계 맵 → 2단계 작물 → … → 12단계 엔딩)
3. 해당 단계의 CSV 헤더는 `schema/tables/`에 정의돼 있다.
4. 초안은 `data/drafts/`에 두고, 정규화 결과는 `data/candidates/`에서 검토한 뒤
   승인한 파일만 `data/approved/`로 옮긴다.

준비도 문서 13~16절에 그대로 복사해 쓸 수 있는 프롬프트가 있다.

### 구현

1. 폐기되지 않은 확정 DEC와 승인 데이터를 입력으로 사용한다.
2. 작물·가격·확률·시간·좌표·대사·보상 같은 **변경 가능한 게임 데이터는 코드에 하드코딩하지
   않는다.** 필수 데이터가 없으면 기본값으로 숨기지 말고 검증 오류로 보고한다. (`DEC-PIPELINE-016`)
3. 실제 아트가 없으면 플레이스홀더를 쓰고, 코드는 파일 경로가 아니라 논리 에셋 ID를 참조한다.
4. 변경 후 관련 검증을 실행하고, 실행하지 못한 검증과 남은 위험을 보고한다.

### 시스템 규칙에 문제를 발견했을 때

임의로 CSV 열을 추가하거나 코드에 예외를 만들지 않는다. 작업을 멈추고 `AGENTS.md` 5절의
절차에 따라 기획 책임자에게 보고한 뒤 결정을 받는다.

---

## 제출 자료

에셋·폰트·오픈소스를 추가할 때는 **그 시점에** [`docs/submission/CREDITS.md`](docs/submission/CREDITS.md)에
출처·라이선스·생성 도구·프롬프트를 한 줄 기록한다. 외부 에셋의 출처와 라이선스 명시는
대회 제출 필수 요건이며, 마감에 몰아서 정리하면 반드시 누락된다.
