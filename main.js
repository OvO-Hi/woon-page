/* ============================================================
   [ 운 / 월영 / 파수 / 1품 / M ]
   토글 · 라이트박스 · 우측 인덱스 · 진입 모션 · 스크롤 실
   ============================================================ */
(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.remove('no-js');
  root.classList.add('js');

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var HOVER_INTENT = 140;
  var uid = 0;

  /* ── 토글 ────────────────────────────────────────────── */
  function setupToggle(toggle) {
    var head  = toggle.querySelector('.toggle__head');
    var panel = toggle.querySelector('.toggle__panel');
    var body  = toggle.querySelector('.toggle__body');
    if (!head || !panel || !body) return;

    if (!panel.id) panel.id = 'panel-' + (++uid);
    head.setAttribute('type', 'button');
    head.setAttribute('aria-controls', panel.id);
    head.setAttribute('aria-expanded', 'false');

    var fold = document.createElement('button');
    fold.type = 'button';
    fold.className = 'fold';
    fold.textContent = '접기';
    body.appendChild(fold);

    var timer = null;
    var hoverLock = false;   // "접기" 직후 호버 재펼침 차단. 커서가 벗어나면 해제.

    function open(byUser) {
      if (timer) { clearTimeout(timer); timer = null; }
      if (!byUser && hoverLock) return;
      if (toggle.classList.contains('is-open')) return;
      toggle.classList.add('is-open');
      head.setAttribute('aria-expanded', 'true');
    }
    function close() {
      if (timer) { clearTimeout(timer); timer = null; }
      toggle.classList.remove('is-open');
      head.setAttribute('aria-expanded', 'false');
    }

    // 접기 동작 (접기 버튼 / ^ 인디케이터 공용)
    function collapse() {
      hoverLock = true;            // close() 앞에 — head.focus() 가 focus 리스너를 깨운다
      close();
      if (head.getBoundingClientRect().top < 0) {
        head.scrollIntoView({ block: 'start', behavior: reduce.matches ? 'auto' : 'smooth' });
      }
      head.focus({ preventScroll: true });
    }

    // 제목을 직접 누르는 것은 명시적 의사 → 잠금 해제하고 펼침.
    // 단, 펼쳐진 상태에서 ^ 인디케이터를 누르면 접기 버튼과 동일하게 접는다.
    var ind = head.querySelector('.toggle__ind');
    head.addEventListener('click', function (e) {
      if (ind && (e.target === ind || ind.contains(e.target))
          && toggle.classList.contains('is-open')) {
        collapse();
        return;
      }
      hoverLock = false;
      open(true);
    });

    if (canHover) {
      toggle.addEventListener('mouseenter', function () {
        if (hoverLock || toggle.classList.contains('is-open')) return;
        timer = setTimeout(function () { open(false); }, HOVER_INTENT);
      });
      toggle.addEventListener('mouseleave', function () {
        if (timer) { clearTimeout(timer); timer = null; }
        hoverLock = false;          // 벗어났으니 다시 호버로 펼칠 수 있다
      });
      // 키보드 포커스로도 펼침 (접기 직후의 프로그램적 포커스는 잠금이 막는다)
      head.addEventListener('focus', function () { open(false); });
    }

    fold.addEventListener('click', function (e) {
      e.stopPropagation();
      collapse();
    });
  }
  Array.prototype.forEach.call(document.querySelectorAll('.toggle'), setupToggle);

  /* ── 진입 모션 (1회) ─────────────────────────────────── */
  var reveals = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    Array.prototype.forEach.call(reveals, function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        // 키 큰 요소(레일·연대기 항목 등)는 비율 0.15 에 도달하기 전에
        // 화면을 이미 채우므로 높이 기준으로도 통과시킨다
        var tall = en.boundingClientRect.height > window.innerHeight * 0.6;
        if (en.isIntersecting && (tall || en.intersectionRatio >= 0.15)) {
          en.target.classList.add('is-in');
          io.unobserve(en.target);
        }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: [0, 0.15] });
    Array.prototype.forEach.call(reveals, function (el) { io.observe(el); });
  }

  /* ── 우측 인덱스 — 현재 섹션 강조 ────────────────────── */
  var links = document.querySelectorAll('.index a[data-nav]');
  if (links.length && 'IntersectionObserver' in window) {
    var map = [];
    Array.prototype.forEach.call(links, function (a) {
      var target = document.getElementById(a.getAttribute('data-nav'));
      var sec = target && target.closest('section');
      if (sec) map.push({ link: a, sec: sec });
    });
    var navIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var hit = map.filter(function (m) { return m.sec === en.target; })[0];
        if (hit) hit.visible = en.isIntersecting;
      });
      var active = map.filter(function (m) { return m.visible; })[0];
      map.forEach(function (m) { m.link.classList.toggle('is-active', m === active); });
      // 활성 표식을 해당 점 위치로 미끄러뜨린다
      var cur = document.querySelector('.index__cursor');
      if (cur) {
        if (active) {
          var dot = active.link.querySelector('.index__dot');
          cur.style.transform = 'translateY(' + (dot.offsetTop + dot.offsetHeight / 2 - 2.5) + 'px)';
          cur.classList.add('on');
        } else {
          cur.classList.remove('on');
        }
      }
    }, { rootMargin: '-45% 0px -45% 0px' });
    map.forEach(function (m) { navIO.observe(m.sec); });
  }

  /* ── 스크롤 실 + 맨 위로 ─────────────────────────────── */
  var bar = document.querySelector('.thread span');
  var totop = document.querySelector('.totop');
  var ticking = false;

  function onScroll() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var y = window.scrollY || window.pageYOffset;
    if (bar) bar.style.height = (max > 0 ? (y / max) * 100 : 0) + '%';
    if (totop) totop.classList.toggle('is-on', y > 600);
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; window.requestAnimationFrame(onScroll); }
  }, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  onScroll();

  if (totop) {
    totop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduce.matches ? 'auto' : 'smooth' });
    });
  }

  /* ── 섹션 테마 — 물 → 마름 → 물 ────────────────────── */
  var themed = document.querySelectorAll('[data-theme]');
  if (themed.length && 'IntersectionObserver' in window) {
    var seen = [];
    var themeIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var i = seen.indexOf(en.target);
        if (en.isIntersecting) { if (i < 0) seen.push(en.target); }
        else if (i >= 0) { seen.splice(i, 1); }
      });
      // 가장 안쪽(나중에 선언된) 요소가 이긴다 — 脫胎 가 年代 를 덮어쓴다
      var win = seen[seen.length - 1];
      document.body.setAttribute('data-theme', win ? win.getAttribute('data-theme') : 'neutral');
    }, { rootMargin: '-42% 0px -42% 0px' });
    Array.prototype.forEach.call(themed, function (el) { themeIO.observe(el); });
  }

  /* ── 연대기 — 뷰포트 중앙의 사건만 또렷하게 ──────────── */
  var tl = document.querySelector('.tl');
  var tlItems = document.querySelectorAll('.tl__item');
  if (tl && tlItems.length && 'IntersectionObserver' in window && !reduce.matches) {
    tl.classList.add('js-focus');
    var focusIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        en.target.classList.toggle('is-focus', en.isIntersecting);
      });
    }, { rootMargin: '-38% 0px -38% 0px' });
    Array.prototype.forEach.call(tlItems, function (el) { focusIO.observe(el); });
  }

  /* ── 패럴럭스 — 傳承 먹 번짐 8px, 性情 배경 한자 16px ── */
  var succ = document.querySelector('.stain--succ');
  var glyphs = document.querySelectorAll('.chapter__glyph');
  if ((succ || glyphs.length) && !reduce.matches) {
    var succSection = succ && succ.closest('section');
    var parallaxTick = false;

    // 요소 중심이 뷰포트 중심에서 얼마나 떨어졌는지 (-1 ~ 1)
    function offset(el) {
      var r = el.getBoundingClientRect();
      return (r.top + r.height / 2 - window.innerHeight / 2) / window.innerHeight;
    }
    function clamp(v, n) { return Math.max(-n, Math.min(n, v)); }

    var runParallax = function () {
      if (succSection) {
        succ.style.transform =
          'translateY(' + clamp(-offset(succSection) * 8, 8).toFixed(2) + 'px)';
      }
      // 본문의 0.85배 속도 → 0.15배만큼 뒤처지되 16px 로 제한
      for (var g = 0; g < glyphs.length; g++) {
        var d = clamp(offset(glyphs[g]) * window.innerHeight * 0.15, 16);
        glyphs[g].style.setProperty('--par', d.toFixed(2) + 'px');
      }
      parallaxTick = false;
    };
    window.addEventListener('scroll', function () {
      if (!parallaxTick) { parallaxTick = true; window.requestAnimationFrame(runParallax); }
    }, { passive: true });
    window.addEventListener('resize', runParallax, { passive: true });
    runParallax();
  }

  /* ── 渴脈 구간에서는 쪽빛 실이 옅어진다 (물이 마르는 암시) ─ */
  var dry = document.querySelector('.section--dry');
  var thread = document.querySelector('.thread');
  if (dry && thread && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        thread.classList.toggle('is-dry', en.isIntersecting);
      });
    }, { rootMargin: '-30% 0px -30% 0px' }).observe(dry);
  }

  /* ── 두루마리 레이어는 다 걷히면 치운다 ───────────────── */
  var unroll = document.querySelector('.unroll');
  if (unroll) {
    setTimeout(function () { unroll.remove(); }, reduce.matches ? 0 : 1000);
  }

  /* ── 엔딩에 다다르면 빗줄기 1회 ──────────────────────── */
  /* 엔딩은 문서 끝이 아니라 好惡·非說·確認 앞의 간주 구간이므로,
     "최하단"이 아니라 엔딩이 화면을 채울 때 내려야 실제로 보인다 */
  var ending = document.querySelector('.ending');
  if (ending && !reduce.matches && 'IntersectionObserver' in window) {
    var rainIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.intersectionRatio >= 0.6) {
          ending.classList.add('is-raining');
          rainIO.disconnect();
        }
      });
    }, { threshold: [0, 0.6] });
    rainIO.observe(ending);
  }

  /* ── 마우스가 지난 자리의 물기 (渴脈 구간에서는 남지 않음) ─ */
  var trail = document.querySelector('.trail');
  if (trail && canHover && !reduce.matches) {
    var POOL = 14, drops = [], di = 0, lastX = -1e4, lastY = -1e4;
    for (var d = 0; d < POOL; d++) {
      var el = document.createElement('i');
      trail.appendChild(el);
      drops.push(el);
    }
    var dryRect = null;
    function measureDry() {
      var dryEl = document.querySelector('.section--dry');
      dryRect = dryEl ? dryEl.getBoundingClientRect() : null;
    }
    measureDry();
    window.addEventListener('scroll', measureDry, { passive: true });
    window.addEventListener('resize', measureDry, { passive: true });

    var pending = null, trailTick = false;
    function place() {
      trailTick = false;
      if (!pending) return;
      var x = pending.x, y = pending.y;
      pending = null;
      // 渴脈 구간 안에서는 물기가 남지 않는다
      if (dryRect && y >= dryRect.top && y <= dryRect.bottom) return;
      if (Math.abs(x - lastX) + Math.abs(y - lastY) < 34) return;
      lastX = x; lastY = y;
      var el = drops[di]; di = (di + 1) % POOL;
      el.classList.remove('on');
      void el.offsetWidth;                       // 애니메이션 재시작
      el.style.left = x + 'px';                  // 위치는 left/top,
      el.style.top  = y + 'px';                  // transform 은 애니메이션이 쓴다
      el.classList.add('on');
    }
    window.addEventListener('mousemove', function (e) {
      pending = { x: e.clientX, y: e.clientY };
      if (!trailTick) { trailTick = true; window.requestAnimationFrame(place); }
    }, { passive: true });
  }

  /* ── 라이트박스 ──────────────────────────────────────── */
  var box = document.getElementById('lightbox');
  if (!box) return;
  var closeBtn = box.querySelector('.lightbox__close');
  var opener = null;

  function openBox(from) {
    opener = from || null;
    box.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    if (closeBtn) closeBtn.focus({ preventScroll: true });
  }
  function closeBox() {
    box.classList.remove('is-open');
    document.body.style.overflow = '';
    if (opener) { opener.focus({ preventScroll: true }); opener = null; }
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-lightbox]'), function (btn) {
    btn.addEventListener('click', function () { openBox(btn); });
  });
  if (closeBtn) closeBtn.addEventListener('click', closeBox);
  box.addEventListener('click', function (e) { if (e.target === box) closeBox(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && box.classList.contains('is-open')) closeBox();
  });
})();
