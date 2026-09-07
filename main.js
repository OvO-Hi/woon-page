/* ============================================================
   [ 운 / 월영 / 파수 / 1품 / M ]
   토글 — 기본 접힘 / 데스크톱 호버로 펼침(유지) / "접기"로만 접힘
   ============================================================ */
(function () {
  'use strict';

  document.documentElement.classList.remove('no-js');
  document.documentElement.classList.add('js');

  var canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var HOVER_INTENT = 140; // 스치듯 지나갈 때 전부 열리지 않도록 하는 최소 체류 시간
  var uid = 0;

  function setup(toggle) {
    var head  = toggle.querySelector('.toggle__head');
    var panel = toggle.querySelector('.toggle__panel');
    var body  = toggle.querySelector('.toggle__body');
    if (!head || !panel || !body) return;

    // 패널 연결 (a11y)
    if (!panel.id) panel.id = 'panel-' + (++uid);
    head.setAttribute('type', 'button');
    head.setAttribute('aria-controls', panel.id);
    head.setAttribute('aria-expanded', 'false');

    // "접기" 버튼 — 모든 토글에 자동 삽입
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

    // 클릭 / 탭 — 펼침 전용. 접기는 "접기" 버튼으로만.
    head.addEventListener('click', open);

    // 데스크톱 호버 — 천천히 스르륵. 벗어나도 접히지 않음.
    if (canHover) {
      toggle.addEventListener('mouseenter', function () {
        if (toggle.classList.contains('is-open')) return;
        timer = setTimeout(open, HOVER_INTENT);
      });
      toggle.addEventListener('mouseleave', function () {
        if (timer) { clearTimeout(timer); timer = null; }
      });
      // 키보드 포커스로도 펼쳐지도록
      head.addEventListener('focus', open);
    }

    fold.addEventListener('click', function (e) {
      e.stopPropagation();
      close();
      // 접은 뒤 표제가 화면 밖으로 밀려나지 않게
      var top = head.getBoundingClientRect().top;
      if (top < 0) {
        head.scrollIntoView({
          block: 'start',
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
        });
      }
      head.focus({ preventScroll: true });
    });
  }

  var toggles = document.querySelectorAll('.toggle');
  for (var i = 0; i < toggles.length; i++) setup(toggles[i]);
})();
