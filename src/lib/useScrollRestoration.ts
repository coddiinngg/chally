import { useEffect, useLayoutEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from "react";

/** 저장된 스크롤 위치가 있으면 true (= 이 페이지를 같은 세션에 방문한 적 있음).
 *  애니메이션 스킵, 캐시 시드 사용 여부 등을 결정할 때 사용. */
export function isReturningVisit(scrollKey: string): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(scrollKey) !== null;
}

/** sessionStorage에 자동 저장/복원되는 상태. 같은 세션 내에서 페이지를 다시 열면 마지막 값을 유지. */
export function usePersistedState<T extends string>(
  key: string,
  defaultValue: T,
  isValid?: (v: string) => v is T,
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return defaultValue;
    const saved = sessionStorage.getItem(key);
    if (saved === null) return defaultValue;
    if (isValid && !isValid(saved)) return defaultValue;
    return saved as T;
  });
  useEffect(() => {
    sessionStorage.setItem(key, state);
  }, [key, state]);
  return [state, setState];
}

/** number 버전 — 페이지네이션/오프셋 등 정수 상태 보존. */
export function usePersistedNumber(
  key: string,
  defaultValue: number,
): [number, Dispatch<SetStateAction<number>>] {
  const [state, setState] = useState<number>(() => {
    if (typeof window === "undefined") return defaultValue;
    const saved = sessionStorage.getItem(key);
    if (saved === null) return defaultValue;
    const n = Number(saved);
    return Number.isFinite(n) ? n : defaultValue;
  });
  useEffect(() => {
    sessionStorage.setItem(key, String(state));
  }, [key, state]);
  return [state, setState];
}

/**
 * 페이지 스크롤 위치를 sessionStorage에 저장하고, 마운트 시 복원.
 * `ready=false`이면 복원을 미룸 (데이터 로딩 완료 후 콘텐츠 높이가 확정된 뒤 복원하기 위해).
 *
 * 사용 예:
 *   const scrollRef = useRef<HTMLDivElement>(null);
 *   useScrollRestoration("stats-scroll", scrollRef, !loading);
 *   <div ref={scrollRef} className="overflow-y-auto">...</div>
 */
export function useScrollRestoration(
  key: string,
  scrollRef: RefObject<HTMLElement | null>,
  ready: boolean = true,
) {
  const restoredRef = useRef(false);

  useLayoutEffect(() => {
    if (restoredRef.current || !ready) return;
    const el = scrollRef.current;
    if (!el) return;
    const saved = sessionStorage.getItem(key);
    if (saved !== null) el.scrollTop = Number(saved);
    restoredRef.current = true;
  }, [ready]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => sessionStorage.setItem(key, String(el.scrollTop));
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);
}
