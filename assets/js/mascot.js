// The mascot follows the scroll: once the header wolf leaves the screen, a second one appears in the
// right margin, turns on itself as the page moves and drifts away, getting smaller towards the end.
// It is a strip of pre-rendered frames scrubbed by scroll position, eased so it never jumps.
// No inline styles in the markup, so it fits script-src 'self'.
(function () {
  var hero = document.querySelector('.mascot');
  if (!hero || !('IntersectionObserver' in window)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var FRAMES = 32;        // one full turn in wolf-turn.webp, left to right
  var TURNS = 2;          // full turns over the whole page
  var EASE = 0.14;

  var orbit = document.createElement('div');
  orbit.className = 'orbit';
  orbit.setAttribute('aria-hidden', 'true');
  var shadow = document.createElement('div');
  shadow.className = 'orbit-s';
  var wolf = document.createElement('div');
  wolf.className = 'orbit-w';
  orbit.appendChild(shadow);
  orbit.appendChild(wolf);
  document.body.appendChild(orbit);

  var target = 0, now = 0, running = false, ready = false, past = false;

  function progress() {
    var h = document.documentElement, max = h.scrollHeight - h.clientHeight;
    return max > 0 ? Math.min(1, Math.max(0, h.scrollTop / max)) : 0;
  }
  function draw() {
    var frame = ((Math.round(now * TURNS * FRAMES) % FRAMES) + FRAMES) % FRAMES;
    wolf.style.backgroundPosition = (frame / (FRAMES - 1) * 100) + '% 0';
    var scale = 1 - 0.45 * now;
    orbit.style.transform = 'translate3d(0,' + (now * 38).toFixed(2) + 'vh,0) scale(' + scale.toFixed(4) + ')';
    orbit.style.opacity = ready && past ? (1 - 0.3 * now).toFixed(3) : '0';
  }
  function tick() {
    now += (target - now) * EASE;
    if (Math.abs(target - now) < 0.0004) { now = target; running = false; } else requestAnimationFrame(tick);
    draw();
  }
  function kick() {
    target = progress();
    if (!running) { running = true; requestAnimationFrame(tick); }
  }

  new IntersectionObserver(function (es) {
    past = !es[0].isIntersecting;
    draw();
  }).observe(hero);

  // The strip is only fetched once the page is idle, so it never competes with the first paint.
  function load() {
    var img = new Image();
    img.onload = function () { orbit.classList.add('ready'); ready = true; now = target = progress(); draw(); };
    img.src = 'assets/img/wolf-turn.webp';
  }
  if ('requestIdleCallback' in window) requestIdleCallback(load, { timeout: 2500 }); else setTimeout(load, 1200);

  addEventListener('scroll', kick, { passive: true });
  addEventListener('resize', kick);
})();
