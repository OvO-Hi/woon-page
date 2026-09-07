/* ============================================================
   [ 운 / 월영 / 파수 / 1품 / M ]
   토글 — 기본 접힘 / 데스크톱 호버로 펼침(유지) / "접기"로만 접힘
   라이트박스 — 外貌 이미지 클릭 시 전신 원본
   ============================================================ */
(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.remove('no-js');
  root.classList.add('js');

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var HOVER_INTENT = 140; // 스치듯 지나갈 때 전부 열리지 않도록
  var uid = 0;

  /* ── 토글 ────────────────────────────────────────────── */
  function setup(toggle) {
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

    function open() {
      if (timer) { clearTimeout(timer); timer = null; }
      if (toggle.classList.contains('is-open')) return;
      toggle.classList.add('is-open');
      head.setAttribute('aria-expanded', 'true');
    }
    function close() {
      if (timer) { clearTimeout(timer); timer = null; }
      toggle.classList.remove('is-open');
      head.setAttribute('aria-expanded', 'false');
    }

    head.addEventListener('click', open);

    if (canHover) {
      toggle.addEventListener('mouseenter', function () {
        if (toggle.classList.contains('is-open')) return;
        timer = setTimeout(open, HOVER_INTENT);
      });
      toggle.addEventListener('mouseleave', function () {
        if (timer) { clearTimeout(timer); timer = null; }
      });
      head.addEventListener('focus', open);
    }

    fold.addEventListener('click', function (e) {
      e.stopPropagation();
      close();
      var top = head.getBoundingClientRect().top;
      if (top < 0) {
        head.scrollIntoView({ block: 'start', behavior: reduce.matches ? 'auto' : 'smooth' });
      }
      head.focus({ preventScroll: true });
    });
  }

  var toggles = document.querySelectorAll('.toggle');
  for (var i = 0; i < toggles.length; i++) setup(toggles[i]);

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

  var triggers = document.querySelectorAll('[data-lightbox]');
  for (var j = 0; j < triggers.length; j++) {
    (function (btn) {
      btn.addEventListener('click', function () { openBox(btn); });
    })(triggers[j]);
  }

  if (closeBtn) closeBtn.addEventListener('click', closeBox);
  box.addEventListener('click', function (e) {
    if (e.target === box) closeBox();   // 배경 클릭
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && box.classList.contains('is-open')) closeBox();
  });
})();
