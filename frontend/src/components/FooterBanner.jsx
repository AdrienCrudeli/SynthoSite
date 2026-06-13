import { useEffect, useRef, useState } from 'react';

export default function FooterBanner() {
  const sentinelRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;

    if (!sentinel) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      {
        threshold: 0.1
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <>
      <div ref={sentinelRef} className="footer-banner-sentinel" aria-hidden="true" />
      <footer className={`footer-banner ${isVisible ? 'is-visible' : ''}`} aria-hidden={!isVisible}>
        <div className="footer-banner-inner">All rights reserved — SynthoSite ® 01.06.2026</div>
      </footer>
    </>
  );
}
