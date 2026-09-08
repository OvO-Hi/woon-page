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

  var topbar = document.querySelector('.topbar');
  function onScroll() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var y = window.scrollY || window.pageYOffset;
    if (bar) bar.style.height = (max > 0 ? (y / max) * 100 : 0) + '%';
    if (totop) totop.classList.toggle('is-on', y > 600);
    if (topbar) topbar.classList.toggle('is-on', y > 140);
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

  /* ── 나중에 삽입되는 콘텐츠(비공개 구역)를 초기화한다 ─── */
  window.__woonHydrate = function (root) {
    if (!root) return;
    Array.prototype.forEach.call(root.querySelectorAll('.toggle'), setupToggle);
    var els = root.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(els, function (el) { el.classList.add('is-in'); });
    } else {
      Array.prototype.forEach.call(els, function (el) { io.observe(el); });
    }
  };

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
      if (document.body.classList.contains('is-still')) { parallaxTick = false; return; }
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

  /* ── 渴脈 마커: 화면 중앙에 든 항목만 활성 ──────────── */
  var railItems = document.querySelectorAll('.rail__item');
  if (railItems.length && 'IntersectionObserver' in window) {
    var railIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        en.target.classList.toggle('is-mid', en.isIntersecting);
      });
    }, { rootMargin: '-42% 0px -42% 0px' });
    Array.prototype.forEach.call(railItems, function (el) { railIO.observe(el); });
  }

  /* ── 渴脈: 쪽빛 실이 옅어지고, 4초 머물면 미세한 움직임이 멎는다 ─ */
  var dry = document.querySelector('.section--dry');
  var thread = document.querySelector('.thread');
  var stillTimer = null;
  if (dry && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (thread) thread.classList.toggle('is-dry', en.isIntersecting);
        if (stillTimer) { clearTimeout(stillTimer); stillTimer = null; }
        if (en.isIntersecting && !reduce.matches) {
          // 갈증의 정적 — 체류 4초 뒤 정지
          stillTimer = setTimeout(function () {
            document.body.classList.add('is-still');
          }, 4000);
        } else {
          document.body.classList.remove('is-still');
        }
      });
    }, { rootMargin: '-30% 0px -30% 0px' }).observe(dry);
  }

  /* ── 두루마리 레이어는 다 걷히면 치운다 ───────────────── */
  var unroll = document.querySelector('.unroll');
  if (unroll) {
    setTimeout(function () { unroll.remove(); }, reduce.matches ? 0 : 1000);
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


/* ============================================================
   실시간 익명 열람자 (Supabase Realtime Presence)
   키가 비어 있거나 연결에 실패하면 표시를 조용히 걷고 끝낸다.
   페이지 동작에는 어떤 경우에도 영향을 주지 않는다.
   ============================================================ */
(function () {
  'use strict';

  var el = document.querySelector('.viewers');
  if (!el) return;

  function disable() {
    try { el.parentNode && el.parentNode.removeChild(el); } catch (e) {}
  }

  var cfg = window.WOON_CONFIG || {};
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) { disable(); return; }

  var numEl = el.querySelector('.viewers__n');
  var tipEl = el.querySelector('.viewers__tip');
  var shown = null;

  function render(n) {
    if (!(n > 0)) n = 1;
    tipEl.textContent = '이 기록을 함께 열람 중인 자 ' + n + '인';
    if (n === shown) return;
    shown = n;
    // 0.4초 페이드로 갱신 — 혼자일 때는 점만 남긴다
    numEl.style.opacity = '0';
    setTimeout(function () {
      numEl.textContent = n > 1 ? ('열람 ' + n) : '';
      numEl.style.opacity = '1';
    }, 400);
  }

  function start() {
    var lib = window.supabase;
    if (!lib || typeof lib.createClient !== 'function') { disable(); return; }

    var client = lib.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
      realtime: { params: { eventsPerSecond: 2 } }
    });
    var me = 'v-' + Math.random().toString(36).slice(2, 10);
    var channel = client.channel(cfg.PRESENCE_CHANNEL || 'woon-page', {
      config: { presence: { key: me } }
    });

    channel.on('presence', { event: 'sync' }, function () {
      try { render(Object.keys(channel.presenceState()).length); } catch (e) {}
    });

    channel.subscribe(function (status) {
      try {
        if (status === 'SUBSCRIBED') {
          channel.track({ at: Date.now() });
          el.classList.add('is-live');
          render(1);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          disable();
        }
      } catch (e) { disable(); }
    });

    window.addEventListener('beforeunload', function () {
      try { channel.unsubscribe(); } catch (e) {}
    });
  }

  try {
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    s.async = true;
    s.onload = function () { try { start(); } catch (e) { disable(); } };
    s.onerror = disable;
    document.head.appendChild(s);
  } catch (e) { disable(); }
})();


/* ============================================================
   비공개 구역 잠금 — AES-GCM 복호화
   페이지에는 암호문만 실려 있고, 올바른 비밀번호로 키를 유도해야
   평문 HTML 이 만들어진다. 실패해도 페이지 나머지는 영향받지 않는다.

   비밀번호를 바꾸려면 build.py 의 GATE_PASSWORD 를 고치고
   GATE_VERSION 을 v2 로 올린 뒤 다시 빌드한다. 버전이 바뀌면
   기존 기기에 저장된 키가 무효가 되어 모두 다시 입력하게 된다.
   ============================================================ */
(function () {
  'use strict';

  var gate = document.getElementById('gate');
  var dataEl = document.getElementById('gate-data');
  if (!gate || !dataEl) return;

  var panel = gate.querySelector('.gate__panel');
  var form  = gate.querySelector('.gate__form');
  var input = gate.querySelector('.gate__input');
  var btn   = gate.querySelector('.gate__btn');
  var msg   = gate.querySelector('.gate__msg');
  var slot  = gate.querySelector('.gate__content');

  var payload;
  try { payload = JSON.parse(dataEl.textContent); } catch (e) { return; }
  var VERSION = gate.getAttribute('data-gate-version') || payload.v;
  var STORE = VERSION;                       // 예: woon-gate-v1

  var subtle = window.crypto && window.crypto.subtle;
  if (!subtle) {
    msg.textContent = '이 브라우저에서는 열람할 수 없습니다.';
    return;
  }

  function b64(s) {
    var bin = atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function toB64(buf) {
    var b = new Uint8Array(buf), s = '';
    for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s);
  }

  function deriveKey(pw) {
    return subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey'])
      .then(function (km) {
        return subtle.deriveKey(
          { name: 'PBKDF2', salt: b64(payload.salt), iterations: payload.it, hash: 'SHA-256' },
          km, { name: 'AES-GCM', length: 256 }, true, ['decrypt']);
      });
  }

  function decryptWith(key) {
    return subtle.decrypt({ name: 'AES-GCM', iv: b64(payload.iv) }, key, b64(payload.ct))
      .then(function (buf) { return new TextDecoder().decode(buf); });
  }

  function reveal(htmlText) {
    // 단일 래퍼로 감싼다 — grid-template-rows 0fr→1fr 은 자식이 하나여야
    // 전체가 접힌다 (섹션 둘을 그대로 넣으면 두 번째 행이 그냥 보인다)
    slot.innerHTML = '<div class="gate__inner"></div>';
    slot.firstChild.innerHTML = htmlText;
    slot.hidden = false;
    // 삽입된 토글·인용을 기존 스크립트에 물린다
    if (typeof window.__woonHydrate === 'function') window.__woonHydrate(slot);
    slot.style.height = '0px';
    void slot.offsetHeight;                       // 시작점 확정
    gate.classList.add('is-open');
    slot.style.height = slot.scrollHeight + 'px'; // 스크롤 점프 없이 펼친다
    var done = function () {
      slot.style.height = 'auto';                 // 이후 내용이 늘어도 따라가게
      slot.removeEventListener('transitionend', onEnd);
    };
    var onEnd = function (e) { if (e.propertyName === 'height') done(); };
    slot.addEventListener('transitionend', onEnd);
    setTimeout(done, 1200);                       // 모션 최소화 설정 대비
  }

  function remember(key) {
    subtle.exportKey('raw', key).then(function (raw) {
      try { localStorage.setItem(STORE, toB64(raw)); } catch (e) {}
    }).catch(function () {});
  }

  // 재방문 — 저장해둔 유도 키로 자동 복호화 (비밀번호 원문은 저장하지 않는다)
  var saved = null;
  try { saved = localStorage.getItem(STORE); } catch (e) {}
  if (saved) {
    subtle.importKey('raw', b64(saved), { name: 'AES-GCM' }, true, ['decrypt'])
      .then(decryptWith)
      .then(reveal)
      .catch(function () { try { localStorage.removeItem(STORE); } catch (e) {} });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var pw = input.value;
    if (!pw) return;
    btn.disabled = true;
    msg.classList.remove('is-error');
    msg.textContent = '';
    deriveKey(pw)
      .then(function (key) {
        return decryptWith(key).then(function (text) {
          remember(key);
          reveal(text);
          if (typeof window.__woonNotify === 'function') window.__woonNotify('unlock');
        });
      })
      .catch(function () {
        btn.disabled = false;
        input.value = '';
        msg.textContent = '일치하지 않습니다.';
        msg.classList.add('is-error');
        panel.classList.remove('is-wrong');
        void panel.offsetWidth;
        panel.classList.add('is-wrong');
        input.focus();
      });
  });
})();


/* ============================================================
   접속 / 잠금해제 알림
   Supabase Edge Function(notify)이 Discord 로 중계한다.
   웹훅 URL 은 함수의 secret 에만 있고 이 파일에는 없다.

   내 기기에서는 알림을 보내지 않으려면 콘솔에서 한 줄:
     localStorage.setItem('woon-owner','1')
   해제하려면:
     localStorage.removeItem('woon-owner')

   실패는 전부 조용히 무시한다 — 페이지 동작에 영향을 주지 않는다.
   ============================================================ */
(function () {
  'use strict';

  var SESSION_KEY = 'woon-visit-sent';

  function isOwner() {
    try { return localStorage.getItem('woon-owner') === '1'; } catch (e) { return false; }
  }

  window.__woonNotify = function (type) {
    if (type !== 'visit' && type !== 'unlock') return;
    if (isOwner()) return;
    var cfg = window.WOON_CONFIG || {};
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return;
    try {
      fetch(cfg.SUPABASE_URL.replace(/\/+$/, '') + '/functions/v1/notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': cfg.SUPABASE_ANON_KEY,
          'Authorization': 'Bearer ' + cfg.SUPABASE_ANON_KEY
        },
        body: JSON.stringify({ type: type }),
        keepalive: true
      }).catch(function () {});
    } catch (e) {}
  };

  // 방문 알림 — 세션당 1회
  try {
    if (!sessionStorage.getItem(SESSION_KEY)) {
      sessionStorage.setItem(SESSION_KEY, '1');
      window.__woonNotify('visit');
    }
  } catch (e) {
    window.__woonNotify('visit');
  }
})();
