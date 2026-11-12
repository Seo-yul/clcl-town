// 클클 마을 설정이다. 이 파일만 고치면 마을 이름과 농장 주인을 바꿀 수 있다.
export const CONFIG = {
  townName: '클클 마을',
  townNameEn: 'CLCL TOWN',

  // 농장 주인 이름이다. 앞에 있는 이름일수록 광장에 가까운 구획을 받는다.
  // 이름 수에 맞춰 구획 수와 마을 크기가 자동으로 정해진다.
  // 주소 뒤에 ?owners=이름1,이름2,이름3 을 붙이면 이 목록 대신 그 이름들을 쓴다.
  owners: [
    '윤서율', '강형준', '김기석', '김동욱', '김보겸',
    '박도연', '박세현', '박은서', '신웅비', '신준수',
    '윤서영', '이서영', '이성현', '이주원', '정장우',
    '남태욱', '고태현', '홍예슬', '조승아',
  ],

  // 농장 하나에 사는 동물 수다. 동물마다 종류(소, 돼지, 닭, 양, 오리, 말, 토끼)를 무작위로 고른다.
  animalsPerFarm: 1,

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
  const param = new URLSearchParams(location.search).get('owners');
  if (param) {
    const list = param.split(',').map((s) => s.trim()).filter(Boolean);
    if (list.length) return list.slice(0, 48);
  }
  return CONFIG.owners;
}
