// The mascot keeps you company down the page: once the header wolf scrolls out of view,
// a small one appears in the corner, walks while you scroll, stands when you stop and
// waves at the contact section. No inline styles in the markup, so it fits script-src 'self'.
(function () {
  var hero = document.querySelector('.mascot');
  if (!hero || !('IntersectionObserver' in window)) return;

  var STEPS = 8, STAND = 8, WAVE = 9, LAST = 9;   // frames in wolf-steps.webp, left to right
  var STRIDE = 34;                                // pixels of scroll per step
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var buddy = document.createElement('div');
  buddy.className = 'buddy';
  buddy.setAttribute('aria-hidden', 'true');
  document.body.appendChild(buddy);

  var atContact = false, travelled = 0, lastY = window.scrollY, rest = 0, queued = false;

  function show(frame) {
    buddy.style.backgroundPosition = (frame / LAST * 100) + '% 0';
  }
  function settle() {
    show(atContact ? WAVE : STAND);
  }

  new IntersectionObserver(function (es) {
    buddy.classList.toggle('on', !es[0].isIntersecting);
  }).observe(hero);

  var contact = document.getElementById('contact');
  if (contact) {
    new IntersectionObserver(function (es) {
      atContact = es[0].isIntersecting;
      settle();
    }, { threshold: 0.35 }).observe(contact);
  }

  function step() {
    queued = false;
    var y = window.scrollY;
    travelled += Math.abs(y - lastY);
    lastY = y;
    if (!calm) show(Math.floor(travelled / STRIDE) % STEPS);
    clearTimeout(rest);
    rest = setTimeout(settle, 220);
  }
  addEventListener('scroll', function () {
    if (!queued) { queued = true; requestAnimationFrame(step); }
  }, { passive: true });

  settle();
})();
