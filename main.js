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
        if (en.isIntersecting) {
          en.target.classList.add('is-in');
          io.unobserve(en.target);
        }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.15 });
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
