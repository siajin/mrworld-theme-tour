// 프론트가 직접 쓰는 정적 이미지. 백엔드 시드(app/db/images.py)의 HERO_PHOTO 와 같은 사진.
const U = (id: string, w = 1600) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

export const HERO_IMAGE = U("photo-1780734790397-6dfa3329704c", 1800);

/** 이벤트 배너 보조 이미지 */
export const EVENT_IMAGES = {
  honeymoon: U("photo-1784136372956-75016550b0a8", 900),
  parents: U("photo-1522016480855-67a9f8416d98", 900),
  golf: U("photo-1535131749006-b7f58c99034b", 900),
  trekking: U("photo-1789045988719-0d87bc0b7c27", 900),
};
