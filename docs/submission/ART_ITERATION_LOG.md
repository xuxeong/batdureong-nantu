# 아트 반복 제작 기록

아트 파일별 생성 횟수와 수정 이력을 기록한다.

- **총 생성 횟수**: 최초 생성까지 포함해 이미지 생성 도구를 호출한 횟수
- **다시 뽑은 횟수**: 최초 생성을 제외한 재생성·AI 보정 횟수
- 중간 시도는 `assets/source/**/iterations/`에 보존한다.
- 최종 채택 전인 파일은 상태를 `검토 대기`로 표시한다.
- **재생성 원칙**: 결과에 문제가 보여도 임의로 다시 생성하지 않는다. 요구사항과 어긋난 근거를 먼저 사용자에게 제시하고, 명시적 승인을 받은 뒤에만 재생성한다.

**단계 번호가 아트 디렉션 9절과 다르다.** 이 문서의 A2는 정비 허브, A3는 대화 화면인데,
2026-08-05에 습격 화면 목업이 추가되면서 아트 디렉션의 단계는 A1 낮 필드 · A2 밤 필드 ·
A3 정비 허브 · A4 대화로 바뀌었다. 아래 표의 A2·A3는 **옛 번호**이며 파일명도 그때 것이다.
다음에 목업을 뽑을 때 새 번호를 쓴다.

## 현황

| 아트 ID | 현재 파일 | 총 생성 횟수 | 다시 뽑은 횟수 | 상태 | 마지막 변경 |
|---|---|---:|---:|---|---|
| A1-original | `assets/source/phase-a/A1_daytime_gameplay_mockup.png` | 1 | 0 | 참조 원본 | A1-v3의 필드·농부 기준으로 채택 |
| A1-v2 | `assets/source/phase-a/A1_daytime_gameplay_mockup_v2.png` | 3 | 2 | 대체됨 | 농부 축척과 HUD 채도 수정안이 사용자 피드백으로 기각됨 |
| A1-v3 | `assets/source/phase-a/A1_daytime_gameplay_mockup_v3.png` | 1 | 0 | 검토 대기 | 사용자 승인에 따라 v1 필드와 v2 HUD를 합성하고 체력 바는 빨간색 유지 |
| A1-v4 | `assets/source/phase-a/A1_daytime_gameplay_mockup_v4.png` | 1 | 0 | 검토 대기 | 최신 아트 디렉션 12.1·12.2절 A1 명세로 신규 생성 후 1920×1080 정규화 |
| A1-v5 | `assets/source/phase-a/A1_daytime_gameplay_mockup_v5.png` | 2 | 1 | **확정** | 2026-08-05 사용자 확정. 숲 테두리는 필드 안쪽 약 5%만 침범 |
| A2 | `assets/source/phase-a/A2_maintenance_hub_mockup.png` | 1 | 0 | 검토 대기 | 최초 생성 |
| A3 | `assets/source/phase-a/A3_dialogue_mockup.png` | 1 | 0 | 검토 대기 | 최초 생성 |
| C1 | `assets/source/phase-c/sheets/c1_crop_material_icon_sheet_chroma_v3.png` | 3 | 2 | **확정** | 2026-08-06 사용자 채택. 작물 4종은 단일 수확물, 재료 3종은 기존 형태 유지 |
| C2 | `assets/source/phase-c/sheets/c2_throwable_recovery_icon_sheet_chroma.png` | 1 | 0 | **확정** | 2026-08-06 사용자 채택. C1 작물 4종과 C2 아이콘 7종을 함께 담은 통합 시트 |
| C3 | `assets/source/phase-c/sheets/c3_crop_attribute_icon_sheet_chroma.png` | 1 | 0 | **확정** | 2026-08-06 사용자 채택. 작물 속성 기호 4종 |

## 상세 이력

### A1-original — 낮 플레이 화면 최초 목업

| 회차 | 파일 | 결과·변경 내용 |
|---:|---|---|
| 1 | `assets/source/phase-a/A1_daytime_gameplay_mockup.png` | 사용자의 화면별 세부 프롬프트를 받기 전에 아트 디렉션 문서만 바탕으로 생성. 이후 A1-v2로 대체. |

### A1-v2 — 낮 플레이 화면 재제작

| 회차 | 파일 | 결과·변경 내용 |
|---:|---|---|
| 1 | `assets/source/phase-a/iterations/A1_daytime_gameplay_v2_attempt1.png` | 사용자 세부 명세로 처음부터 재생성. 네 가지 밭 상태와 HUD 배치는 충족했으나 농부가 화면 높이의 약 1/16보다 크고, 체력 바의 붉은 채도가 익은 작물과 경쟁함. |
| 2 | `assets/source/phase-a/iterations/A1_daytime_gameplay_v2_attempt2.png` | 농부를 화면 높이의 약 1/16로 축소하고 체력 바를 저채도 회녹색으로 변경. 하단 우측 회복 게이지의 초록색이 여전히 눈에 띔. |
| 3 | `assets/source/phase-a/A1_daytime_gameplay_mockup_v2.png` | 회복 게이지만 저채도 회올리브색으로 낮춤. 익은 주황·붉은 작물이 화면에서 유일하게 강하게 부각되도록 정리한 검토 대기본. |

사용자 피드백: 농부가 지나치게 작고 빨간 체력 바를 없앤 변경이 적절하지 않아 A1-v2는 대체됨. 이 시점부터 재생성 전 사용자 승인을 필수로 한다.

### A1-v3 — v1 필드 + v2 HUD 합성

| 회차 | 파일 | 결과·변경 내용 |
|---:|---|---|
| 1 | `assets/source/phase-a/A1_daytime_gameplay_mockup_v3.png` | 사용자 요청으로 승인된 합성 1회. A1-original의 필드·농부 비율·환경을 유지하고 A1-v2의 HUD 배치를 적용. 체력 바는 빨간색으로 유지하고, 농부 아래 중앙 게이지는 제거해 회복 슬롯과 게이지를 하단 우측으로 옮김. 추가 재생성 없음. |

### A1-v4 — 최신 A1 상세 명세 신규 목업

| 회차 | 파일 | 결과·변경 내용 |
|---:|---|---|
| 1 | `assets/source/phase-a/A1_daytime_gameplay_mockup_v4.png` | 아트 디렉션 12.1절 고정 블록과 12.2절 A1 상세 명세를 사용해 처음부터 생성. 중앙 3열×2행 경작지 여섯 칸, 네 가지 생육 상태, 수풀 2중 프레임, 반쯤 가려진 야생동물, 상단 표지판·재배 게이지·설정 버튼, 하단 플레이어 카드·퀵슬롯 5칸·회복 슬롯 1칸을 반영. 생성 원본 1672×941을 1920×1080으로 정규화했으며 AI 재생성은 없음. |

### A1-v5 — 숲 테두리 침범 깊이 축소

| 회차 | 파일 | 결과·변경 내용 |
|---:|---|---|
| 1 | `assets/source/phase-a/A1_daytime_gameplay_mockup_v4.png` | 편집 기준 원본. 숲의 큰 덩어리가 1600×900 필드 안쪽으로 깊게 들어와 플레이 영역이 좁아 보임. |
| 2 | `assets/source/phase-a/A1_daytime_gameplay_mockup_v5.png` | 사용자 승인에 따라 숲 테두리만 수정. 뒤 겹 숲은 필드 바깥 HUD 띠 위주로 물리고, 앞 겹 잎은 좌우 약 80px·상하 약 45px(필드 치수의 약 5%)만 안쪽으로 겹치게 축소. 멧돼지의 반가림과 모든 HUD·경작지·캐릭터 구성은 유지. 생성 원본 1672×941을 1920×1080으로 정규화. |

2026-08-05 사용자 확인으로 A1-v5를 A1 최종 목업으로 확정했다. 이후 UI와 배경 분리는
개별 생성이 아니라 **같은 계열을 한 시트에 함께 생성한 뒤 시트에서 분리**하는 방식으로 한다.
개별 생성 시도는 목업과 선 굵기·목재 톤·상대 크기가 달라져 사용자 요청으로 전부 삭제했다.

### A2 — 정비 허브

| 회차 | 파일 | 결과·변경 내용 |
|---:|---|---|
| 1 | `assets/source/phase-a/A2_maintenance_hub_mockup.png` | 사용자의 화면별 세부 프롬프트를 받기 전에 아트 디렉션 문서만 바탕으로 최초 생성. 재생성 없음. |

### A3 — 대화 화면

| 회차 | 파일 | 결과·변경 내용 |
|---:|---|---|
| 1 | `assets/source/phase-a/A3_dialogue_mockup.png` | 사용자의 화면별 세부 프롬프트를 받기 전에 아트 디렉션 문서만 바탕으로 최초 생성. 재생성 없음. |

### C1 — 작물과 재료 아이콘 시트

| 회차 | 파일 | 결과·변경 내용 |
|---:|---|---|
| 1 | `assets/source/phase-c/sheets/c1_crop_material_icon_sheet_chroma.png` | 아트 디렉션 12.1·12.4·12.4.1절과 `a1_farm_plots_sheet_chroma_v2.png` 한 장을 기준으로 7종을 생성. 고추·토마토·토란·찹쌀·천 자루·빈 옹기병·꿀단지가 순서와 개수에 맞게 나왔다. 배경에 미세한 밝기 변화가 있고 일부 오브젝트에 매끈한 하이라이트가 보여 평면 2단 명암 규칙과 약간 어긋난다. |
| 2 | `assets/source/phase-c/sheets/c1_crop_material_icon_sheet_chroma_v2.png` | 사용자가 다시 제공한 `IMG-C-002` 프롬프트를 그대로 사용. 토마토·찹쌀·고추·토란을 참조 시트의 식물 형태로 분리하고 재료 3종을 새로 그렸다. 7종의 순서와 개수는 맞지만 참조 작물의 정확한 실루엣 복제에는 차이가 있고, 배경 표본이 RGB(4~22, 241~249, 18~31)로 완전한 `#00ff00` 단색은 아니다. |
| 3 | `assets/source/phase-c/sheets/c1_crop_material_icon_sheet_chroma_v3.png` | v2를 유일한 편집 대상으로 사용한 `IMG-C-003` 정밀 편집. 토마토 한 알·찹쌀 이삭 하나·고추 하나·잎 없는 토란 알줄기 하나로 축소하고 하단 재료 3종과 전체 배치를 유지했다. 배경은 기존 녹색 계열을 보존했으나 표본이 RGB(8~23, 229~236, 36~47)로 완전한 `#00ff00` 단색은 아니다. **2026-08-06 사용자 최종 채택.** |

### C2 — 투척 무기와 회복 아이템 아이콘 시트

| 회차 | 파일 | 결과·변경 내용 |
|---:|---|---|
| 1 | `assets/source/phase-c/sheets/c2_throwable_recovery_icon_sheet_chroma.png` | C1 v3 한 장과 아트 디렉션 12.4.2절의 `IMG-C-004` 프롬프트를 사용했다. C1 작물 4종이 상단에 함께 나오고 C2의 투척 무기 4종·회복 아이템 3종이 아래에 배치된 총 11종 통합 시트다. 고춧가루·으깬 토란 용기는 열린 자루 형태다. **2026-08-06 사용자 판단으로 최종 채택.** |

### C3 — 작물 속성 아이콘 시트

| 회차 | 파일 | 결과·변경 내용 |
|---:|---|---|
| 1 | `assets/source/phase-c/sheets/c3_crop_attribute_icon_sheet_chroma.png` | C1 v3 한 장과 아트 디렉션 12.4.3절의 `IMG-C-005` 프롬프트를 사용했다. 불타는 열기·곪음·미끄러움·끈적함의 네 기호가 순서와 개수에 맞게 생성됐다. **2026-08-06 사용자 최종 채택.** |
