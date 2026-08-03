# schema — 콘텐츠 CSV 구조 정의

콘텐츠 CSV가 어떤 열을 가지고, 어떤 값을 허용하고, 무엇을 참조하는지를 기계가 읽을 수 있는
형식으로 담는다. 검증 도구(`npm run data:validate`)와 런타임 생성기(`npm run data:build`)가
같은 파일을 읽는다.

**이 폴더의 파일은 기획 문서를 설명하거나 요약하지 않는다.** 결정로그에서 추출한 구조 정보와,
그 근거가 되는 DEC 원문 인용만 담는다. 규칙의 의미가 궁금하면 `decisions`에 적힌 DEC를
결정로그에서 직접 본다.

| 파일 | 역할 |
|---|---|
| `common_entry.json` | 독립 콘텐츠가 공통으로 쓰는 열 |
| `enums.json` | 콘텐츠 담당자가 만들 수 없는 고정 허용 목록 |
| `schema_manifest.json` | `schema_version` 등 3종 버전 |
| `ending_input.schema.json` | 엔딩 LLM 입력 객체 구조 |
| `ending_prompt_system.md` | 엔딩 고정 시스템 프롬프트 |
| `tables/*.json` | 콘텐츠 CSV의 테이블 정의. **이 폴더가 CSV 목록의 단일 원본이다** (`DEC-PIPELINE-020`) |

---

## 테이블 정의 형식

### 독립 콘텐츠 (`entry_type: "independent"`)

`common_entry.json`의 열이 파일 맨 앞에 오고, 그 뒤에 `fields`가 순서대로 붙는다.

```jsonc
{
  "file": "crops.csv",
  "entry_type": "independent",
  "kind": "crop",
  "id_prefix": "crop.",
  "common_columns": true,
  "decisions": ["DEC-CONTENT-003"],   // 이 정의의 근거 DEC
  "fields": [ /* 전용 열 */ ],
  "rules": [ /* 검증 규칙 */ ]
}
```

### 연결 CSV (`entry_type: "link"`)

```jsonc
{
  "file": "map_points.csv",
  "entry_type": "link",
  "common_columns": false,
  "parent": { "table": "maps.csv", "field": "map_id" },
  "unique_key": ["map_id", "point_id"],
  "fields": [ /* ... */ ]
}
```

`parent`는 `DEC-PIPELINE-011`이 요구하는 항목이다.

> 새로운 연결 CSV를 추가할 때는 어느 참조 필드가 부모 콘텐츠를 가리키는지 스키마에 반드시 지정한다.
>
> — `DEC-PIPELINE-011`

### 필드 정의 키

| 키 | 뜻 |
|---|---|
| `name` | CSV 열 이름 |
| `required` / `required_when` / `empty_when` | 필수 여부와 조건 |
| `type` | `string` `integer` `number` `boolean` `enum` `reference` |
| `min` / `max` | 포함 범위 |
| `min_exclusive` / `max_exclusive` | 미포함 범위 |
| `values` | `enum`의 허용값 |
| `ref` | `reference`가 가리키는 대상 |
| `owner` | `designer`(기획자 작성) / `ai`(AI가 제안·정규화) |
| `quote` / `source` | 근거가 되는 DEC 원문과 위치 |

### 검증 규칙 심각도

콘텐츠 데이터 준비도 점검 7.5절의 구분을 따른다.

> - `차단`: 승인 또는 다음 단계 진행 불가
> - `주의`: 진행 가능하지만 사람 검토 필요
> - `제안`: 시스템 위반은 아니며 품질 개선 선택지

---

## 값 작성 규칙

`DEC-PIPELINE-013`에서 그대로 옮김.

> - 작업용 CSV는 엑셀 호환을 위해 UTF-8 BOM을 허용한다.
> - 승인 후보와 승인 CSV는 자동 정규화하여 UTF-8 쉼표 구분 형식으로 저장한다.
> - 헤더는 확정된 영문 `snake_case`를 사용한다.
> - 불리언은 소문자 `true`, `false`만 사용한다.
> - 정수는 단위, 천 단위 쉼표와 소수점 없이 10진수로 작성한다.
> - 실수는 마침표를 소수점으로 사용하고 `%`, 배율 단위와 초 단위를 셀에 붙이지 않는다.
> - ID·열거형·숫자 셀의 앞뒤 공백은 제거한다.
> - 표시 이름·설명·대사의 앞뒤 불필요한 공백은 제거하고 문장 내부 공백은 보존한다.
> - 선택 필드에 값이 없으면 빈 셀을 사용한다.
> - 빈 값을 `null`, `NULL`, `N/A`, `없음`, `-`로 대신하지 않는다.
> - `AUTO`와 `TBD`는 작업용 CSV와 승인 후보에서만 허용한다.
> - 승인 CSV에는 빈 필수값, `AUTO`와 `TBD`가 남아 있을 수 없다.
> - CSV 규칙에 따라 쉼표와 큰따옴표가 포함된 문장은 큰따옴표로 감싸고 내부 큰따옴표는 두 번 작성한다.
> - 셀 안의 실제 줄바꿈은 허용하지 않는다.
> - 인코딩, 줄바꿈, 따옴표와 숫자 표기 정규화만으로는 `content_version`을 증가시키지 않는다.
> - 자동 검증은 자료형과 허용 범위를 검사하기 전에 CSV 값을 이 표준 형식으로 정규화한다.

`DEC-PIPELINE-008`에서 그대로 옮김.

> - 한 셀에 여러 참조 ID를 나열하지 않는다.
> - 일대다 또는 다대다 관계는 별도의 연결 CSV에서 한 행에 한 관계만 기록한다.

---

## 스키마를 바꿔야 할 때

`DEC-PIPELINE-016`에서 그대로 옮김.

> 고정 열거형, 효과 키, 결과 키와 스키마 제약은 확정된 시스템·스키마 정의를 따르며 새 키나 제약의 추가는 데이터 행 추가가 아니라 시스템·스키마 변경으로 처리한다.

임의로 열을 추가하지 않고 `AGENTS.md` 5절의 절차를 따른다. 확정 후
`schema_manifest.json`의 `schema_version`을 올린다.

## 결정되지 않은 항목

결정로그에서 답을 찾을 수 없는 항목은 테이블 정의의 `open_questions`에 사실만 기록하고
기획 책임자의 확정을 기다린다. 추정해서 채우지 않는다.
