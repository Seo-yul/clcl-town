// 클클 타운 설정이다. 이 파일만 고치면 마을 이름과 농장 주인을 바꿀 수 있다.
export const CONFIG = {
  townName: '클클 타운',
  townNameEn: 'CLCL TOWN',

  // 농장 주인 이름이다. 앞에 있는 이름일수록 광장에 가까운 구획을 받는다.
  // 이름 수에 맞춰 구획 수와 마을 크기가 자동으로 정해진다.
  // 로컬 개발 화면(npm run dev)에서는 주소 뒤에 ?owners=이름1,이름2,이름3 을 붙이면 이 목록 대신 그 이름들을 쓴다.
  // 배포된 사이트에서는 ?owners= 를 무시한다.
  owners: [
    '윤서율', '강형준', '김기석', '김동욱', '김보겸',
    '박도연', '박세현', '박은서', '신웅비', '신준수',
    '윤서영', '이서영', '이성현', '이주원', '정장우',
    '남태욱', '고태현', '홍예슬', '조승아',
  ],

  // 모든 농장에는 클라우드 클럽 구름 캐릭터가 하나씩 산다.
  // animalsPerFarm 은 게임 기록이 없는 농장에 더할 동물 수다. 지금은 농장에 동물을 두지 않으므로 0 이다.
  // 1 이상이면 동물마다 종류(소, 돼지, 닭, 양, 오리, 말, 토끼)를 무작위로 고른다.
  // 동물은 광장과 연못 쉼터에도 산다.
  animalsPerFarm: 0,

  // 함께한 게임 기록이다. 한 줄이 한 판이고, 그 판을 함께한 농장 주인 이름을 적는다.
  // 같은 사람이 같은 게임을 여러 판 하면 그 농장의 캐릭터와 판 수가 그만큼 늘어난다.
  // game 에 쓸 수 있는 값과 각 게임의 이름, 아이콘, 말풍선은 src/models.js 의 GAMES 에 있다.
  plays: [
    { game: 'holdem', players: ['윤서율', '윤서영', '박도연', '이주원', '박세현'] },
    { game: 'kraken', players: ['윤서율', '윤서영', '박도연', '이주원', '박세현'] },
    { game: 'kraken', players: ['윤서율', '김동욱', '정장우', '조승아', '이서영', '고태현', '박도연'] },
    { game: 'codenames', players: ['윤서율', '김동욱', '정장우', '조승아', '이서영', '고태현', '박도연'] },
    { game: 'lasvegas', players: ['윤서율', '김동욱', '정장우', '조승아', '이서영', '고태현', '박도연'] },
  ],

  // 아직 아무 농장에도 배정하지 않고 농장 사이 길을 돌아다니는 캐릭터다. 값은 src/models.js 의 GAMES 키다.
  // 지금은 머더 미스터리 시리즈 7개다. 누군가와 함께하면 plays 에 기록하고, 원하면 여기서 뺀다.
  roaming: ['wendy', 'bluemoon', 'werewolf', 'eida', 'giantbird', 'hero', 'suspect'],

  // 광장의 GitHub 표지판 앞에서 E 를 누르면 새 탭으로 여는 주소다. 비워 두면 표지판을 세우지 않는다.
  contributeUrl: 'https://github.com/Seo-yul/clcl-town',

  // 계절 테마가 나타나는 기간이다. 한국 시간 기준 'MM-DD' 이고 시작일과 끝일을 모두 포함하며 해마다 되풀이한다.
  // 날짜는 페이지를 열 때 한 번 확인한다. 02-29 는 2월 마지막 날까지라는 뜻이다.
  // spring, summer, autumn, snow 는 기간이 겹치면 snow, autumn, summer, spring 순서로 하나만 보여 준다.
  // christmas 와 newyear 는 그 위에 더해진다.
  // 무엇이 바뀌는지는 방문자가 직접 보고 놀랄 수 있도록 문서에 적지 않는다.
  // 로컬 개발 화면(npm run dev)에서는 주소 뒤에 ?season=이름 (spring, summer, autumn, snow, christmas, newyear, off)을
  // 붙여 날짜와 관계없이 미리 본다.
  seasons: {
    spring: { from: '03-01', to: '05-31' },
    summer: { from: '06-01', to: '08-31' },
    autumn: { from: '09-01', to: '12-03' },
    snow: { from: '12-04', to: '02-29' },
    christmas: { from: '12-04', to: '12-31' },
    newyear: { from: '01-01', to: '01-01' },
  },

  // false 이면 같은 이름은 항상 같은 동물과 같은 농장 모습을 가진다.
  // true 이면 접속할 때마다 동물과 농장 모습이 새로 정해진다.
  shuffleEachVisit: false,

  // 이 값을 바꾸면 모든 농장의 구성이 한꺼번에 달라진다.
  seed: 'clcl-town',

  // 농장 방명록(giscus) 설정이다. 글은 GitHub Discussions 에 농장마다 하나씩 생기는 글에 저장된다.
  // repoId 와 categoryId 는 https://giscus.app/ko 설정 화면에서 받을 수 있다.
  // 네 값 가운데 하나라도 비어 있으면 방명록을 보여 주지 않는다.
  guestbook: {
    repo: 'Seo-yul/clcl-town',
    repoId: 'R_kgDOVr8-9Q',
    category: '방명록',
    categoryId: 'DIC_kwDOVr8-9c4DK-pD',
    // giscus 는 이 제목으로 농장의 방명록 글을 찾는다.
    // 방명록에 글이 달린 뒤에 바꾸면 기존 글과 연결이 끊기므로 바꾸지 않는다.
    titleFormat: '{name}의 농장 방명록',
    // 방명록 모양을 정하는 CSS 파일(public/giscus-theme.css)을 배포한 주소다.
    // giscus 위젯은 내 컴퓨터의 개발 서버에 있는 파일을 읽지 못하므로, 로컬 개발 화면에서는 이 주소의 파일을 쓴다.
    // https 로 배포한 화면에서는 그 사이트에 함께 올라간 파일을 쓴다.
    deployedTheme: 'https://devops.ai.kr/clcl-town/giscus-theme.css',
  },
};

export function guestbookReady() {
  const g = CONFIG.guestbook;
  return Boolean(g && g.repo && g.repoId && g.category && g.categoryId);
}

export function resolveOwners() {
  // ?owners= 는 개발 화면에서만 받는다. 배포된 사이트에서 받으면 누구나 우리 도메인으로
  // 가짜 주인 이름이 보이는 링크를 만들 수 있고, 그 농장의 방명록 글이 저장소에 쌓인다.
  if (import.meta.env.DEV) {
    const param = new URLSearchParams(location.search).get('owners');
    if (param) {
      const list = param.split(',').map((s) => s.trim()).filter(Boolean);
      if (list.length) return list.slice(0, 48);
    }
  }
  return CONFIG.owners;
}
