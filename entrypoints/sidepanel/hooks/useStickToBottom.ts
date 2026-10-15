import { useEffect, useRef } from "react";

// Theo dõi người dùng có đang ở gần cuối trang hay không.
// Container cuộn của sidepanel là document (main dùng min-h-screen), nên lắng nghe scroll của window.
export function useStickToBottom(threshold = 80) {
  const stickRef = useRef(true);

  useEffect(() => {
    const handleScroll = () => {
      const el = document.scrollingElement ?? document.documentElement;
      stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [threshold]);

  return stickRef;
}
