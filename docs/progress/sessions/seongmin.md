# 작업 로그 — 전성민 (기획)

**Git 커밋에 남지 않는 것만 적는다.** 무엇을 바꿨는지는 `PROGRESS.md`와 diff에 이미 있다.

작성 형식 (해당 없으면 생략):

```
## YYYY-MM-DD 제목

**한 일** — 한두 줄

**왜 이렇게 했나** — 어떤 대안을 검토했고 왜 접었나

**AI가 잘못한 것** — 무엇을 어떻게 잡았나

**막힌 것** — 결정로그에 답이 없는 것. 기획 책임자에게 올릴 목록
```

`AI가 잘못한 것`과 `막힌 것`이 제일 중요하다. 8/8 제출 자료의
「AI 활용 기술 문서」와 「팀원 롤 기술서」를 쓸 때 이 기록이 그대로 재료가 된다.
일주일 뒤에 기억으로 복원하려 하면 대부분 잃어버린다.

직접 타이핑하지 않아도 된다. 작업이 끝날 때 AI에게 "오늘 작업 세션 로그에 정리해줘"라고
요청하면 이 형식으로 정리해준다. 내용만 확인하고 커밋한다.

이 파일은 개인 전용이라 다른 사람과 충돌하지 않는다.

---

## 2026-08-01 플레이어 일지 LLM 시스템 도입 + 전체 문서 동기화

**한 일** — 기획 3종 문서·`data/approved/` 상태를 AI와 함께 확인한 뒤, 「플레이어 일지 LLM 시스템」 제안서를 검토해 채택. 결정 로그에 `DEC-JOURNAL-001~004`(확정)·`DEC-UI-028`(보류) 신설, 이와 충돌하는 기존 확정 DEC 3건(`DEC-PIPELINE-015`, `DEC-RESIDENT-001`, `DEC-PIPELINE-014`)을 폐기하고 각각 `DEC-PIPELINE-018`·`DEC-RESIDENT-054`·`DEC-PIPELINE-019`로 대체. `AGENTS.md`, 시스템·UIUX 기획서, 콘텐츠 데이터 준비도 점검, `document-impact-map.csv`, `schema/schema_manifest.json`, `schema/tables/journal_fallbacks.json`, `README.md`, `CLAUDE.md`, 제출용 AI 활용 기술 문서까지 한 번에 동기화. `npm run docs:check`·`npm test` 통과 확인.

**왜 이렇게 했나** — 제안서 자체의 영향 범위 분석(5절)이 시스템 기획서 문구 조정만 언급하고, 정작 최상위 규칙인 `AGENTS.md` 1절("런타임 LLM은 엔딩 기록문 생성에만")과 그걸 그대로 담고 있는 확정 `DEC-PIPELINE-015`·`DEC-RESIDENT-001`은 빠뜨렸다. 확정 DEC는 의미가 바뀌면 원문을 보존한 채 폐기 후 새 숫자 ID로 대체해야 해서(`AGENTS.md` 5절) 그 절차를 그대로 밟았다. `DEC-PIPELINE-014`("CSV는 총 31개다")도 같은 이유로 낡아서 같은 방식으로 처리했다 — `DEC-PIPELINE-005`가 낡아서 `DEC-PIPELINE-014`로 대체됐던 것과 동일한 패턴.

**AI가 잘못한 것**
- 처음에 일지 UI 표시 항목을 `DEC-JOURNAL-005`(보류)로 만들었는데, 이 저장소는 UI 관련 보류 항목을 전부 `DEC-UI-*` 접두어로 통일 관리한다는 걸 놓쳤다. 내가 지적하자 AI가 `DEC-JOURNAL-005`를 로그에서 제거(한 번도 확정된 적 없는 보류라 ID 재사용 금지만 하고 삭제)하고 `DEC-UI-028`로 다시 만들었다.
- `journal_fallbacks.csv`라는 새 테이블을 추가하면서 `schema_manifest.json`의 `schema_version`을 올리는 걸 빠뜨렸다. `schema/README.md`에 명시된 절차인데도 처음엔 놓쳤고, 재확인 과정에서 AI가 스스로 찾아내 1→2로 올리고 `history`에 사유를 남겼다.
- 시스템 기획서·콘텐츠 가이드의 "CSV 31개"를 32개로 고치면서 정작 그 숫자의 근거인 확정 `DEC-PIPELINE-014` 원문은 그대로 둬서, 결정 로그(단일 원본)와 파생 문서가 서로 어긋나는 상태를 만들었다. "모든 문서를 안 읽고 고쳐서 생긴 충돌이 있는지 검수해달라"고 요청하고 나서야 전체 재검토 중에 발견됐다.
- `README.md`, `CLAUDE.md`, `schema/README.md`, 제출용 AI 활용 기술 문서에 "CSV 31종" 표기가 `docs/planning` 밖에도 남아 있었다. `docs:check` 도구가 "31개"라는 정확한 문자열만 하드코딩해서 검사하기 때문에 이런 것도, 다른 위치의 표기도 못 잡는다 — 저장소 전체 grep으로 직접 찾아야 했다.

**막힌 것** — 기획 책임자(나)에게 올릴 목록이 아니라, 김민주·최수정에게 넘겨야 할 확인 사항으로 정리함 (별도 메시지로 전달 예정):
- `resident_combat_profiles.csv` 등 주민 관련 CSV 5개가 `data/approved/`에 있는데 `content_status`는 `draft` — 김민주가 최종 검증 예정이라 확인했지만, 그 외에 ID 접두어 불일치(`resident_personality_profiles.csv`, `resident_support_attack_profiles.csv`), `resident_combat_modifiers.csv`의 위축/일반/격앙 보정 누락, `wildlife.csv`의 스키마 외 열, `resident_combat_profiles.csv`의 한글 인코딩 손상은 승인 여부와 무관한 실제 버그.
- `reward_bundle_entries.csv`의 `currency.money` 참조를 검증기가 못 찾는 게 데이터 문제인지 검증기 문제인지 미확인.
- 커밋 `e4f7d49`는 "1~9·11~12단계"라고 되어 있지만 실제로는 1~9단계 파일만 있음 — 11~12단계 진행 상황 확인 필요.
- `tools/validate.mjs`·`tools/check-docs.mjs`에 CSV 개수 "31개"가 하드코딩돼 있어 `DEC-PIPELINE-019`(32개)에 맞춰 갱신 필요. `check-docs.mjs`는 숫자를 정규식으로 뽑아 비교하는 범용 방식으로 바꾸는 게 낫다는 제안까지 최수정에게 전달.
