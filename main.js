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
   섹션 체류 추적
   지금 어느 섹션을 보고 있는지, 각 섹션을 얼마나 봤는지 센다.
   열람 종료 알림의 요약과 관리자 뷰(keeper)의 presence 가 함께 쓴다.

   탭이 보이는 동안만 센다. 배경에 띄워 둔 시간은 체류가 아니다.
   ============================================================ */
(function () {
  'use strict';

  var entries = [];      // { el, name }
  var dwell = {};        // 섹션명 → 누적 ms
  var current = null;
  var since = null;      // 현재 섹션을 보기 시작한 시각 (안 보이면 null)
  var listeners = [];

  // 표시는 한글로 통일한다. 제목은 한자·한글이 겹쳐 있으니 한글 쪽을 쓰고,
  // 겹쳐 있지 않은 제목(封 앞의 非公開)만 따로 적어 둔다.
  var KO = { '非公開': '비공개' };

  function nameOf(sec) {
    var h = sec.querySelector('h2');
    if (!h) return null;
    var ko = h.querySelector('.swap__ko');
    if (ko) {
      var k = ko.textContent.trim();
      if (k) return k;
    }
    var t = h.textContent.trim();
    return KO[t] || t || null;
  }

  function flush() {
    if (current && since !== null) {
      dwell[current] = (dwell[current] || 0) + (Date.now() - since);
    }
    since = null;
  }

  function resume() {
    if (current && document.visibilityState !== 'hidden') since = Date.now();
  }

  function setCurrent(name) {
    if (name === current) return;
    flush();
    current = name;
    resume();
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](current); } catch (e) {}
    }
  }

  var io = null;
  if ('IntersectionObserver' in window) {
    // 인덱스 강조와 같은 기준 — 화면 한가운데를 지나는 섹션이 '현재'다
    io = new IntersectionObserver(function (ens) {
      ens.forEach(function (en) {
        var hit = entries.filter(function (x) { return x.el === en.target; })[0];
        if (hit) hit.visible = en.isIntersecting;
      });
      var act = entries.filter(function (x) { return x.visible; })[0];
      setCurrent(act ? act.name : null);
    }, { rootMargin: '-45% 0px -45% 0px' });
  }

  function scan() {
    var secs = document.querySelectorAll('section');
    Array.prototype.forEach.call(secs, function (el) {
      if (entries.filter(function (x) { return x.el === el; })[0]) return;
      var n = nameOf(el);
      if (!n) return;
      entries.push({ el: el, name: n });
      if (io) io.observe(el);
    });
  }

  scan();

  // 잠금이 풀리면 非說·確認 이 새로 붙는다 — 그때 다시 훑는다
  var hydrate = window.__woonHydrate;
  window.__woonHydrate = function (root) {
    try { if (hydrate) hydrate(root); } finally { try { scan(); } catch (e) {} }
  };

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flush();
    else resume();
  });

  window.__woonSections = {
    current: function () { return current; },
    onChange: function (fn) { listeners.push(fn); },

    // 상위 3개를 "年代 6분 · 渴脈 3분" 으로 만들고 누적을 비운다.
    // 열람 종료 알림의 시간이 '그 구간'인 것과 눈금을 맞추려는 것이다.
    take: function () {
      flush();
      var arr = [];
      for (var k in dwell) {
        if (Object.prototype.hasOwnProperty.call(dwell, k) && dwell[k] >= 30000) {
          arr.push({ n: k, ms: dwell[k] });
        }
      }
      dwell = {};
      resume();
      arr.sort(function (a, b) { return b.ms - a.ms; });
      return arr.slice(0, 3).map(function (x) {
        var sec = Math.round(x.ms / 1000);
        return x.n + ' ' + (sec < 60 ? sec + '초' : Math.max(1, Math.round(sec / 60)) + '분');
      }).join(' · ');
    }
  };
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

    // presence 는 공개 채널이다. 익명 이름과 섹션명 말고는 아무것도 싣지 않는다.
    var joined = Date.now();
    var live = false;
    var timer = null;
    var lastPush = 0;

    function payload() {
      var secs = window.__woonSections;
      var nameFn = window.__woonName;
      return {
        at: joined,
        name: nameFn ? nameFn() : '익명의 방문자',
        section: (secs && secs.current()) || ''
      };
    }

    function push() {
      if (!live) return;
      lastPush = Date.now();
      try { channel.track(payload()); } catch (e) {}
    }

    // 스크롤할 때마다 보내지 않는다 — 4초에 한 번으로 묶는다
    function schedule() {
      if (!live || timer) return;
      timer = setTimeout(function () {
        timer = null;
        push();
      }, Math.max(0, 4000 - (Date.now() - lastPush)));
    }

    channel.subscribe(function (status) {
      try {
        if (status === 'SUBSCRIBED') {
          live = true;
          push();
          el.classList.add('is-live');
          render(1);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          disable();
        }
      } catch (e) { disable(); }
    });

    if (window.__woonSections) window.__woonSections.onChange(schedule);

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

   기기마다 '익명의 <동물>' 이름을 한 번 뽑아 localStorage 에 두고 계속 쓴다.
   알림에 표시하는 용도가 전부다 — 서버는 이 이름을 저장하지 않는다.

   내 기기에서는 알림을 보내지 않으려면 콘솔에서 한 줄:
     localStorage.setItem('woon-owner','1')
   해제하려면:
     localStorage.removeItem('woon-owner')

   실패는 전부 조용히 무시한다 — 페이지 동작에 영향을 주지 않는다.
   ============================================================ */
(function () {
  'use strict';

  var SESSION_KEY = 'woon-visit-sent';
  var NAME_KEY = 'woon-visitor-name';

  // 기기마다 한 번 뽑아 두는 익명 이름. 알림에 표시하는 용도가 전부이고
  // 서버에는 저장하지 않는다. 기기끼리 겹칠 수 있으나 상관없다.
  var ANIMALS = [
    '수달', '삵', '담비', '두루미', '너구리', '고슴도치', '청설모', '다람쥐',
    '여우', '늑대', '오소리', '족제비', '노루', '사슴', '멧토끼', '산양',
    '반달곰', '표범', '스라소니', '두더지', '박쥐', '물범', '돌고래', '고래',
    '수리부엉이', '소쩍새', '올빼미', '딱따구리', '물총새', '백로', '황새',
    '기러기', '원앙', '까치', '직박구리', '동박새', '참새', '제비', '종달새',
    '뜸부기', '물떼새', '갈매기', '가마우지', '황조롱이', '솔개', '두꺼비',
    '잠자리', '사마귀', '반딧불이', '개구리', '도롱뇽', '남생이', '잉어',
    '쏘가리', '은어', '가재', '달팽이', '나비'
  ];

  function pickAnimal() {
    var i;
    try {
      var a = new Uint32Array(1);
      crypto.getRandomValues(a);
      i = a[0] % ANIMALS.length;
    } catch (e) {
      i = Math.floor(Math.random() * ANIMALS.length);
    }
    return ANIMALS[i];
  }

  function visitorName() {
    var name;
    try {
      name = localStorage.getItem(NAME_KEY);
      if (!name || name.indexOf('익명의 ') !== 0 || name.length > 20) {
        name = '익명의 ' + pickAnimal();
        localStorage.setItem(NAME_KEY, name);
      }
    } catch (e) {
      // localStorage 를 못 쓰면 이름을 기억하지 못한다 — 매번 새로 뽑는다
      name = '익명의 ' + pickAnimal();
    }
    return name;
  }

  function isOwner() {
    try { return localStorage.getItem('woon-owner') === '1'; } catch (e) { return false; }
  }

  // presence 가 같은 이름을 쓴다
  window.__woonName = visitorName;

  window.__woonNotify = function (type, duration) {
    if (type !== 'visit' && type !== 'unlock' && type !== 'leave') return;
    if (isOwner()) return;
    var cfg = window.WOON_CONFIG || {};
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return;

    var url = cfg.SUPABASE_URL.replace(/\/+$/, '') + '/functions/v1/notify';
    var payload = { type: type, name: visitorName() };
    if (type === 'leave') {
      payload.duration = duration;
      var secs = window.__woonSections;
      if (secs) {
        var sum = secs.take();
        if (sum) payload.sections = sum;
      }
    }
    var body = JSON.stringify(payload);

    // 떠나는 순간의 일반 fetch 는 유실된다. sendBeacon 은 헤더를 못 붙이므로
    // text/plain 으로 보낸다 — 프리플라이트를 피하려는 것이고, 함수는
    // --no-verify-jwt 라 인증 헤더 없이도 받는다.
    if (type === 'leave' && navigator.sendBeacon) {
      try {
        if (navigator.sendBeacon(url, new Blob([body], { type: 'text/plain' }))) return;
      } catch (e) {}
    }

    try {
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': cfg.SUPABASE_ANON_KEY,
          'Authorization': 'Bearer ' + cfg.SUPABASE_ANON_KEY
        },
        body: body,
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

  /* --- 열람 종료 -------------------------------------------------------
     보이는 동안만 시간을 잰다. 탭을 가리면 그 구간을 닫아 종료 알림을 보내고,
     돌아오면 새 구간을 연다 — 구간마다 따로 세지, 합산하지 않는다.

     짧은 전환이 반복되면 알림이 시끄러워지므로 30초 미만 구간은 보내지 않는다.
     이 문턱은 첫 구간에도 똑같이 건다. 모바일에서 앱을 잠깐 바꾸거나 페이지를
     열자마자 닫는 경우가 흔한데, 그때마다 "3초 열람"이 오는 게 더 성가시다.

     이중 발송은 segStart 를 비우는 것으로 막는다. hidden 에서 보냈으면
     segStart 가 null 이라 뒤따르는 pagehide 는 아무것도 하지 않는다.
     --------------------------------------------------------------------- */
  var LEAVE_MIN_MS = 30000;
  var segStart = null;

  function openSegment() {
    if (segStart === null) segStart = Date.now();
  }

  function closeSegment() {
    if (segStart === null) return;
    var ms = Date.now() - segStart;
    segStart = null;
    if (ms < LEAVE_MIN_MS) return;
    window.__woonNotify('leave', Math.round(ms / 1000));
  }

  if (document.visibilityState !== 'hidden') openSegment();

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') closeSegment();
    else openSegment();
  });
  window.addEventListener('pagehide', closeSegment);
})();
