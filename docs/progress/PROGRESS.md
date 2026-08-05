# 작업 진행 기록

> **이 파일은 자동 생성된다. 직접 수정하지 않는다.**
>
> ```bash
> npm run progress
> ```
>
> Git 커밋 이력에서 만든다. 커밋 메시지에 담기 어려운 맥락은
> `docs/progress/sessions/<본인>.md` 에 남긴다.

커밋 226개 · 2026-07-31 ~ 2026-08-06

## 담당자별 요약

| 담당자 | 커밋 | 주요 태그 | 작업한 영역 |
|---|---|---|---|
| SUJEONG CHOI | 133 | Docs 42 · Feat 35 · Fix 30 · Chore 13 · (태그 없음) 9 · Refactor 2 · Test 1 · Art 1 | (루트), .github, api, assets, data/approved, data/candidates, data/drafts, docs, docs/governance, docs/planning, docs/progress, docs/submission, generated, public, schema, src, tests, tools |
| gamome44 | 45 | Docs 37 · (태그 없음) 7 · Art 1 | (루트), assets, docs/governance, docs/planning, docs/progress, docs/submission, schema, src |
| ming9 | 33 | Data 15 · Feat 7 · Docs 6 · (태그 없음) 4 · Fix 1 | data/approved, data/drafts, docs/progress, src, tests |
| github-actions[bot] | 15 | Docs 15 | docs/progress |

## 날짜별 기록

### 2026-08-06

- `[Docs]` 8번 세션 로그 — 카탈로그를 안 만든 이유와 놓칠 뻔한 것 둘 — SUJEONG CHOI · `09147f3`
- `[Feat]` hud.ts 를 A1 배치로 다시 짜고 raid_notices 를 배선한다 — SUJEONG CHOI · `e9859d9`
- `[Docs]` 튜토리얼 순서가 확정 DEC 둘과 어긋난다 — 전성민 판단으로 올린다 — SUJEONG CHOI · `92d0e1e`
- Merge branch 'develop' of https://github.com/xuxeong/batdureong-nantu into develop — gamome44 · `c11dcaa`
- `[Feat]` 영입 주민 지원 공격 — 조우 결과가 더는 거짓말하지 않는다 — SUJEONG CHOI · `9ff89dc`
- `[Fix]` 지원 공격 표시가 0.1초라 보고 있어도 놓쳤다 — SUJEONG CHOI · `cb3a14c`
- `[Docs]` DEC-UI-015·DEC-CONTENT-023 폐기 — 튜토리얼 순서 규칙을 데이터로 넘긴다 — gamome44 · `b7042dd`
- `[Fix]` 맵 경계 제한이 셋 다 없었다 — 플레이어가 화면 밖으로 걸어 나갔다 — SUJEONG CHOI · `b6bdda1`
- `[Fix]` 지원 기회 소비 표시가 조우 상대를 읽고 있었다 — 죽은 코드였다 — SUJEONG CHOI · `1597662`
- `[Feat]` 일시정지 화면 — 계속하기·조작 안내·타이틀로(확인 절차) — SUJEONG CHOI · `3c7ddd8`
- Merge branch 'develop' of https://github.com/xuxeong/batdureong-nantu into develop — SUJEONG CHOI · `a8c1673`
- `[Chore]` DEC-UI-030·DEC-CONTENT-025 반영 + 같은 stage 연속 검증 규칙 신설 — SUJEONG CHOI · `7c91f3f`
- `[Fix]` 재배 게이지 홈을 613 으로 잘못 읽었다 — 실제로는 789 다 — SUJEONG CHOI · `39eac6e`
- `[Fix]` 게이지 홈은 595 다 — 앞 커밋의 789 는 글자 가장자리를 센 값이었다 — SUJEONG CHOI · `5a37595`
- `[Feat]` 로딩·데이터 오류 화면 — data.error 가 8/2부터 콘솔로만 나갔다 — SUJEONG CHOI · `2b51353`
- `[Feat]` 튜토리얼 — 안내를 필드 위로 옮기고 조작으로 넘어가게 한다 — SUJEONG CHOI · `2851a22`
- `[Docs]` 튜토리얼 P0 둘과 김민주 인계 — 4-2 절 신설 — SUJEONG CHOI · `334cac0`
- `[Docs]` 캡처 3장 재촬영 — 8·9번 뒤의 확정 배치다 — SUJEONG CHOI · `d5890dd`
- `[Docs]` 4-2 인계 날짜 정정 + 남은 작업 표 — SUJEONG CHOI · `d04ecdd`
- Merge branch 'develop' — v0.2 아트 적용 빌드 — SUJEONG CHOI · `f7f62dc`
- Merge branch 'main' of https://github.com/xuxeong/batdureong-nantu — SUJEONG CHOI · `5c17462`

### 2026-08-05

- `[Docs]` 준비도 6절에 fear_increments.csv 가 두 번 적혀 있던 것 — SUJEONG CHOI · `6664e3a`
- `[Fix]` 조우가 끝나도 흐름이 습격 단계에 머물던 것 — SUJEONG CHOI · `acbab96`
- `[Docs]` A1 목업 프롬프트에서 내가 지어낸 HUD 위치를 걷어냈다 — gamome44 · `dbd6d9d`
- `[Feat]` 엔딩 기록문·일지 LLM 연결과 프롬프트 원본 2종 — SUJEONG CHOI · `68f168c`
- `[Docs]` 11절 점검 갱신과 8/5 새벽 세션 기록 — SUJEONG CHOI · `c45bb51`
- `[Docs]` 목업을 4장으로 늘리고 A1~A4 위치를 전부 공란으로 — gamome44 · `29bf942`
- `[Fix]` 배포에서 /api/ending 이 500 을 돌려주던 것 — 프롬프트 원본이 번들에 없었다 — SUJEONG CHOI · `da25390`
- `[Fix]` api/ 두 개가 배포에서 FUNCTION_INVOCATION_FAILED 로 죽던 것 — SUJEONG CHOI · `139ec06`
- `[Fix]` edge 번들러가 api/ 의 .ts import 를 못 읽어 배포가 실패하던 것 — SUJEONG CHOI · `079b62c`
- `[Docs]` A1 목업 배치 확정과 수풀 테두리, 미결정 항목 기록 — gamome44 · `2c7a8a0`
- `[Fix]` SDK 가 edge 번들에 node:fs 를 끌고 들어와 배포가 실패하던 것 — SUJEONG CHOI · `d3f208d`
- `[Docs]` 8/5 마무리 — 11절 점검 갱신과 배포 디버깅 기록 — SUJEONG CHOI · `a0f2e5a`
- `[Docs]` 4절 8/4 항목 체크와 8/5 이월 정리 — SUJEONG CHOI · `e70ddf6`
- `[Docs]` 8/4 미완 항목을 8/3 형식대로 취소선·이월 표기로 정리 — SUJEONG CHOI · `4db4d72`
- `[Docs]` 8/5 마무리 세션 기록 — 네 번 되짚은 이유 — SUJEONG CHOI · `a1ef995`
- `[Data]` 이월된 콘텐츠 4종 작성, 전투 보정 표시 이름 정리 — ming9 · `73e8968`
- `[Data]` 콘텐츠 4종 승인 — 36종 — ming9 · `a42b9f9`
- `[Feat]` 정비 허브 — 재배 종료 뒤 흐름이 멈춰 있던 지점 (DEC-UI-020) — ming9 · `64d0331`
- `[Feat]` 정비 허브 — 재배 종료 뒤 흐름이 멈춰 있던 지점 (DEC-UI-020) — ming9 · `4a0a980`
- `[Docs]` 8/4 이월분 중 정비 허브·콘텐츠 4종 완료 반영 — ming9 · `ef87abc`
- `[Feat]` raid_notices·night_result_texts 런타임 타입 추가 — ming9 · `060f85b`
- `[Feat]` 결과 화면 2종 — 조우 결과·밤 결과 (DEC-UI-011, DEC-UI-013, DEC-UI-023) — ming9 · `204c44a`
- `[Fix]` 재배 제한시간이 2일차부터 다시 시작하지 않던 것 (DEC-RUN-004) — ming9 · `99d1d2f`
- `[Feat]` 정비·대화 UI 5종 — ming9 · `84426ae`
- `[Docs]` ~8/4 UI 완료 반영과 세션 기록 — ming9 · `d4ab5fc`
- `[Docs]` 8/4 이월분 UI 완료 반영 — ming9 · `ca2284a`
- `[Docs]` 시트로 묶는 규칙과 파일 이름 규칙 신설 — gamome44 · `0d835d2`
- Merge branch 'develop' of https://github.com/xuxeong/batdureong-nantu into develop — gamome44 · `04e4528`
- `[Docs]` 게이지 색을 4.1 판정 색 규약의 예외로 둔다 — gamome44 · `c1cf788`
- `[Docs]` DEC-CONTENT-018 확정, DEC-CONTENT-024·DEC-UI-029 신설 — gamome44 · `d3c147c`
- `[Docs]` A1 산출물 검수 — 배경 두 겹을 한 장으로, 경작지 간격 조정 — gamome44 · `53b8c1c`
- `[Docs]` 로드맵 체크 표시가 저장소 상태와 어긋난 다섯 줄 — SUJEONG CHOI · `ae3f64c`
- `[Art]` A1 확정 에셋 19종과 원본 시트, 제작 기록 3종 — gamome44 · `2a1f036`
- `[Docs]` 행동 안내는 에셋 없이 글자만 띄운다 — gamome44 · `d72bbed`
- Merge remote-tracking branch 'origin/develop' into develop — SUJEONG CHOI · `37e385e`
- `[Docs]` 김민주 코드 작업 이관과 8/5 오후 결정 반영 — SUJEONG CHOI · `b83e19c`
- `[Docs]` A3·A4 목업이 기다리던 구현 화면 캡처 3장 — SUJEONG CHOI · `75c1b3d`
- `[Docs]` 8·9번이 캡처를 낡게 만든다 — 재촬영을 11번으로 박는다 — SUJEONG CHOI · `8dea880`
- `[Feat]` 일차 시작 화면과 플레이어 일지 — 완주가 2일차로 넘어간다 — SUJEONG CHOI · `06cf802`
- `[Docs]` 이미 답이 나온 down 3행을 미결로 다시 올린 것을 되돌린다 — SUJEONG CHOI · `69212ba`
- `[Docs]` 폴백 일지 온기×유지가 습격일에 "조용했다"고 단정한다 — SUJEONG CHOI · `3364dbc`
- `[Feat]` 런 실패·엔딩 화면과 독립 화면에서 HUD 숨김 — SUJEONG CHOI · `72c897c`
- `[Docs]` __dev.goToDay() 가 syncRunDay() 에 덮인다 · 실행 순서에 빠진 검증 항목 — SUJEONG CHOI · `aa0c7f4`
- `[Refactor]` 개발 통로 넷 제거 — __dev 노출 자체를 없앤다 — SUJEONG CHOI · `23ae10a`
- `[Docs]` 3-1 승인 CSV 검증과 클라이언트 바인딩 — 안 읽히는 테이블은 하나 — SUJEONG CHOI · `469c60f`
- `[Feat]` 밤 결과 무작위 선택 · 대화 시작 대사의 사연 기록 — SUJEONG CHOI · `0f7e981`
- `[Fix]` 포커스를 잃어도 대화·정비 허브가 남는다 — 표시와 입력을 나눈다 — SUJEONG CHOI · `25bb33e`
- `[Fix]` 주민 투사체를 화면에 그린다 — SUJEONG CHOI · `772d84a`
- `[Fix]` 독립 화면에서 필드를 지운다 — SUJEONG CHOI · `9478e62`
- `[Docs]` 이장 밸런스 행을 뺀다 — SUJEONG CHOI · `6a54d5f`
- `[Feat]` 타이틀·이름 입력·튜토리얼 화면과 런 리셋 — 개발 통로가 사라졌다 — SUJEONG CHOI · `a9dab0b`
- `[Feat]` 회복 파우치 배선과 UI 에셋 ID 고정 목록 — SUJEONG CHOI · `b128767`
- `[Feat]` 회복 사용 게이지와 취소 힌트 · 개발 통로 API 제거 · RunPhase 정리 — SUJEONG CHOI · `0c5884c`
- `[Docs]` 6번 main 병합을 12번 제출 빌드 완주에 합친다 — SUJEONG CHOI · `730f5b1`
- `[Fix]` 회복 취소를 피해 이벤트 한 곳에서 듣는다 — SUJEONG CHOI · `155e4e6`
- `[Docs]` 엔딩 화면 시도 실패 — 3일차 만복에게서 죽었다 — SUJEONG CHOI · `4d6dddc`
- `[Fix]` 회복 퀵메뉴 롱프레스가 게임을 멈춘 채 빈 화면을 만들었다 — SUJEONG CHOI · `cb0d788`
- `[Docs]` A1 에셋 실측과 전성민 캡처 회신을 8번에 반영한다 — SUJEONG CHOI · `f5e5ffc`
- `[Docs]` A3·A4 목업 프롬프트를 구현 캡처와 새 대화 배치로 다시 씀 — gamome44 · `3bc1c2d`
- Merge branch 'develop' of https://github.com/xuxeong/batdureong-nantu into develop — gamome44 · `0f2f9bd`
- `[Feat]` 기준 해상도 무대와 회복 퀵메뉴 — SUJEONG CHOI · `e7bb94e`
- Merge branch 'develop' of https://github.com/xuxeong/batdureong-nantu into develop — SUJEONG CHOI · `30d55ce`
- `[Chore]` content_assets 부모 후보에 player_base_stats 를 더한다 — SUJEONG CHOI · `cc85015`
- `[Docs]` 완주 2경로 확인 — 엔딩까지 닿았다 — SUJEONG CHOI · `6200868`
- `[Fix]` 12fps 를 60fps 로 — 캔버스 백킹과 1픽셀 격자 — SUJEONG CHOI · `2aced98`
- `[Fix]` 배경이 화면 일부만 덮였다 — 백킹과 좌표계를 섞었다 — SUJEONG CHOI · `7c4e08e`
- `[Docs]` 게이지는 한 장 · 적대 체력 게이지는 회전 재사용 · 스프라이트 키움 — gamome44 · `effedf2`
- `[Fix]` 회복 퀵메뉴가 열리자마자 같은 틱에 닫혔다 — SUJEONG CHOI · `64aac81`
- `[Docs]` 8/5 밤 인계 절을 로드맵에 넣는다 — SUJEONG CHOI · `9d9f6dd`
- `[Docs]` 12번 병합을 8번보다 먼저 — 합친 전제가 깨졌다 — SUJEONG CHOI · `b4b93f5`
- Merge develop into main — v0.1-build1 (1차 빌드) — SUJEONG CHOI · `87d7558`
- `[Docs]` PROGRESS.md 갱신 [skip ci] — github-actions[bot] · `0f843d3`
- `[Docs]` 12번 완료 — main 을 v0.1-build1 로 태그했다 — SUJEONG CHOI · `1ee5170`
- `[Data]` CSV 5건 — 경작지 좌표·튜토리얼·에셋 연결·밤 결과·토란 전환 — ming9 · `65f132e`
- `[Docs]` CSV 5건 세션 기록 — ming9 · `ca81ebe`
- Merge branch 'develop' of https://github.com/xuxeong/batdureong-nantu into develop — ming9 · `d56c759`
- `[Docs]` 김민주 CSV 네 건 도착을 로드맵에 반영 — 8번 전제와 10번이 바뀐다 — SUJEONG CHOI · `e5051ae`
- `[Feat]` types.ts 에 tutorial_steps 와 콘텐츠 에셋 중첩을 넣는다 — SUJEONG CHOI · `8c570ed`
- `[Feat]` A1 에셋 3층 렌더 — 배경 · 경작지/작물 · 수풀 앞 겹 — SUJEONG CHOI · `42922df`

### 2026-08-04

- `[Fix]` 프리뷰 URL 배포에 런타임 데이터가 없던 것, DEC-UI-018 표시 2건 누락 — SUJEONG CHOI · `588f739`
- `[Feat]` 습격 모드 배선, 개발 통로 2종, DEC-UI-026 구현 — SUJEONG CHOI · `debcf0f`
- `[Fix]` 퀵슬롯 선택·휠 순환·소진 자동 전환이 배선되지 않았던 것 — SUJEONG CHOI · `fe7f671`
- `[Fix]` 체력 0에도 계속 움직이던 것, 전투 이벤트 개발 로그 — SUJEONG CHOI · `e415026`
- `[Fix]` 습격에서 낫·투척이 주민을 못 때리던 것 — SUJEONG CHOI · `b6377be`
- `[Docs]` 8/3~8/4 밤 작업 마무리 — 11절 점검 갱신 — SUJEONG CHOI · `061be3c`
- `[Docs]` 소진 자동 전환 플레이 확인 반영 — SUJEONG CHOI · `93b3bca`
- `[Fix]` 재배 남은 시간이 캔버스와 HUD 에 두 번 그려지던 것 — SUJEONG CHOI · `2b2f9c6`
- `[Docs]` DEC-ART-001 확정 — 아트 리소스 규격과 제작 파이프라인 — gamome44 · `42d75ed`
- `[Docs]` DEC-CONTENT-023 확정 — 튜토리얼 안내 문구 데이터 구조 — gamome44 · `3cc65d9`
- Merge remote-tracking branch 'origin/develop' into develop — gamome44 · `2267637`
- `[Docs]` AGENTS.md 5.3절에 확정 DEC의 코드 주석 점검 항목 추가 — gamome44 · `b571ac4`
- `[Test]` docs:check 통과 기준을 "문제 없음" 에서 "차단 0" 으로 — SUJEONG CHOI · `d88b061`
- `[Feat]` tutorial_steps·content_assets 스키마 신설, schema_version 4→5 — SUJEONG CHOI · `c489ab9`
- `[Art]` assets/final 하위를 구간 이름으로 정리하고 assets/source 신설 — SUJEONG CHOI · `bee292a`
- `[Docs]` camera.ts 가 확정된 DEC-ART-001 을 보류로 적고 있던 것 — SUJEONG CHOI · `e410c8f`
- `[Docs]` 8/4 스키마 작업 세션 기록 — SUJEONG CHOI · `8a0f92f`
- `[Feat]` 조우 해결 — 최종 결과·관계·공포도·보상을 원자적으로 — SUJEONG CHOI · `bf5d9d4`
- `[Fix]` 체력 0인 플레이어가 습격에서 계속 싸울 수 있던 것 — SUJEONG CHOI · `8ed7432`
- `[Feat]` 투항 선택 개발 통로 — 영입·퇴각·거부를 플레이로 확인할 수 있게 — SUJEONG CHOI · `ab8237e`
- `[Fix]` 투항 개발 통로가 항상 "대화가 열려 있지 않다" 로 막히던 것 — SUJEONG CHOI · `c82a9ac`
- `[Fix]` 낫으로 주민을 죽이면 조우가 끝나지 않던 것 — SUJEONG CHOI · `771a31d`
- `[Docs]` DEC-RESIDENT-048 확정 — 공포도 증가량 1/3/6과 fear_increments.csv 신설 — gamome44 · `1629fe7`
- `[Docs]` 아트 디렉션 문서 신설과 작업 로그 갱신 — gamome44 · `232e7bc`
- `[Docs]` 조우 해결 세션 기록 — 같은 실수를 형태만 바꿔 반복한 것 — SUJEONG CHOI · `9285b55`
- Merge branch 'develop' of https://github.com/xuxeong/batdureong-nantu into develop — gamome44 · `6b36e2e`
- `[Feat]` 엔딩 판정 — 공포도 구간·조건·우선순위·대표 작물 — SUJEONG CHOI · `a530e1b`
- `[Docs]` 작업 로그 정정 — schema_version 지적이 내 pull 누락이었다 — gamome44 · `82d67d9`
- Merge branch 'develop' of https://github.com/xuxeong/batdureong-nantu into develop — SUJEONG CHOI · `3d883c0`
- `[Docs]` 아트 디렉션 12.2 신설 — A단계 목업 프롬프트가 문서에 없었다 — gamome44 · `75b2a1f`
- `[Feat]` fear_increments 스키마 신설, schema_version 5→6 (DEC-RESIDENT-048) — SUJEONG CHOI · `b1e02b2`

### 2026-08-03

- `[Docs]` DEC-UI-022 확정 — 일시정지·포커스 이탈 — gamome44 · `595f511`
- `[Docs]` DEC-UI-004·018 확정, DEC-CONTENT-020 신설 — 재배 화면 피드백 — gamome44 · `9fbaf50`
- `[Docs]` DEC-UI-006 확정 — 제작 정보와 레시피 해금 진행도 — gamome44 · `98b8bb2`
- `[Docs]` DEC-UI-020·021 확정 — 정비 허브, 보관함·퀵슬롯 편성 — gamome44 · `db95ec3`
- `[Docs]` DEC-RUN-011 확정, DEC-CONTENT-021 신설 — 습격 예고 — gamome44 · `8a36570`
- `[Docs]` 콘텐츠·밸런스 보류 DEC 12건 일괄 확정 — gamome44 · `96ddf73`
- `[Docs]` 관계 상태 키·화면 문구 테이블 확정, DEC-PIPELINE-019 폐기 — gamome44 · `12f2d90`
- `[Docs]` DEC-UI-009·019·012 확정 — 습격 전투 화면 — gamome44 · `9046f02`
- `[Docs]` DEC-UI-007·008 확정 — 전투 전 대화 — gamome44 · `b2ede0e`
- `[Docs]` DEC-UI-010 확정 — 투항 대화 — gamome44 · `76e823f`
- `[Docs]` DEC-UI-011·013·023 확정 — 결과 화면 4종 — gamome44 · `43d5b61`
- `[Docs]` DEC-UI-026 확정 — 중첩 UI 우선순위와 입력 소유권 — gamome44 · `5fae252`
- `[Data]` fc92a7a 회귀 복구, 두식→영순 통일, player_base_stats 초안 추가 — ming9 · `cfea1b6`
- `[Data]` player_base_stats 초안 추가 — ming9 · `4e20bb2`
- `[Data]` 1~5단계 12종 승인 — 재배 구현 착수 조건 — ming9 · `24a7154`
- `[Feat]` 재배 파종·성장·수확 구현 (로드맵 8/2) — ming9 · `ccb97e3`
- `[Docs]` DEC-UI-025 확정 — 화면 크기와 입력 접근성 — gamome44 · `4a2d9af`
- `[Docs]` 8/2~8/3 세션 로그 — 인코딩 사고 복구, 재배 구현 — ming9 · `cd82134`
- Merge branch 'develop' of https://github.com/xuxeong/batdureong-nantu into develop — ming9 · `0072b3a`
- `[Data]` 작물 성장 시간 단축 — 테스트 회전 확보 — ming9 · `9debdc3`
- `[Data]` 1~12단계 32종 승인 — 일차 흐름·조우·엔딩 데이터 개방 — ming9 · `9c3ebd8`
- `[Feat]` 판매·구매·제작과 작물 숙련도, 재배 제한시간·재배 화면 피드백·필드 HUD — ming9 · `ba086e2`
- `[Docs]` 8/3 세션 로그 — 재배 제한시간·경제·HUD — ming9 · `74a37d2`
- Merge remote-tracking branch 'origin/develop' into develop — gamome44 · `2b654be`
- `[Docs]` 8/3 세션 로그 — origin/develop 병합과 push 절차 누락 — gamome44 · `363afbc`
- `[Fix]` Esc 오버레이 규칙을 허용 목록으로 뒤집어 정비 허브 조기 종료 차단 — SUJEONG CHOI · `d39c41b`
- `[Feat]` 스키마 4판 — 화면 문구 두 테이블 신설, 관계 상태 6키 반영 — SUJEONG CHOI · `d4914ea`
- `[Docs]` 로드맵 8/2~8/3 진행 상태 갱신, 11절 점검 추가 — SUJEONG CHOI · `6dbb193`
- `[Docs]` 준비도 6절에 화면 문구 두 줄 추가, README 의 CSV 개수 표기 제거 — SUJEONG CHOI · `175e707`
- `[Feat]` farm.plotReady 이벤트 신설, 로드맵 9-1 을 고정 카메라로 정정 — SUJEONG CHOI · `38a90b5`
- `[Feat]` 전투 기반 — 낫·투척·투사체·전투 효과 (로드맵 8/2 이월) — SUJEONG CHOI · `9ac450b`
- `[Docs]` 이월 작업을 취소선 + 다음 날 항목으로 옮겨 적음 — SUJEONG CHOI · `df369c6`
- `[Docs]` DEC-UI-015·016·028·001·003·027 확정 — UI/UX 기획 완료 — gamome44 · `0f40f8b`
- `[Docs]` DEC-RESIDENT-010·018·035·038 확정 — 주민 콘텐츠 — gamome44 · `3196ee6`
- Merge remote-tracking branch 'origin/develop' into develop — gamome44 · `f13d21e`
- `[Feat]` 적대 주민 전투, HUD 가 캔버스 클릭을 가로채던 것 수정 — SUJEONG CHOI · `111cdd4`
- Merge branch 'develop' of https://github.com/xuxeong/batdureong-nantu into develop — SUJEONG CHOI · `69b3c99`
- `[Feat]` 조우 판정과 자원 협상 — 성격 프로필 조회, 결정적 무작위 차감 — SUJEONG CHOI · `3c24c84`
- `[Feat]` 야생동물 — 출현·목표 선택·먹기·공격 예고 (로드맵 8/2 이월 완료) — SUJEONG CHOI · `cbbc68c`
- `[Feat]` 낫·투척·야생동물을 필드에 배선, 야생동물 렌더 추가 — SUJEONG CHOI · `cc9f4f8`

### 2026-08-02

- `[Docs]` UI/UX 기획 착수(DEC-UI-014) + 플레이어 기본 수치 데이터 구조(DEC-CONTENT-019) 신설 — gamome44 · `6b89acd`
- `[Chore]` player_base_stats 검증 규칙 구현 및 세션 로그 갱신 — SUJEONG CHOI · `c5b0c18`
- `[Docs]` 1차 빌드 개발 계획 수립 (8/2~8/5) — SUJEONG CHOI · `6ab8b0f`
- `[Chore]` develop 브랜치 도입 + CI 검증 범위를 develop까지 확장 — SUJEONG CHOI · `0598bd7`
- `[Chore]` 배포 파이프라인 뚫기 — vercel.json + /api/health — SUJEONG CHOI · `54f4714`
- `[Feat]` 인터페이스 계약 — 런타임 데이터 타입 · 런 상태 타입 · 시스템↔UI 이벤트 — SUJEONG CHOI · `6f28470`
- `[Feat]` 고정 timestep 게임 루프와 3층위 화면 매니저 골격 — SUJEONG CHOI · `5ade5b1`
- `[Fix]` /api/health 무한 로딩 — Edge 런타임 선언 — SUJEONG CHOI · `97258fc`
- `[Feat]` 입력 계층과 캔버스 최소 루프 배선 — SUJEONG CHOI · `6ee036a`
- `[Fix]` 필드가 움직이지 않던 원인 두 건 — SUJEONG CHOI · `f3fdb16`
- `[Docs]` 로드맵 3-2 완료 표시와 11-1 상태 갱신 (10-2의 5번) — SUJEONG CHOI · `93573eb`
- `[Chore]` enums.json kind 목록에 player_base_stats 반영 — SUJEONG CHOI · `ac8bea3`
- `[Docs]` 7-2 분담 전제 정정 — 콘텐츠 CSV는 김민주가 계속 맡는다 — SUJEONG CHOI · `41d6a09`
- `[Docs]` UI/UX 1단계 계속 — DEC-UI-017/024 확정, DEC-INPUT-012 신설, 로드맵 기준 순서 재배치 — gamome44 · `de900ea`
- `[Data]` ID 접두어를 kind에 맞추고 문구·수치 정합 — ming9 · `817a7d1`
- `[Chore]` main 병합 — 기획 문서·콘텐츠 CSV 반영 — SUJEONG CHOI · `a1a331f`
- `[Refactor]` DEC-INPUT-012 반영 — onRecoverUse → onRecoverShortPress — SUJEONG CHOI · `c467dea`
- `[Data]` 10단계 사연·대화 완성 — ming9 · `08f5a02`
- `[Data]` 투항선 조정, 기타 수정사항 반영 — ming9 · `fc92a7a`

### 2026-08-01

- `[Chore]` CI에서 작업 기록 자동 갱신과 검증 실행 — SUJEONG CHOI · `2bb70d7`
- `[Chore]` CLAUDE.md에 세션 로그 작성 규칙 추가 — SUJEONG CHOI · `32d093a`
- `[Docs]` 8/1 세션 로그 추가 — SUJEONG CHOI · `0897d59`
- `[Docs]` 작업 시작 전 git pull 규칙 명시 — SUJEONG CHOI · `0be4577`
- `[Chore]` TypeScript 개발 환경 구성 및 진입점 main.ts 전환 — SUJEONG CHOI · `fde8300`
- Merge branch 'main' of https://github.com/xuxeong/batdureong-nantu — SUJEONG CHOI · `5a16c03`
- `[Docs]` PROGRESS.md 갱신 [skip ci] — github-actions[bot] · `063290c`
- `[Data]` 콘텐츠 1~9·11~12단계 승인분 일괄 반입 — 5일 런 기준 밸런스 확정 — ming9 · `e4f7d49`
- `[Docs]` PROGRESS.md 갱신 [skip ci] — github-actions[bot] · `4742c58`
- Update resident_combat_profiles.csv — ming9 · `9af21bf`
- `[Docs]` PROGRESS.md 갱신 [skip ci] — github-actions[bot] · `0e7ba2a`
- `[Data]` csv 파일들 drafts로 이동 — ming9 · `c8138f9`
- Merge branch 'main' of https://github.com/xuxeong/batdureong-nantu — ming9 · `f2db02f`
- `[Docs]` PROGRESS.md 갱신 [skip ci] — github-actions[bot] · `f675f43`
- `[Docs]` 플레이어 일지 LLM 시스템(DEC-JOURNAL) 도입 + 문서 전체 동기화 — gamome44 · `3ef9bb8`
- `[Docs]` PROGRESS.md 갱신 [skip ci] — github-actions[bot] · `ff268ed`
- `[Chore]` journal_fallbacks 검증 규칙 구현 및 검증 도구 하드코딩 개수 동적화 - journal_fallbacks.csv의 covers_all_bands_and_directions 검증 규칙 구현 및 parent_approved 적용 - checks.mjs에 currency.money 가짜 참조 오류 예외 처리 추가 - validate.mjs 및 check-docs.mjs 내 하드코딩된 CSV 개수 대조 로직을 동적으로 리팩토링 - 최수정 작업 세션 로그 갱신 — SUJEONG CHOI · `06ccff1`
- `[Docs]` PROGRESS.md 갱신 [skip ci] — github-actions[bot] · `ea67467`
- `[Data]` 11~12단계 누락된 CSV 추가 — ming9 · `27374a8`
- `[Data]` resident_combat_profiles.csv 깨짐 해결 — ming9 · `87efafd`
- `[Docs]` PROGRESS.md 갱신 [skip ci] — github-actions[bot] · `9b1256b`
- `[Docs]` PROGRESS.md 갱신 [skip ci] — github-actions[bot] · `426a81a`
- `[Docs]` PROGRESS.md 갱신 [skip ci] — github-actions[bot] · `a300721`
- `[Docs]` PROGRESS.md 갱신 [skip ci] — github-actions[bot] · `15e9c1f`
- `[Docs]` PROGRESS.md 갱신 [skip ci] — github-actions[bot] · `3858267`
- `[Docs]` PROGRESS.md 갱신 [skip ci] — github-actions[bot] · `ab694a9`

### 2026-07-31

- `[Chore]` 저장소 구조와 개발 환경 구축 — SUJEONG CHOI · `cde0188`
- `[Fix]` 기획 문서를 요약한 서술 제거 — SUJEONG CHOI · `843aa2a`
- `[Feat]` 콘텐츠 CSV 31종 스키마 정의 — SUJEONG CHOI · `a99a798`
- `[Feat]` CSV 파싱·검수 보고 모듈과 작업 기록 자동화 — SUJEONG CHOI · `27f9631`
- `[Docs]` PROGRESS 날짜별 형식 정리, 세션 로그 형식 추가 — SUJEONG CHOI · `eae4fc6`
- `[Feat]` 콘텐츠 CSV 검증 도구 — SUJEONG CHOI · `e26b6a9`
- `[Feat]` 정규화·런타임 생성·문서 검수 도구 — SUJEONG CHOI · `cf541d0`
- `[Chore]` CLAUDE.md에서 team-rules.md 임포트 — SUJEONG CHOI · `349bcac`
- `[Docs]` PROGRESS.md 갱신 [skip ci] — github-actions[bot] · `a541c74`
- `[Docs]` PROGRESS.md 갱신 [skip ci] — github-actions[bot] · `2e7d840`

