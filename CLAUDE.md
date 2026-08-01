@AGENTS.md
@docs/team-rules.md

# Claude Code 연결 규칙

`AGENTS.md`를 이 프로젝트의 단일 AI 작업 규칙으로 사용한다. 이 파일에 같은 규칙을 복제하거나 다시 정의하지 않는다.

콘텐츠·레벨 작업을 시작할 때는 `AGENTS.md`를 적용한 뒤 다음 세 문서를 함께 읽는다.

- `docs/planning/밭두렁난투_기획_결정로그_현재본.md`
- `docs/planning/밭두렁난투_시스템_UIUX_기획서_현재본.md`
- `docs/planning/밭두렁난투_콘텐츠_데이터_준비도_점검.md`

UI/UX 기획 작업(`DEC-UI-*` 확정)을 시작할 때는 위 첫 두 문서에 다음을 더해 함께 읽는다.

- `docs/planning/밭두렁난투_UIUX_준비도_점검.md`

## 작업을 마칠 때

작업 단락이 끝나면 **묻지 말고** `docs/progress/sessions/<본인>.md`에 항목을 추가한다.
형식은 그 파일 맨 위에 있다. 커밋에 남는 "무엇을"이 아니라 **"왜 그렇게 했나",
"AI가 뭘 잘못했나", "결정로그에서 막힌 것"** 을 쓴다.

빠뜨리기 쉬우므로 다음 중 하나라도 해당하면 반드시 쓴다.

- 커밋을 하나 이상 만들었다
- 설계 판단을 내렸거나 대안을 검토했다 접었다
- 스스로 잘못한 것을 발견하고 고쳤다
- 결정로그에 답이 없는 항목을 만났다

## 저장소 위치 안내

규칙이 아니라 파일이 어디 있는지에 대한 안내다.

| 위치 | 내용 |
|---|---|
| `docs/planning/` | 기획 기준 문서 4종 |
| `docs/governance/document-impact-map.csv` | DEC 변경 시 영향 문서·절 매핑 |
| `docs/team-rules.md` | 커밋·브랜치·라이선스 기록 규칙 |
| `schema/tables/` | 콘텐츠 CSV 33종의 필드·자료형·참조 정의 |
| `schema/schema_manifest.json` | `schema_version` 등 3종 버전 |
| `data/drafts/` `data/candidates/` `data/approved/` | 콘텐츠 CSV |
| `generated/runtime/` | 승인 CSV에서 생성한 런타임 JSON |
| `src/` `tools/` `api/` | 게임 코드, 검증·생성 도구, 서버리스 함수 |

저장소 전체 구조는 `README.md`에 있다.

## 명령

```bash
npm run data:validate   # 승인 CSV 검증
npm run data:build      # 승인 CSV → 런타임 JSON 생성
npm run docs:check      # 기획 문서 구조 자동 검수
npm run test            # 단위 테스트
```
