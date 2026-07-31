@AGENTS.md

# Claude Code 연결 규칙

`AGENTS.md`를 이 프로젝트의 단일 AI 작업 규칙으로 사용한다. 이 파일에 같은 규칙을 복제하거나 다시 정의하지 않는다.

콘텐츠·레벨 작업을 시작할 때는 `AGENTS.md`를 적용한 뒤 다음 세 문서를 함께 읽는다.

- `docs/planning/밭두렁난투_기획_결정로그_현재본.md`
- `docs/planning/밭두렁난투_시스템_UIUX_기획서_현재본.md`
- `docs/planning/밭두렁난투_콘텐츠_데이터_준비도_점검.md`

## 저장소에서 자주 쓰는 위치

| 위치 | 내용 |
|---|---|
| `docs/planning/` | 기획 기준 문서 3종 |
| `docs/governance/document-impact-map.csv` | DEC 변경 시 영향 문서·절 매핑 |
| `docs/team-rules.md` | 커밋·브랜치·라이선스 기록 규칙 |
| `schema/tables/` | 콘텐츠 CSV 31종의 필드·자료형·참조 정의 |
| `schema/schema_manifest.json` | `schema_version` 등 3종 버전의 단일 원본 |
| `data/drafts/` → `data/candidates/` → `data/approved/` | 콘텐츠 CSV 승인 흐름 |
| `generated/runtime/` | 승인 CSV에서 자동 생성한 런타임 JSON |
| `src/` `tools/` `api/` | 게임 코드, 검증·생성 도구, 서버리스 함수 |

저장소 전체 구조와 각 폴더의 역할은 `README.md`에 정리돼 있다.

## 쓰기 금지 경로

- `data/approved/` — 담당자만 승인·이동한다.
- `generated/runtime/` — 자동 생성물이며 `npm run data:build`로만 갱신한다.

## 검증 명령

변경 후 관련 검증을 실행하고, 실행하지 못한 검증과 남은 위험을 함께 보고한다.

```bash
npm run data:validate   # 승인 CSV 전체 검증
npm run docs:check      # 기획 문서 구조 자동 검수
npm run test            # 판정 알고리즘 단위 테스트
```
