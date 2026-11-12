# 클클 마을 (CLCL TOWN)

구름 아래 작은 농장 마을을 캐릭터로 걸어 다니며 구경하는 3D 복셀 웹사이트다.
마을은 여러 구획으로 나뉘고, 구획마다 주인 이름이 떠 있는 농장이 하나씩 있다.
각 농장에는 소, 돼지, 닭, 양, 오리, 말, 토끼 가운데 무작위로 고른 동물이 한 마리 산다.

## 실행

```bash
npm install
npm run dev      # http://localhost:5173 에서 열린다
npm run build    # dist/ 에 배포용 파일을 만든다
npm run preview  # 만든 dist/ 를 미리 본다
```

`dist/` 폴더는 정적 파일이므로 GitHub Pages, Netlify, 일반 웹 서버 어디에 올려도 된다.
경로를 상대 경로로 만들기 때문에 하위 폴더(예: `example.com/town/`)에 올려도 동작한다.

## 농장 주인 이름 바꾸기

`src/config.js` 의 `owners` 배열을 고친다. 앞에 있는 이름일수록 광장에 가까운 구획을 받는다.
이름 수에 맞춰 구획 수와 마을 크기가 자동으로 정해지고, 남는 구획은 연못 쉼터가 된다.

```js
owners: ['윤서율', '강형준', '김기석', /* ... */],
```

코드를 고치지 않고 확인만 하려면 주소 뒤에 이름을 붙인다.

```
http://localhost:5173/?owners=하늘,바다,구름이
```

## 동물이 정해지는 방식

- 농장마다 동물 수는 `animalsPerFarm` 으로 정한다. 지금은 1 이다. 수를 늘리면 동물마다 종류를 따로 무작위로 고른다.
- 기본값(`shuffleEachVisit: false`)에서는 이름마다 동물, 헛간 색, 밭 작물이 항상 같다. 이름을 시드로 쓰기 때문이다.
- `shuffleEachVisit: true` 로 바꾸면 접속할 때마다 새로 정해진다.
- `seed` 값을 바꾸면 모든 농장의 구성이 한꺼번에 달라진다.

## 농장 방명록 (giscus)

농장 정보 창 아래에 방명록이 있다. 글은 이 저장소의 GitHub Discussions 에 저장되며,
농장마다 "윤서율의 농장 방명록" 같은 제목의 Discussion 이 하나씩 생긴다. 첫 글이 달릴 때 giscus 가 만든다.
글을 쓰려면 GitHub 계정으로 로그인해야 한다.

처음 한 번은 GitHub 웹에서 다음을 해야 한다. API 로는 할 수 없다.

1. https://github.com/apps/giscus 에서 giscus 앱을 이 저장소에 설치한다.
2. 저장소의 Discussions 탭에서 카테고리 `방명록` 을 만든다. 형식은 **Announcement** 로 고른다.
   그래야 방문자가 Discussions 에 글을 직접 새로 만들 수 없고, 방명록 글만 달 수 있다.
3. https://giscus.app/ko 에 저장소 이름을 넣고 `방명록` 카테고리를 고르면 `data-repo-id`, `data-category-id` 가 나온다.
   이 두 값을 `src/config.js` 의 `guestbook.repoId`, `guestbook.categoryId` 에 넣는다.

`giscus.json` 은 방명록이 뜰 수 있는 사이트 주소를 정한다. 지금은 GitHub Pages 주소와 로컬 개발 주소만 허용한다.
다른 도메인으로 배포하면 그 주소를 `origins` 에 추가해야 방명록이 뜬다.

`guestbook.titleFormat` 은 방명록에 글이 달린 뒤에는 바꾸지 않는다. giscus 가 이 제목으로 농장의 글을 찾기 때문이다.

방명록을 연 상태의 주소(`?farm=윤서율`)는 그 농장으로 바로 들어가는 링크가 된다.

## 조작

| 동작 | 키보드 | 모바일 |
| --- | --- | --- |
| 이동 | WASD, 방향키 | 왼쪽 조이스틱 |
| 달리기 | Shift | 조이스틱을 끝까지 민다 |
| 점프 | Space | 점프 버튼 |
| 농장 정보 보기, 안내판 보기, 동물 쓰다듬기 | E | E 버튼 |
| 확대·축소 | 마우스 휠 | |

광장의 농장 안내판에서 농장을 고르면 그 농장 입구로 바로 이동한다.
오른쪽 위 버튼으로 아침, 낮, 저녁, 밤을 바꿀 수 있고, 처음 접속할 때는 현재 시각에 맞는 시간대로 시작한다.

## 파일 구성

| 파일 | 내용 |
| --- | --- |
| `src/config.js` | 마을 이름, 농장 주인 이름, 무작위 설정 |
| `src/world.js` | 구획 배치, 길, 농장, 광장, 연못 |
| `src/models.js` | 동물, 캐릭터, 나무, 구름 모델과 동물 이름·울음소리 |
| `src/animals.js` | 동물이 돌아다니고 풀을 뜯는 동작 |
| `src/player.js` | 캐릭터 이동, 충돌, 점프 |
| `src/sky.js` | 시간대별 하늘과 조명, 떠다니는 구름 |
| `src/ui.js` | 이름표, 말풍선, 미니맵, 정보 창, 모바일 조작 |
| `public/favicon.svg` | 구름 파비콘 |

## 사용한 것

- [three.js](https://threejs.org/) 0.186.1
- [Vite](https://vite.dev/) 8.3.5
- [갈무리(Galmuri)](https://galmuri.quiple.dev/) 픽셀 글꼴. SIL Open Font License 1.1 을 따르며 라이선스 전문은 `src/fonts/OFL.md` 에 있다.
