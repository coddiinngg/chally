import type { LucideIcon } from "lucide-react";
import { Footprints, Activity, PenLine, BookOpen, Camera, MapPin } from "lucide-react";

export type VerifyTypeKey =
  | "step_walk"
  | "run_scenery"
  | "quote_photo"
  | "book_cover"
  | "celeb_pose"
  | "location_photo";

export interface VerifyTypeData {
  label: string;
  emoji: string;
  Icon: LucideIcon;
  desc: string;
  guide: string[];
  tip: string;
  hint: string;
  bgGrad: [string, string];
  /** 카메라 프레임 비율 */
  frameAspect: "portrait" | "landscape" | "square";
  /** AI가 확인하는 항목 */
  checklist: string[];
  /** 거절될 수 있는 이유 */
  rejectReasons: string[];
  /** 통과 예시 이미지 */
  exampleImg: string;
}

export const VERIFY_TYPES: Record<VerifyTypeKey, VerifyTypeData> = {
  step_walk: {
    label: "걷기 인증",
    emoji: "👟",
    Icon: Footprints,
    desc: "만보기 화면을 캡처해서 인증해요",
    guide: [
      "걸음 수가 보이는 만보기 앱 화면을 켜주세요",
      "오늘 날짜와 5,000보 이상 걸음 수가 함께 보여야 해요",
      "헬스앱·갤럭시 헬스·애플 건강·스마트워치 모두 OK",
    ],
    tip: "스마트워치 화면도 인정돼요! 걸음 수와 날짜가 동시에 보이면 완벽해요.",
    hint: "만보기 화면 전체를 프레임 안에 맞춰주세요",
    bgGrad: ["#FB923C", "#F59E0B"],
    frameAspect: "portrait",
    checklist: [
      "걸음 수 숫자 가독성",
      "오늘 날짜 표시 확인",
      "5,000보 이상 달성 여부",
      "공식 앱 화면 여부",
    ],
    rejectReasons: [
      "걸음 수 숫자가 보이지 않음",
      "날짜를 확인할 수 없음",
      "5,000보 미만",
      "캡처가 아닌 재촬영 의심",
    ],
    exampleImg: "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=600&fit=crop&q=80",
  },

  run_scenery: {
    label: "러닝 풍경",
    emoji: "🏃",
    Icon: Activity,
    desc: "러닝하면서 찍은 최애 풍경을 공유해요",
    guide: [
      "러닝 중 또는 완료 직후에 촬영해야 해요",
      "넓은 야외 풍경이 잘 보이도록 담아요",
      "새벽·공원·한강·해변 어디든 OK",
    ],
    tip: "GPS 러닝앱(나이키런·스트라바) 화면과 풍경을 같이 찍으면 인증률 UP!",
    hint: "야외 러닝 풍경을 넓게 담아주세요",
    bgGrad: ["#34d399", "#0EA5E9"],
    frameAspect: "portrait",
    checklist: [
      "야외 환경 확인",
      "러닝 흔적(앱·복장) 확인",
      "자연광 또는 충분한 밝기",
      "실내가 아닌 외부 공간",
    ],
    rejectReasons: [
      "실내에서 찍은 사진",
      "러닝 흔적이 전혀 없음",
      "너무 어두워서 장소 불명",
      "이전에 올린 사진과 동일",
    ],
    exampleImg: "https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=600&fit=crop&q=80",
  },

  quote_photo: {
    label: "인상 문장",
    emoji: "✍️",
    Icon: PenLine,
    desc: "오늘 곱씹게 되는 문장을 사진으로 남겨요",
    guide: [
      "책·신문·노트 등 어떤 글이든 OK",
      "문장이 선명하게 읽힐 만큼 가까이 찍어요",
      "손글씨 필사본도 환영해요",
    ],
    tip: "왜 인상 깊었는지 댓글로 나눠요! 공감이 많으면 보너스 포인트!",
    hint: "인상 깊은 문장을 또렷하게 담아주세요",
    bgGrad: ["#A78BFA", "#7C3AED"],
    frameAspect: "square",
    checklist: [
      "텍스트 선명도 (블러 없음)",
      "문장 전체 가독성",
      "출처(책·노트) 확인",
      "한국어·영어 텍스트 인식",
    ],
    rejectReasons: [
      "글자가 흐릿하거나 초점 없음",
      "문장이 잘려서 내용 파악 불가",
      "빛 반사로 텍스트 안 보임",
      "텍스트가 아닌 다른 콘텐츠",
    ],
    exampleImg: "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=600&fit=crop&q=80",
  },

  book_cover: {
    label: "책 표지",
    emoji: "📚",
    Icon: BookOpen,
    desc: "지금 읽고 있는 책 표지를 찍어요",
    guide: [
      "표지에 제목과 저자명이 보여야 해요",
      "밝은 곳에서 표지가 전체 나오도록 찍어요",
      "전자책 화면도 OK",
    ],
    tip: "한 줄 감상을 댓글로 남기면 포인트 2배! 다른 멤버에게도 도움이 돼요.",
    hint: "책 표지 전체를 프레임 안에 맞춰주세요",
    bgGrad: ["#FB923C", "#F97316"],
    frameAspect: "portrait",
    checklist: [
      "책 제목 가독성",
      "저자명 확인",
      "표지 전체 노출 여부",
      "실물 책 또는 전자책 화면",
    ],
    rejectReasons: [
      "제목 또는 저자가 잘림",
      "너무 멀리서 찍어 글자 안 보임",
      "조명 부족으로 표지 불분명",
      "이미 오늘 인증한 동일 표지",
    ],
    exampleImg: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=600&fit=crop&q=80",
  },

  celeb_pose: {
    label: "포즈 인증",
    emoji: "📸",
    Icon: Camera,
    desc: "오늘의 지정 포즈로 사진을 찍어요",
    guide: [
      "오늘의 지정 포즈를 따라해요 (가이드 이미지 참고)",
      "전신 또는 상반신 모두 OK",
      "얼굴이 보여야 인증이 완료돼요",
    ],
    tip: "친구와 함께 찍으면 2인 도전 보너스! 같은 포즈라도 OK.",
    hint: "전신 또는 상반신이 프레임 안에 들어오게 찍어주세요",
    bgGrad: ["#FF3355", "#FF6680"],
    frameAspect: "portrait",
    checklist: [
      "포즈 유사도 (지정 포즈와 비교)",
      "얼굴 노출 여부",
      "전신·상반신 확인",
      "실내·외 무관 적절한 밝기",
    ],
    rejectReasons: [
      "지정 포즈와 전혀 다른 자세",
      "얼굴이 가려져 있음",
      "몸이 잘려서 포즈 확인 불가",
      "너무 어두워서 구분 불가",
    ],
    exampleImg: "https://images.unsplash.com/photo-1552196563-55cd4e45efb3?w=600&fit=crop&q=80",
  },

  location_photo: {
    label: "장소 인증",
    emoji: "📍",
    Icon: MapPin,
    desc: "목표한 장소에서 사진을 찍어요",
    guide: [
      "지정 장소 또는 목표 장소에서 찍어요",
      "장소 간판·랜드마크·특징이 보이면 더 좋아요",
      "GPS 체크인 화면을 함께 찍어도 OK",
    ],
    tip: "장소 이름을 댓글에 남겨요! 멤버들이 새 장소를 발견할 수 있어요.",
    hint: "장소의 특징이 잘 보이게 담아주세요",
    bgGrad: ["#38BDF8", "#0284C7"],
    frameAspect: "portrait",
    checklist: [
      "장소 특징(간판·건물) 확인",
      "실외 또는 특정 공간 여부",
      "낮 시간대 또는 충분한 밝기",
      "GPS 위치 일치 여부",
    ],
    rejectReasons: [
      "장소를 특정할 수 없음",
      "너무 어두워서 배경 불명",
      "이전 사진 재사용 의심",
      "실내 일반 공간 (무의미한 장소)",
    ],
    exampleImg: "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=600&fit=crop&q=80",
  },
};

export const VERIFY_TYPE_KEYS = Object.keys(VERIFY_TYPES) as VerifyTypeKey[];
