import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function ScrollReveal() {
  const location = useLocation();

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: '0px 0px -8% 0px',
        threshold: 0.12
      }
    );

    const observedElements = new WeakSet();

    function observeElement(element) {
      if (!element?.classList?.contains('reveal-on-scroll')) {
        return;
      }

      if (element.classList.contains('is-visible') || observedElements.has(element)) {
        return;
      }

      observedElements.add(element);
      observer.observe(element);
    }

    function observeTree(root) {
      observeElement(root);
      root?.querySelectorAll?.('.reveal-on-scroll').forEach(observeElement);
    }

    observeTree(document);

    const mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          observeTree(node);
        });
      });
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
    };
  }, [location.pathname]);

  return null;
}
