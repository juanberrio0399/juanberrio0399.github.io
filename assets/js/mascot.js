// The mascot runs with the page. Once the header wolf leaves the screen, a second one appears in the
// right margin: it runs towards you while you scroll down, runs away when you scroll up, slows to a
// stop when you do, and waves at the contact section. It also drifts down and gets smaller towards the
// end of the page. The frames are pre-rendered and picked from one strip by scroll distance.
// No inline styles in the markup, so it fits script-src 'self'.
(function () {
  var hero = document.querySelector('.mascot');
  if (!hero || !('IntersectionObserver' in window)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var RUN = 12;                     // frames per run cycle
  var DOWN = 0, UP = 12, STAND = 24, WAVE = 25, LAST = 25;   // offsets in wolf-run.webp, left to right
  var STRIDE = 30;                  // pixels of scroll per frame
  var EASE = 0.16;

  var runner = document.createElement('div');
  runner.className = 'runner';
  runner.setAttribute('aria-hidden', 'true');
  var shadow = document.createElement('div');
  shadow.className = 'runner-s';
  var wolf = document.createElement('div');
  wolf.className = 'runner-w';
  runner.appendChild(shadow);
  runner.appendChild(wolf);
  document.body.appendChild(runner);

  var ready = false, past = false, atContact = false;
  var lastY = window.scrollY, travelled = 0, dir = 1, moving = false, rest = 0;
  var target = 0, now = 0, easing = false;

  function progress() {
    var h = document.documentElement, max = h.scrollHeight - h.clientHeight;
    return max > 0 ? Math.min(1, Math.max(0, h.scrollTop / max)) : 0;
  }
  function frame(i) {
    wolf.style.backgroundPosition = (i / LAST * 100) + '% 0';
  }
  function place() {
    var scale = 1 - 0.4 * now;
    runner.style.transform = 'translate3d(0,' + (now * 40).toFixed(2) + 'vh,0) scale(' + scale.toFixed(4) + ')';
    runner.style.opacity = ready && past ? '1' : '0';
  }
  function ease() {
    now += (target - now) * EASE;
    if (Math.abs(target - now) < 0.0004) { now = target; easing = false; } else requestAnimationFrame(ease);
    place();
  }
  function settle() {
    moving = false;
    runner.classList.remove('go');
    frame(atContact ? WAVE : STAND);
  }
  function onScroll() {
    var y = window.scrollY, d = y - lastY;
    lastY = y;
    if (d !== 0) {
      dir = d > 0 ? 1 : -1;
      travelled += Math.abs(d);
      if (!moving) { moving = true; runner.classList.add('go'); }
      frame((dir > 0 ? DOWN : UP) + Math.floor(travelled / STRIDE) % RUN);
      clearTimeout(rest);
      rest = setTimeout(settle, 170);
    }
    target = progress();
    if (!easing) { easing = true; requestAnimationFrame(ease); }
  }

  new IntersectionObserver(function (es) {
    past = !es[0].isIntersecting;
    place();
  }).observe(hero);

  var contact = document.getElementById('contact');
  if (contact) {
    new IntersectionObserver(function (es) {
      atContact = es[0].isIntersecting;
      if (!moving) settle();
    }, { threshold: 0.35 }).observe(contact);
  }

  // The strip is only fetched once the page is idle, so it never competes with the first paint.
  function load() {
    var img = new Image();
    img.onload = function () { runner.classList.add('ready'); ready = true; now = target = progress(); settle(); place(); };
    img.src = 'assets/img/wolf-run.webp';
  }
  if ('requestIdleCallback' in window) requestIdleCallback(load, { timeout: 2500 }); else setTimeout(load, 1200);

  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
})();
