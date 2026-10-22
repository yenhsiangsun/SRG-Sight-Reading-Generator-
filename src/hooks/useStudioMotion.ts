import {useLayoutEffect, useRef, type RefObject} from 'react';

const ease = 'cubic-bezier(.22, 1, .36, 1)';

type Entrance = {element: Element | null; delay?: number; x?: number; y?: number};

/** Animate presentation only: never delay navigation or remount music/audio state. */
function enter(items: Entrance[], duration = 420) {
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (preference.matches) return;
  const animations: Animation[] = [];
  for (const {element, delay = 0, x = 0, y = 0} of items) {
    if (!element || typeof element.animate !== 'function') continue;
    const animation = element.animate([
      {opacity: .18, transform: x || y ? `translate(${x}px, ${y}px)` : 'none'},
      {opacity: 1, transform: 'none'},
    ], {duration, delay, easing: ease, fill: 'backwards'});
    animations.push(animation);
  }
  const cancel = () => animations.forEach(animation => animation.cancel());
  const onPreference = () => { if (preference.matches) cancel(); };
  preference.addEventListener('change', onPreference);
  return () => {
    cancel();
    preference.removeEventListener('change', onPreference);
  };
}

export function useStudioPageMotion(root: RefObject<HTMLDivElement | null>, page: string, studyNumber?: number) {
  const previous = useRef({page, studyNumber});
  useLayoutEffect(() => {
    const old = previous.current;
    previous.current = {page, studyNumber};
    const container = root.current;
    if (!container) return;
    const find = (selector: string) => container.querySelector(selector);
    // A new score fades in without moving its measured SVG or resetting controls.
    if (old.page === page && old.studyNumber !== studyNumber && page === 'practice') {
      // Applying a setup or focused study replaces the keyed action button.
      // Recover only the focus lost to body; leave other controls and modals alone.
      if (document.activeElement === document.body && !document.querySelector('dialog[open]')) {
        const heading = find('#score-heading') as HTMLElement | null;
        if (heading) {
          heading.tabIndex = -1;
          heading.focus({preventScroll: true});
        }
      }
      return enter([{element: find('.score-card')}], 300);
    }
    if (old.page !== page) {
      const heading = find('main h1, main h2') as HTMLElement | null;
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({preventScroll: true});
      }
    }
    if (page === 'home') return enter([
      {element: find('.home-heading'), y: 6},
      {element: find('.atelier-hero'), delay: 40, y: 10},
      {element: find('.atelier-content-grid'), delay: 85, y: 8},
    ]);
    if (page === 'setup') return enter([
      {element: find('.setup-intro'), y: 6},
      {element: find('.setup-panel'), delay: 45, y: 10},
    ]);
    return enter([
      {element: find('.practice-heading')},
      {element: find('.practice-title'), delay: 30, y: 6},
      // Opacity only keeps sticky controls and score hit-testing in place.
      {element: find('.practice-toolbar'), delay: 65},
      {element: find('.score-card'), delay: 95},
    ]);
  }, [root, page, studyNumber]);
}

export function useSetupStepMotion(panel: RefObject<HTMLElement | null>, step: number) {
  const previous = useRef(step);
  useLayoutEffect(() => {
    const old = previous.current;
    previous.current = step;
    if (old === step || !panel.current) return;
    const container = panel.current;
    const heading = container.querySelector<HTMLElement>('#setup-title');
    heading?.focus({preventScroll: true});
    // Next is often pressed at the bottom of a long instrument list.
    const top = container.getBoundingClientRect().top;
    if (top < 0 || top > window.innerHeight * .65) {
      container.scrollIntoView({block: 'start', behavior: 'instant'});
    }
    const x = step > old ? 10 : -10;
    return enter([
      {element: container.querySelector('.panel-heading h2'), x},
      {element: container.querySelector('.setup-content'), delay: 35, x},
    ], 340);
  }, [panel, step]);
}
