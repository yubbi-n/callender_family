# 가족 근무 캘린더

가족끼리 근무표와 일정을 함께 보는 웹앱(PWA)이에요. iPhone과 안드로이드 모두 홈 화면에 추가해서 앱처럼 써요.
빌드 과정이 없어서 파일을 고치면 바로 반영돼요.

## 파일 구성

| 파일 | 내용 |
|---|---|
| `index.html` | 앱 시작 페이지 |
| `app.js` | 화면 전체 (가족 합류, 캘린더, 근무 입력, 일정, 설정) |
| `data.js` | 데이터 저장 (Supabase 또는 체험 모드) |
| `config.js` | **Supabase 주소와 키를 넣는 곳** |
| `styles.css` | 기본 스타일 |
| `manifest.webmanifest`, `sw.js`, `icons/` | 홈 화면 설치·오프라인용 |
| `supabase/schema.sql` | Supabase에 한 번 실행할 데이터베이스 설정 |

## 1. Supabase 설정 (한 번만)

1. Supabase 대시보드에서 프로젝트를 엽니다.
2. 왼쪽 **SQL Editor** → **New query** → `supabase/schema.sql` 내용을 전부 붙여넣고 **Run**.
3. 왼쪽 **Authentication** → **Sign In / Providers** → **Allow anonymous sign-ins** 켜기 → Save.
   (가족들이 이메일 가입 없이 초대 코드 + PIN으로 들어오기 위해 필요해요.)
4. **Project Settings** → **API**(또는 **API Keys**)에서
   - Project URL
   - `anon` / `publishable` 키
   를 복사해서 `config.js`에 붙여넣습니다. `service_role` / `secret` 키는 절대 넣지 마세요.

`config.js`가 비어 있으면 **체험 모드**로 실행돼요 (초대 코드 `DEMO26`, PIN `1234`, 데이터는 그 기기에만 저장).

## 2. 내 컴퓨터에서 확인

```bash
python -m http.server 5173
```

브라우저에서 http://localhost:5173 을 엽니다.

## 3. 인터넷에 올리기 (Vercel)

GitHub 저장소에 이 폴더를 올린 다음, Vercel에서 **Add New → Project → 저장소 Import** → 설정은 그대로 두고 **Deploy**.
나오는 주소(예: `https://family-calendar.vercel.app`)를 가족에게 보내면 됩니다.

## 4. 가족 폰에 설치

- **iPhone**: Safari로 주소 열기 → 공유 버튼 → **홈 화면에 추가** → 홈 화면 아이콘으로 열기
- **안드로이드**: Chrome으로 주소 열기 → 메뉴(⋮) → **앱 설치** 또는 **홈 화면에 추가**

> iPhone은 Safari와 홈 화면 앱이 저장 공간을 따로 써요. **홈 화면에 추가한 뒤, 그 아이콘으로 열어서** 초대 코드를 입력하세요.

## 쓰는 방법

1. 첫 사람: **처음이에요 · 새 가족 만들기** → 이름·색·PIN 정하기 → 톱니바퀴(설정)에서 초대 코드 확인
2. 다른 가족: 초대 코드 입력 → **새 프로필 만들기** (폰을 바꿨으면 내 프로필 선택 → PIN)
3. **내 근무 입력**: 근무 코드(3교대·2교대 등)를 한 번 정하고, 코드를 고른 뒤 날짜를 눌러 입력 → 저장
4. **+** 버튼: 가족 일정 추가 (함께하는 사람, 매주·매년 반복, 나만 보기)

## 알아두기

- 공휴일은 2026~2027년까지 들어 있어요 (`app.js`의 `HOLIDAYS`).
- PIN을 잊으면 가족을 처음 만든 사람(관리자)이 설정에서 초기화할 수 있어요.
- 근무표 사진을 올려서 자동으로 인식하는 기능은 아직 없어요. 지금은 직접 입력해요.
