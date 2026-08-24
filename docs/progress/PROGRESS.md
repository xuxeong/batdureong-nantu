# 작업 진행 기록

> **이 파일은 자동 생성된다. 직접 수정하지 않는다.**
>
> ```bash
> npm run progress
> ```
>
> Git 커밋 이력에서 만든다. 커밋 메시지에 담기 어려운 맥락은
> `docs/progress/sessions/<본인>.md` 에 남긴다.

커밋 466개 · 2026-07-31 ~ 2026-08-10

## 담당자별 요약

| 담당자 | 커밋 | 주요 태그 | 작업한 영역 |
|---|---|---|---|
| SUJEONG CHOI | 228 | Feat 66 · Fix 65 · Docs 51 · Chore 20 · (태그 없음) 20 · Refactor 3 · Art 2 · Test 1 | (루트), .github, api, assets, data/approved, data/candidates, data/drafts, docs, docs/governance, docs/planning, docs/progress, docs/submission, generated, public, schema, src, tests, tools |
| ming9 | 105 | Feat 26 · Fix 25 · Data 22 · (태그 없음) 16 · Docs 13 · Chore 3 | assets, data/approved, data/drafts, docs/progress, schema, src, tests |
| gamome44 | 105 | Docs 72 · Art 18 · (태그 없음) 14 · Chore 1 | (루트), assets, docs/governance, docs/planning, docs/progress, docs/submission, schema, src |
| github-actions[bot] | 22 | Docs 22 | docs/progress |
| 전성민 | 6 | Art 2 · Docs 2 · (태그 없음) 2 | assets, docs/progress, docs/submission |

## 날짜별 기록

### 2026-08-10

- `[Fix]` 버튼 hover 를 밝기로 통일 — 그림 위에 회색 판이 얹히지 않게 — SUJEONG CHOI · `53882c0`
- `[Fix]` 회복 퀵메뉴에 제목을 넣고 여는 법을 알린다 — SUJEONG CHOI · `b0cbfec`
- `[Fix]` 회복 퀵메뉴에서 느림 문구를 뺀다 (담당자 판단) — SUJEONG CHOI · `efcb06d`
- `[Data]` 조우·대화 초상화를 전신으로 교체 + 엔딩 컷신 연결 6행 — ming9 · `71d4070`
- `[Feat]` 폴리싱 B 구획 — 제작 중복 삭제·해금 우측, 컷신·런실패 배경, 잔손질 4건 — ming9 · `1081bd5`
- `[Docs]` 세션 로그 — 폴리싱 B 8건, 구획 규칙 준수 확인 — ming9 · `0a62947`
- Merge branch 'develop' of https://github.com/xuxeong/batdureong-nantu into develop — ming9 · `89bfdb6`
- `[Fix]` 대사창 글자 여백 — 본문 38px 에 여백이 12px 였다 — SUJEONG CHOI · `d2740c9`
- `[Art]` 2차 QA 에셋 교체와 전신·커서 추가 — 전성민 · `b1bb77c`
- `[Feat]` 엔딩별 컷신을 화면에 넘긴다 (김민주 인계) — SUJEONG CHOI · `f06859a`
- `[Fix]` 대사창 나무 테두리를 얇게, 발화자 이름을 크게 — SUJEONG CHOI · `bb70f96`
- `[Fix]` 줄바꿈을 어절 단위로 — body 에 word-break: keep-all — SUJEONG CHOI · `d69ec0e`
- `[Chore]` 전신 초상화 역할과 클릭 긁힘 ID 등록 (schema_version 19→20) — SUJEONG CHOI · `c5a9773`
- `[Fix]` 농장 일지 좌우 여백을 150 으로 대칭 — 오른쪽도 종이 끝에 붙어 보였다 (8/10) — ming9 · `61d9f9b`
- `[Feat]` 나무판을 누르면 긁힘 자국이 박힌다 — SUJEONG CHOI · `d5ed198`
- `[Fix]` 회복 칸 hover 안내를 뗀다 — 퀵메뉴가 같은 말을 한다 — SUJEONG CHOI · `db89a45`
- `[Feat]` 족자가 위에서 말려 내려온다 · 커서를 1.4x 배율로 축소 — ming9 · `fbd09d1`
- `[Fix]` 툴팁이 커서에서 400px 떨어지고 화면 밖에서 잘리던 것 — SUJEONG CHOI · `07d3a08`
- `[Feat]` 조우 결과 카드를 전신 초상화로 (김민주 인계) — SUJEONG CHOI · `51466ab`
- `[Fix]` 족자가 반만 내려온다 — 아래 끝이 시작하기 팻말 위(890)에서 끊기고 그림은 아래 기준이라 위 196px 이 잘린다 (A5 목업) — ming9 · `72fbb68`
- `[Fix]` 조우 카드 인물을 목업 비율로 — 칸을 버튼 여백까지 내려 세우고 그림을 꽉 채운다 (63%→약 78%) — ming9 · `e7ee973`
- Merge branch 'develop' of https://github.com/xuxeong/batdureong-nantu into develop — ming9 · `fee8af0`
- `[Fix]` 체력 수치와 보관함 수량 배지를 그림 홈에 맞춘다 — SUJEONG CHOI · `b5d7ad8`
- `[Fix]` 회복 퀵메뉴·일시정지에서 재배 타이머가 사라지던 것 — SUJEONG CHOI · `8282840`
- `[Feat]` 족자가 펼쳐진다 — 축이 종이를 풀며 내려가고 글은 다 펴진 뒤 배어 나온다 · 족자 50px 왼쪽으로 — ming9 · `0424bfc`
- `[Fix]` 긴 대사를 25자 안팎에서 줄바꿈 — 영순 투항 대사의 '부모님 누워 계시고' 앞에서 접히는 폭(21em)으로 캘리브레이션 — ming9 · `7694821`
- `[Feat]` 조준선을 낫 판정 모양의 호로 (DEC-UI-031 폐기 → DEC-UI-038) — SUJEONG CHOI · `86dd4e1`
- `[Fix]` 줄바꿈을 문장 단위로 (대사창·퀵슬롯 확인 창) · 족자 펼침을 조각+종이 두 겹으로 — ming9 · `6fa5bc4`
- Merge branch 'develop' of https://github.com/xuxeong/batdureong-nantu into develop — ming9 · `aceb770`
- `[Fix]` 재배 타이머 채움을 각지게 — 홈 그림이 네모라 알약형 끝에서 네 귀가 비었다 — ming9 · `dc29a25`
- `[Docs]` 제출 자료 최신화 — 게임 소개·AI 활용·팀원 롤·크레딧 — 전성민 · `e611249`
- Merge branch 'develop' of https://github.com/xuxeong/batdureong-nantu into develop — ming9 · `2af9e84`
- `[Fix]` 줄 끝에 한 글자 낱말이 혼자 남는 것 — text-wrap: pretty — SUJEONG CHOI · `c5bda8f`
- Merge branch 'develop' into main (v0.5) — SUJEONG CHOI · `36bc189`
- `[Feat]` 엔딩을 A8 대자보 배치로 — 기록문이 대자보 흰 종이에 적힌다 — ming9 · `f677fa1`
- `[Fix]` 8/10 QA 6건 — 기본 음량 35% · 음량 표시 동기화 · 설정 클릭음·흔들림 · 보관함 수량 배지 분리 · 튜토리얼 종료 문구 — ming9 · `da60116`
- `[Docs]` 제출 자료 — AI 교차 검수 절 신설, 팀원 롤 개발 항목 보강 — SUJEONG CHOI · `2afe465`
- Merge branch 'develop' of https://github.com/xuxeong/batdureong-nantu into develop — SUJEONG CHOI · `e4dc202`
- `[Fix]` 8/10 QA 3건 — 타이틀 음량 판 한지화 · 체력바 축소 · 튜토리얼 잔존 버그 — ming9 · `b2a6080`
- `[Fix]` 설정 팻말이 첫 클릭 뒤 죽던 것 — 흔들림 클래스의 pointer-events: none 이 안 떼졌다. animationend 로 떼고 설정 팻말은 흔들리는 중에도 눌리게 한다 — ming9 · `37ad866`
- Merge branch 'develop' of https://github.com/xuxeong/batdureong-nantu into develop — ming9 · `83ab679`
- `[Feat]` 체력 위험 비네트 — 4분의 1 이하에서 화면 테두리가 붉게 숨쉰다. 그림 없이 안쪽 그림자 두 겹, HUD 글자보다 아래 겹 — ming9 · `c3e5b5c`
- `[Fix]` 8/10 QA — 튜토리얼 종료를 창호지 연출로 · 대사 장 넘김 · 대자보 정리 외 — ming9 · `3984873`
- `[Fix]` 체력 위험 비네트를 더 깊고 진하게 — 48/140px 두 겹이 잘 안 보였다 (70/220px, 투명도도 올림) — ming9 · `6d1ddf9`
- `[Fix]` 건너뛰고 시작을 한지 아이보리로 — 흰색에 가까워 밭 위에서 튀었다 — ming9 · `ff07993`
- [Asset] 난우수닭 팀 로고와 클릭 효과음 추가 — 전성민 · `396b1e8`
- Merge branch 'develop' of https://github.com/xuxeong/batdureong-nantu into develop — ming9 · `ee199c4`
- `[Docs]` 난우수닭 에셋 제작 정보와 폰트 출처 보강 — 전성민 · `9c192ae`
- `[Feat]` 조준선을 캐릭터 앞으로 · 타이틀 팀 크레딧 (schema_version 21) — ming9 · `1cfe488`
- `[Fix]` 팀 로고 울음소리 2배 — sfx.play 에 소리별 배율 추가 — ming9 · `4edbada`
- Merge branch 'develop' of https://github.com/xuxeong/batdureong-nantu into develop — ming9 · `c749bab`
- `[Fix]` 팀 크레딧 말풍선을 시안대로 — 꼬리를 닭에 붙이고 살짝 내림 — ming9 · `bc9b030`
- [Merge] develop → main — 8/10 폴리싱과 팀 크레딧, 제출 자료 최신화 — SUJEONG CHOI · `33a7030`
- `[Docs]` PROGRESS.md 갱신 [skip ci] — github-actions[bot] · `a6a3463`
- `[Fix]` 엔딩 기록문을 종이 위 끝으로 — 위 여백 제거, 잘림은 스크롤로 — ming9 · `2518f34`
- Merge branch 'develop' of https://github.com/xuxeong/batdureong-nantu into develop — ming9 · `3e38f36`
- `[Docs]` 제출 링크에 플레이 빌드 URL 기재 — SUJEONG CHOI · `66bf95a`
- [Merge] develop → main — 엔딩 기록문 위치 보정, 제출 링크 기재 — SUJEONG CHOI · `ba62043`
- `[Docs]` PROGRESS.md 갱신 [skip ci] — github-actions[bot] · `cd57b67`
- `[Art]` 이장 전신 초상화(village_head) 수정 — 전성민 · `e792fa8`
- Merge branch 'develop' of https://github.com/xuxeong/batdureong-nantu into develop — 전성민 · `eda740d`
- `[Feat]` 조준 호의 정면에 초록 점 — 투척 방향 표시 — ming9 · `16be555`
- Merge branch 'develop' of https://github.com/xuxeong/batdureong-nantu into develop — ming9 · `47d5476`
- `[Fix]` 조준 표식을 초록 점에서 호 밖 흐린 붉은 세모로 — ming9 · `514b109`
- [Merge] develop → main — 조준 표식과 이장 전신 초상화 — SUJEONG CHOI · `4f6b763`
- `[Docs]` PROGRESS.md 갱신 [skip ci] — github-actions[bot] · `c7b4bbd`
- `[Fix]` 엔딩·런 실패 직전에 초록 화면이 스쳤다 — SUJEONG CHOI · `cc9ecce`
- `[Fix]` 런 실패 문구·버튼이 컷신에 덮여 사라졌다 — SUJEONG CHOI · `9a2c516`
- `[Fix]` 엔딩 기록문이 대자보 종이 끝에 닿아 있었다 — SUJEONG CHOI · `6c1e0cd`
- `[Fix]` 엔딩 기록문 상자를 실제 분량(300자)에 맞춘다 — SUJEONG CHOI · `8a94ff7`
- `[Fix]` 습격 중에 심기·수확 안내와 대상 강조가 켜졌다 — SUJEONG CHOI · `86c2ddd`
- [Merge] develop → main — 엔딩·런 실패 화면 마감과 습격 중 재배 안내 정리 — SUJEONG CHOI · `6c94944`

### 2026-08-09

- `[Feat]` 새 SFX 5종 배선 — 일차 시작 예고 3 · 런 실패 · 엔딩 확정 (schema_version 12) — SUJEONG CHOI · `c4be008`
- `[Feat]` 대화 진행 방식 넷 (DEC-UI-025 폐기 → DEC-UI-035 대체) — SUJEONG CHOI · `07623c9`
- `[Art]` QA 반영 습격 예고 표지 3종 정리 — gamome44 · `6bce7ba`
- Merge remote-tracking branch 'origin/develop' into develop — gamome44 · `5fd588d`
- `[Fix]` 한지 판 나무 테두리를 얇게 — 44 → 28px — SUJEONG CHOI · `5fd4d25`
- `[Feat]` 대화 등장 연출 — 주민 → 플레이어 → 대사창 — SUJEONG CHOI · `ad21b78`
- `[Fix]` 대화 등장 연출이 너무 빨랐다 — 620 → 980ms · 대사창은 화면 아래에서 — SUJEONG CHOI · `e6cf01a`
- `[Fix]` 대화창이 오른쪽에서 올라왔다 왼쪽으로 미끄러졌다 — SUJEONG CHOI · `3fc2a67`
- `[Art]` QA 퀵슬롯 배지 및 습격 표지 보정 — gamome44 · `2fc97c9`
- `[Art]` 재배 타이머 문구 폰트 보정 — gamome44 · `34a5c29`
- `[Feat]` 지원 주민 공격 자세 · 만복 투척음 · 야생동물 먹는 소리 — SUJEONG CHOI · `5d1a683`
- `[Fix]` 챱 간격 · E 안내 위치 · 회복 칸 아이콘 · 조준선 레이어 — SUJEONG CHOI · `33e9cd6`
- Merge branch 'develop' of https://github.com/xuxeong/batdureong-nantu into develop — gamome44 · `a7f6cbe`
- `[Feat]` 퀵슬롯 배지 — 칸 위 번호판 · 오른쪽 아래 수량 · 회복 칸 수량 (A1 목업) — SUJEONG CHOI · `9822133`
- `[Refactor]` 빈 퀵슬롯 배지를 명시적으로 숨긴다 — SUJEONG CHOI · `042c167`
- Merge branch 'develop' of https://github.com/xuxeong/batdureong-nantu into develop — gamome44 · `815629f`
- `[Feat]` 퀵슬롯·회복 수량 배지를 실제 그림으로 (schema_version 13) — SUJEONG CHOI · `7becfbb`
- `[Feat]` 수확 가능 표식을 강조 틀로 · 경작지 아래 레이어로 (9·10번) — SUJEONG CHOI · `f3f314b`
- `[Feat]` 회복 사용 게이지를 에셋으로 — 플레이어 옆 세로 (8번) — SUJEONG CHOI · `4bba85d`
- `[Fix]` 일시정지하면 뒤 화면이 반투명해진다 (2번) — SUJEONG CHOI · `4d0ae8b`
- `[Fix]` 대화 중 일시정지가 대화창 아래에 깔린다 (2번 후속) — SUJEONG CHOI · `91c9e15`
- `[Feat]` 습격 예고 판을 목업 배치로 (16번, DEC-UI-036 대체) — SUJEONG CHOI · `41d6f06`
- `[Feat]` 엔딩 요약에 플레이어 이름 (22번) — SUJEONG CHOI · `22504e6`
- `[Art]` QA 목업 12종과 엽전 에셋 추가 — gamome44 · `099ee20`
- Merge branch 'develop' of https://github.com/xuxeong/batdureong-nantu into develop — gamome44 · `882b053`
- `[Feat]` 대사 순차 출력과 타자 소리 (21번, schema_version 14) — SUJEONG CHOI · `51085a1`
- `[Fix]` 회복 퀵메뉴를 회복 칸 바로 위로 (E) — SUJEONG CHOI · `40ed740`
- `[Data]` 8/6 에셋 연결분의 부모 content_version 반영 (DEC-PIPELINE-011) — ming9 · `c93a2cc`
- `[Data]` 미끈 토란 주머니를 제작 1회당 2개에서 1개로 (recipes v2 → v3) — ming9 · `e06274b`
- `[Chore]` 고정 목록에 asset.ui.coin 선등록 (schema_version 12 → 13) — ming9 · `b7b64ab`
- `[Feat]` 정비 화면을 A3 목업 v7 배치로 다시 짠다 — ming9 · `d831075`
- `[Feat]` 튜토리얼 8단계 재구성 — 낫을 맨 앞으로, 구매 창 열기 신설 (schema_version 16) — SUJEONG CHOI · `8119526`
- Merge branch 'develop' of https://github.com/xuxeong/batdureong-nantu into develop — ming9 · `21b6621`
- Merge branch 'develop' of https://github.com/xuxeong/batdureong-nantu into develop — ming9 · `ae633a3`
- `[Feat]` 퀵슬롯·회복 칸을 눌러 고르고 연다 (C·D, DEC-UI-001 폐기 → DEC-UI-037) — SUJEONG CHOI · `2b156ed`
- [Merge] develop → main — 8/8~8/9 아트·소리·폴리싱 반영 — SUJEONG CHOI · `5b296d5`
- `[Fix]` 튜토리얼 5단계 문구가 쉼표에서 잘렸다 — SUJEONG CHOI · `c3e407a`
- @ [Test] CSV 행 칸 수 검사 추가 — 값이 조용히 사라지는 것을 막는다 — SUJEONG CHOI · `e3a3d70`
- `[Art]` 본문 폰트 GriunXHangeul Equal 반입 — 라이선스상 TTF 원본 유지 — SUJEONG CHOI · `9ebeda5`
- `[Fix]` 일지·엔딩 기록문이 오기 전에 넘어가지지 않게 한다 — SUJEONG CHOI · `7dcecef`
- `[Art]` 엔딩 컷신 및 QA 수정 에셋 반영 — gamome44 · `4597012`
- `[Chore]` day_start_scroll·ending_record_board 등록 (schema_version 17→18) — ming9 · `09ab38a`
- `[Feat]` 하루의 전환 흐름 — 문·카드·정비 UI 슬라이딩 (8/9 플로우) — ming9 · `3e2c034`
- `[Docs]` 세션 로그 — 하루 전환 흐름, fade 를 걷어낸 이유 — ming9 · `3c1e9e5`
- `[Fix]` 조우 카드 — 초상화를 올리고 확인 버튼이 스크롤에 숨지 않게 — ming9 · `43e92d3`
- `[Feat]` 퀵슬롯 빈 상태 확인 창 — 습격 전 정비 종료에 한 번 묻는다 (작업 7번) — ming9 · `3ac233b`
- `[Docs]` 세션 로그 — 카드 마감·확인 창, DEC-UI-020 어긋남 보고 — ming9 · `9dc29d3`
- `[Fix]` 툴팁을 커서 오른쪽 아래로 · 회복 칸에 조작 안내 (작업 14번) — ming9 · `b7db4cd`
- `[Feat]` 타이틀 설정 팻말 + 음량 모듈 공용화 · 커서 선등록 (작업 3·15번) — ming9 · `ae05a5f`
- `[Fix]` 타이틀 팻말 두 장을 서로 반대로 살짝 기울인다 — rotate 속성이라 흔들림 연출과 겹쳐 돈다 — ming9 · `621c312`
- `[Fix]` 게임 시작 팻말은 반듯하게 되돌리고 설정만 5도 기울인다 — ming9 · `034969a`
- `[Fix]` 튜토리얼 정비도 판매 기본 · 튜토리얼→1일차 즉시 전환 · 투척 처치음 — ming9 · `b90c083`
- Merge branch 'develop' into main (v0.4) — SUJEONG CHOI · `5328b2a`
- `[Docs]` PROGRESS.md 갱신 [skip ci] — github-actions[bot] · `09e28a3`
- `[Fix]` 튜토리얼 판매 잠금 · 총액을 실행 버튼 위 바닥 묶음으로 · 물음 위치 — ming9 · `ee7b687`
- `[Docs]` PROGRESS.md 갱신 [skip ci] — github-actions[bot] · `7332b5b`

### 2026-08-08

- `[Feat]` 조준선 색을 갈색 외곽 + 한지색으로 — 캔버스가 layout.css 를 읽는다 — SUJEONG CHOI · `7fd8d74`
- Merge branch 'develop' of https://github.com/xuxeong/batdureong-nantu into develop — SUJEONG CHOI · `60e1187`
- `[Art]` A2 밤 습격 목업과 적 체력바 예외 반영 — gamome44 · `017b870`
- `[Feat]` 야생동물 진행 방향 회전 · DEC-ART-002 폐기 반영 (003) — SUJEONG CHOI · `3c22a29`
- Merge branch 'develop' of https://github.com/xuxeong/batdureong-nantu into develop — gamome44 · `42fbeee`
- `[Fix]` 야생동물 회전 보정 부호 — 머리가 진행 방향의 반대를 보고 있었다 — SUJEONG CHOI · `caaad81`
- Merge branch 'develop' of https://github.com/xuxeong/batdureong-nantu into develop — SUJEONG CHOI · `846fb14`
- `[Chore]` resident_hp_gauge 를 고정 목록에서 뺀다 — 적 체력바 기준 확정 반영 — SUJEONG CHOI · `721964b`
- `[Feat]` A4 대화 화면 초상화 2인 배치 · 튜토리얼 안내 위치 · 허브 팝업층 클릭 통과 — ming9 · `59b2de1`
- `[Data]` 초상화 5종 에셋 연결 · 부모 content_version 반영 — ming9 · `f51a18c`
- feat(art): add title screen and character pose assets — gamome44 · `1445732`
- `[Art]` BGM 6종·SFX 27종 최초 반입 (VARCO Sound) — gamome44 · `99bc78a`
- `[Docs]` 사운드 CREDITS 기록 + SOUND_ASSET_INDEX.md 신설 — gamome44 · `1c12dc2`
- `[Docs]` DEC-ART-003 폐기 → DEC-ART-004 대체 — SFX는 WAV, BGM은 MP3 — gamome44 · `0283d1d`
- `[Data]` 최종 아트에 맞춰 영순·만복 문구 정정 + 좌·우·공격 스프라이트 15행 연결 — ming9 · `a48a76c`
- `[Feat]` 타이틀 화면을 A0 목업 배치로 — 배경·로고·팻말과 진입 연출 — ming9 · `e2766f2`
- `[Docs]` 세션 로그 — pull 복구, 최종 아트 정합, 타이틀 A0, 막힌 것 4건 — ming9 · `b2f7614`
- `[Chore]` UI 고정 목록에 정비 화면 부품 11종 등록 (schema_version 8→9) — ming9 · `a425eda`
- `[Feat]` 정비·상점·제작·편성 화면에 A3 목업 아트를 붙인다 — ming9 · `0e573cc`
- `[Fix]` 상점 수량을 입력창에서 증감 버튼으로 — DEC-UI-025 마우스 전용 위반 — ming9 · `84d9fba`
- `[Chore]` tools/ 의 DEC-ART-003 인용을 004 로 — 검증 오류가 폐기된 DEC 를 근거로 댔다 — SUJEONG CHOI · `827bcce`
- `[Fix]` 초상화·UI 부품도 미리 받는다 — 늦게 뜨는 것과 창호지 순차 표시가 같은 원인 — SUJEONG CHOI · `bb4e714`
- `[Fix]` 튜토리얼 재배 표시가 1일차로 새어 나온다 — 리셋에서 버린다 — SUJEONG CHOI · `9fc01d3`
- `[Fix]` 퀵슬롯이 안 눌리던 이유 — 슬롯 이름이 팝업 전체로 펼쳐져 있었다 — SUJEONG CHOI · `1588488`
- `[Fix]` 튜토리얼 정비 — 종료 버튼을 숨기고 판매를 잠근다 — SUJEONG CHOI · `96eca51`
- `[Feat]` A4 대화 화면을 목업 배치로 — 인물·대사창·말풍선 — SUJEONG CHOI · `11e23b3`
- `[Feat]` 선택지를 목업대로 밑줄 글자로 · 발화자 이름판 · 걷기 계산 테스트 — SUJEONG CHOI · `dd6bada`
- `[Fix]` 타이틀 hover 회색 판 · 정비 선택 표시 셋 — SUJEONG CHOI · `810773e`
- `[Feat]` 효과음 재생과 sfx 7행 연결 — 나머지는 DEC-ART-005 대기 — SUJEONG CHOI · `ce3ec36`
- `[Docs]` 효과음 재생 확인 — 세션 로그의 "못 들었다" 를 바로잡는다 — SUJEONG CHOI · `4b5959b`
- `[Feat]` 배경음 재생 계층과 음량 세 갈래 — DEC-ART-005 와 무관한 부분 — SUJEONG CHOI · `9f3e443`
- `[Docs]` DEC-ART-005 적용분을 미리 확정 · CREDITS SFX 27종 구멍 — SUJEONG CHOI · `dc9a0e4`
- `[Art]` bg_title.png 색감 조정 — gamome44 · `fd56ee1`
- `[Docs]` DEC-UI-030 폐기 → DEC-UI-032 대체 — 타이틀에 설정(음량) 입력 추가 — gamome44 · `8c1a328`
- `[Docs]` DEC-ART-004 폐기 → DEC-ART-005 대체 — 고정 목록에 sfx·bgm 구간 추가 — gamome44 · `2126592`
- `[Art]` SFX 마지막 5종 반입 — day_start 3종·run_failed·ending_decided (SFX 32/32) — gamome44 · `be79b60`
- `[Feat]` 한지 판 공통 클래스 — CSS 로 뜨는 창 열 개에 적용 — SUJEONG CHOI · `b5e1d74`
- `[Fix]` 한지 판에서 별칭 토큰이 안 따라온다 — 일차 시작 습격 예고 문구 — SUJEONG CHOI · `a0172db`
- `[Feat]` 투척 퀵슬롯 5칸 → 4칸 (DEC-INPUT-013 외 3건 폐기·대체) — SUJEONG CHOI · `f366a35`
- `[Feat]` BGM 6종 연결과 낫 소리 3종 (DEC-ART-005, schema_version 10) — SUJEONG CHOI · `0a36b82`
- `[Feat]` 타이틀 BGM 누락 수정 · 효과음 18종 배선 (schema_version 11) — SUJEONG CHOI · `ea58268`
- `[Docs]` PROGRESS.md 갱신 [skip ci] — github-actions[bot] · `2b228c8`

### 2026-08-07

- `[Feat]` F·E·C 에셋을 화면에 붙인다 — 필드 스프라이트·투사체·아이콘 18종 — ming9 · `7120798`
- `[Docs]` 8/6 에셋 반영과 튜토리얼 P0 완료 기록 — ming9 · `ac7d841`
- `[Fix]` 대화창 글씨·초상화와 수확 거리 — 아트 반영 뒤 플레이 테스트에서 나온 셋 — ming9 · `b4c4ba2`
- `[Docs]` 디스코드에 흩어진 확정 8건을 회수 — UI 에셋 16장이 못 붙는 이유를 찾았다 — SUJEONG CHOI · `0559d14`
- `[Chore]` A4 대사창·버튼 에셋 ID 넷을 고정 목록에 등록한다 — SUJEONG CHOI · `85adac0`
- `[Feat]` 낫 휘두름 호 — 이펙트 넷 중 마지막 — SUJEONG CHOI · `9cb4231`
- `[Chore]` 없는 곳을 가리키는 주석 둘과 낡아 있던 P2 목록 — SUJEONG CHOI · `5a496d0`
- `[Art]` F-1 필드 스프라이트·투사체 실크기 리사이즈 — gamome44 · `b76b43a`
- `[Docs]` DEC-ART-001 폐기 → DEC-ART-002 대체 — 캐릭터 모션 예외 허용, 조준선 수정 — gamome44 · `d59dc31`
- `[Chore]` DEC-ART-002 일괄 치환에서 뜻이 뒤집힌 주석 하나와 남은 참조 셋 — SUJEONG CHOI · `49e5f61`
- `[Feat]` 걷기 bob — 정면 그림 한 장으로 걷게 한다 (DEC-ART-002) — SUJEONG CHOI · `aa77e8a`
- `[Feat]` 좌·우·공격 교체 스프라이트 배선 — 그림이 오면 행 추가만으로 켜진다 — SUJEONG CHOI · `3a94ce8`
- `[Feat]` 명중 충격선·피격 깜빡임·일시정지 중 조준선 정지 — SUJEONG CHOI · `ed5bf2e`
- `[Fix]` 튜토리얼 마지막 단계에서 던지는 것을 보고 넘어간다 — SUJEONG CHOI · `24b99df`
- `[Docs]` 8/7 밤 상태로 인계 문서 갱신 — 커밋 9개와 새 미결 셋 — SUJEONG CHOI · `d8b9b04`
- `[Fix]` 지원 주민 공격에도 명중 표시를 붙인다 — SUJEONG CHOI · `d7914ef`
- `[Fix]` 명중 충격선이 안 보이던 이유 둘 — 켜는 곳 누락과 그림 크기 — SUJEONG CHOI · `6b1c06e`
- `[Chore]` 화면 배경 9종과 타이틀 로고 ID 를 파일보다 먼저 등록한다 — SUJEONG CHOI · `42586d9`
- `[Art]` 대화 초상화 5종과 구현 인계 추가 — gamome44 · `c254475`
- `[Docs]` 조준선과 야생동물 방향 결정 반영 — gamome44 · `4eecfad`

### 2026-08-06

- `[Docs]` 8번 세션 로그 — 카탈로그를 안 만든 이유와 놓칠 뻔한 것 둘 — SUJEONG CHOI · `09147f3`
- `[Feat]` hud.ts 를 A1 배치로 다시 짜고 raid_notices 를 배선한다 — SUJEONG CHOI · `e9859d9`
- `[Docs]` 튜토리얼 순서가 확정 DEC 둘과 어긋난다 — 전성민 판단으로 올린다 — SUJEONG CHOI · `92d0e1e`
- Merge branch 'develop' of https://github.com/xuxeong/batdureong-nantu into develop — gamome44 · `c11dcaa`
- `[Feat]` 영입 주민 지원 공격 — 조우 결과가 더는 거짓말하지 않는다 — SUJEONG CHOI · `9ff89dc`
- `[Fix]` 지원 공격 표시가 0.1초라 보고 있어도 놓쳤다 — SUJEONG CHOI · `cb3a14c`
- `[Docs]` DEC-UI-015·DEC-CONTENT-023 폐기 — 튜토리얼 순서 규칙을 데이터로 넘긴다 — gamome44 · `b7042dd`
- `[Fix]` 맵 경계 제한이 셋 다 없었다 — 플레이어가 화면 밖으로 걸어 나갔다 — SUJEONG CHOI · `b6bdda1`
- `[Docs]` A2 프롬프트를 확정된 결정에 맞춘다 — gamome44 · `1d085c4`
- `[Docs]` 세계관을 조선시대로 명시하고 정비 셔터를 창호지 미닫이문으로 — gamome44 · `8e64564`
- `[Fix]` 지원 기회 소비 표시가 조우 상대를 읽고 있었다 — 죽은 코드였다 — SUJEONG CHOI · `1597662`
- `[Feat]` 일시정지 화면 — 계속하기·조작 안내·타이틀로(확인 절차) — SUJEONG CHOI · `3c7ddd8`
- Merge branch 'develop' of https://github.com/xuxeong/batdureong-nantu into develop — SUJEONG CHOI · `a8c1673`
- `[Chore]` DEC-UI-030·DEC-CONTENT-025 반영 + 같은 stage 연속 검증 규칙 신설 — SUJEONG CHOI · `7c91f3f`
- `[Fix]` 재배 게이지 홈을 613 으로 잘못 읽었다 — 실제로는 789 다 — SUJEONG CHOI · `39eac6e`
- `[Docs]` 14.3 을 추가분 목록에서 전체 목록으로 — UI 에셋 37개 — gamome44 · `58e4b17`
- `[Fix]` 게이지 홈은 595 다 — 앞 커밋의 789 는 글자 가장자리를 센 값이었다 — SUJEONG CHOI · `5a37595`
- `[Feat]` 로딩·데이터 오류 화면 — data.error 가 8/2부터 콘솔로만 나갔다 — SUJEONG CHOI · `2b51353`
- `[Docs]` 목업은 배치의 기준이지 질감의 기준이 아니다 · B1 시트 프롬프트 — gamome44 · `433346e`
- `[Docs]` B2 정비 부품 시트 프롬프트 — gamome44 · `7198c8a`
- `[Feat]` 튜토리얼 — 안내를 필드 위로 옮기고 조작으로 넘어가게 한다 — SUJEONG CHOI · `2851a22`
- `[Docs]` 튜토리얼 P0 둘과 김민주 인계 — 4-2 절 신설 — SUJEONG CHOI · `334cac0`
- `[Docs]` B2 프롬프트를 다시 쓴다 — 목업을 가리키지 않고 말로 묘사했다 — gamome44 · `d32a741`
- `[Docs]` 캡처 3장 재촬영 — 8·9번 뒤의 확정 배치다 — SUJEONG CHOI · `d5890dd`
- `[Docs]` B2 를 IMG-B-001 형식으로 되돌린다 · list_row 선택본과 자물쇠 추가 — gamome44 · `5cc554b`
- `[Docs]` 4-2 인계 날짜 정정 + 남은 작업 표 — SUJEONG CHOI · `d04ecdd`
- Merge branch 'develop' — v0.2 아트 적용 빌드 — SUJEONG CHOI · `f7f62dc`
- Merge branch 'main' of https://github.com/xuxeong/batdureong-nantu — SUJEONG CHOI · `5c17462`
- `[Docs]` B3 습격 예고 표지 시트 — 그림 자리와 문구 자리를 나눈다 — gamome44 · `c7707c9`
- `[Docs]` 남은 작업 인계 문서 신설 + 로드맵 체크박스 정리 — SUJEONG CHOI · `b1cada6`
- `[Docs]` 인계 문서 1-3·1-4 순서 정정 — SUJEONG CHOI · `a4138bc`
- `[Docs]` 인계 문서에 제출 준비 절 추가 — 빠뜨린 것 넷을 찾았다 — SUJEONG CHOI · `40eaef0`
- `[Docs]` B단계 파일 이름 16개와 목업·부품이 어긋날 때의 처리 — gamome44 · `d071f1a`
- `[Docs]` A3 요소를 다시 훑어 빠진 셋을 찾고 B4·B5 프롬프트를 쓴다 — gamome44 · `090a12e`
- `[Docs]` list_row 를 CSS 로 · item_slot 을 배지 유무 둘로 · 보관함 이름은 툴팁 — gamome44 · `ecfb2a4`
- `[Docs]` 제작 상세창에서 설명과 수치를 빼고 목록 안내로 옮긴다 — gamome44 · `2e098e9`
- `[Docs]` button_selected 를 뺀다 — 실제 배치에서 기능 버튼이 셋으로 줄었다 — gamome44 · `1b7b578`
- `[Docs]` 팝업은 오른쪽 창만 · 재배와 정비의 습격 예고는 같지 않아도 된다 — gamome44 · `9597d1a`
- `[Art]` B단계 UI 부품 17종과 원본 시트 9장, A3 목업 v2~v6 — gamome44 · `d0d6d5f`
- `[Art]` 토란 2종 · 바나나 ID 유지 결정을 14.5 에 기록 — gamome44 · `a0ad76d`
- Merge branch 'develop' of https://github.com/xuxeong/batdureong-nantu into develop — gamome44 · `c68cd70`
- `[Docs]` C단계 아이콘 프롬프트 셋 · crop_attributes 도 부모 후보에 없다 — gamome44 · `020f8d1`
- `[Docs]` 튜토리얼 P0 셋 확정 · 아트 순서에서 F를 C 앞으로 — gamome44 · `80bac54`
- `[Docs]` 컨셉아트를 시트에서 정면 전신 한 장으로 · 산출물별 시점을 나눈다 — gamome44 · `6c28c44`
- `[Docs]` 플레이어를 먼저 뽑아 태그 블록을 확정한다 — gamome44 · `3fb25f8`
- `[Docs]` 6절을 사람과 그 밖으로 나눈다 — 사람은 목장이야기 계열 — gamome44 · `76a148e`
- `[Docs]` C1 을 목업 지목 방식으로 다시 쓴다 — 규칙을 적어놓고 안 지켰다 — gamome44 · `14c828a`
- `[Docs]` 아이콘은 한 단위만 · C1 수정 프롬프트 — gamome44 · `21963d7`
- `[Docs]` 사람의 선과 채색을 목장이야기 계열로 — 5절도 사람과 그 밖으로 나눈다 — gamome44 · `39ac06a`
- `[Docs]` 사람 태그를 2000년대 게임 일러스트로 못박는다 — 매체 이름을 정확히 쓴다 — gamome44 · `3d9764a`
- `[Docs]` 캐릭터 태그 블록 확정 — harvest moon (series) 와 Prompt Guidance 4 — gamome44 · `6addc96`
- `[Docs]` 캐릭터 시드를 고정하고 피부 톤을 공통 블록에 못박는다 — gamome44 · `75bac33`
- `[Docs]` 캐릭터 컨셉아트 확정 — 다섯을 한 장에, 그림책 잉크 톤 — gamome44 · `fbe74a1`
- `[Docs]` 낫은 별도 스프라이트가 아니다 · 이펙트 넷 · 조준선을 미결정에 올린다 — gamome44 · `adf8fff`
- `[Docs]` 기획 보조 AI 교대 인계 문서 · SD 프롬프트에서 알아낸 것을 12.7 에 정리 — gamome44 · `a9ea78d`
- `[Docs]` 제출 문서 TODO 작성 — AI 활용·팀 역할·출처 정리 — gamome44 · `bbf85bf`
- `[Feat]` 튜토리얼 P0 둘 — assign_quickslot 신설과 시작 소지금 (schema_version 7) — ming9 · `83cd36b`
- `[Docs]` 튜토리얼 P0 세션 기록 — ming9 · `b426be1`
- `[Chore]` origin/develop 튜토리얼 변경 병합 — gamome44 · `5d2aa01`
- `[Art]` A3 v7 최종 목업·C1 아이콘·캐릭터 기준 이미지 반영 — gamome44 · `e053226`
- `[Art]` C2·C3 아이콘 11종과 원본 시트 반영 — gamome44 · `41e0529`
- `[Art]` C단계 원본 시트와 생성 기록 정리 — gamome44 · `9ca31f3`
- `[Art]` F·E·A4 최종 에셋과 제작 기록 반영 — gamome44 · `bd63668`
- `[Feat]` 항목 안내를 hover 로 옮기고 상점·제작 상세창을 맞춘다 (14.8, 14.9) — ming9 · `9657f9f`
- `[Feat]` 항목 안내를 hover 로 옮기고 상점·제작 상세창을 맞춘다 (14.8, 14.9) — ming9 · `e34c982`
- `[Data]` 과일 꿀범벅 → 밭두렁 새참 — ming9 · `9f8d8f2`
- `[Docs]` 변경사항 세션 기록 — ming9 · `3698432`
- Merge branch 'develop' of https://github.com/xuxeong/batdureong-nantu into develop — ming9 · `ed130d5`
- `[Data]` F·C·E 에셋 31행 연결 — field_sprite 8 · projectile 5 · icon 18 — ming9 · `ef8774f`
- `[Feat]` 선택지 말풍선 연결 (A4) — ming9 · `8c7045b`

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
- `[Docs]` PROGRESS.md 갱신 [skip ci] — github-actions[bot] · `9379d13`

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

