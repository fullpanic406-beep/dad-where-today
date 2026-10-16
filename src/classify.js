// 서울시 문화행사 CODENAME → 앱 카테고리
export const CATEGORIES = {
  festival: '축제',
  show: '공연',
  exhibit: '전시',
  edu: '체험·교육',
  kidscafe: '키즈카페',
  etc: '기타',
};

export function categoryOf(codename = '') {
  if (/축제/.test(codename)) return 'festival';
  if (/교육|체험/.test(codename)) return 'edu';
  if (/전시|미술/.test(codename)) return 'exhibit';
  if (/콘서트|클래식|국악|연극|뮤지컬|오페라|무용|독주|독창|공연/.test(codename)) return 'show';
  return 'etc';
}

// 아이와 가기 좋은 행사 추정 (휴리스틱 — 대상/제목/프로그램 문구 기반)
const KID_TARGET = /어린이|유아|영유아|아동|가족|초등|키즈|아이/;
const STRONG_TEXT = /어린이|유아|가족|아이와|키즈|동화|인형극|그림책|가족극/; // 제목만으로도 아이 대상
const WEAK_TEXT = /체험|놀이|동요/;                                           // 대상이 열려 있을 때만 참고
const OPEN_TARGET = /^$|제한\s?없음|누구나|전체|전\s?연령|서울시민/;
const ADULT_ONLY = /^(성인|만\s?19|19세|미성년자\s?(관람)?불가)/;

export function isFamily({ title = '', target = '', category = '', program = '' }) {
  const t = target.trim();
  if (KID_TARGET.test(t)) return 1;
  if (ADULT_ONLY.test(t)) return 0;
  if (STRONG_TEXT.test(title)) return 1;
  // 대상이 '청소년~성인', '시니어' 등으로 따로 정해져 있으면 제목의 '체험' 같은 말로 판단하지 않는다
  if (OPEN_TARGET.test(t) && WEAK_TEXT.test(title)) return 1;
  if (OPEN_TARGET.test(t) && category === 'edu' && STRONG_TEXT.test(program)) return 1;
  return 0;
}
