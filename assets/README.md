# 에셋 폴더

규격과 파이프라인은 `DEC-ART-001`이 정한다. 이 문서는 폴더 배치만 설명한다.

## 폴더

| 폴더 | 내용 |
|---|---|
| `final/` | 게임이 실제로 읽는 결과물 |
| `source/` | 그 결과물의 AI 생성 원본과 편집 전 파일 |
| `placeholder/` | 아트가 준비되기 전의 임시 표시 |

채택하지 않은 시안은 저장소에 누적하지 않는다.

## 경로 규칙

카탈로그 파일을 두지 않고 논리 에셋 ID에서 경로를 계산한다.

```
asset.<구간>.<이름>  →  assets/final/<구간>/<이름>.<확장자>
```

예) `asset.portrait.yeongsun` → `assets/final/portrait/yeongsun.png`

ID는 영문 소문자·숫자·밑줄·마침표만 쓴다. **`final/`의 하위 폴더 이름이 곧 구간이라 임의로 바꾸면 ID가 파일로 해석되지 않는다.**

## 구간

콘텐츠에 붙는 13개 — 연결 CSV `content_assets.csv`의 `asset_role`과 같은 값이다.

`field_sprite` `farm_plot` `crop_seed` `crop_growing` `crop_ready` `icon` `portrait`
`projectile` `effect` `background` `cutscene` `sfx` `bgm`

어떤 콘텐츠에도 속하지 않는 UI·시스템 에셋 4개 — 연결 CSV를 쓰지 않고 `schema/enums.json`의 고정 허용 목록으로 관리한다.

`ui` `logo` `hud` `font`

새 구간이나 새 `asset_role`의 추가는 콘텐츠 값 추가가 아니라 스키마 변경이다.

## 형식

이미지 PNG(투명 배경), 소리 MP3, 폰트 WOFF2. 1차 프로토타입에서는 프레임 애니메이션과
스프라이트 시트를 쓰지 않는다. 스프라이트의 기준점은 중심이고 월드 1단위가 화면 1픽셀이다.

## 파일을 추가할 때

같은 커밋에서 `docs/submission/CREDITS.md`에 제작 방법, 도구, 프롬프트, 출처와 라이선스를
기록한다. 폰트는 웹 임베딩 허용 여부를 함께 적는다. 대회 제출 필수 요건이라 몰아서 하면
프롬프트를 기억하지 못한다.
