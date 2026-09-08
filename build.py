# -*- coding: utf-8 -*-
import io, re, html, os, json, base64, hashlib

# ── 비공개 구역 암호화 설정 ─────────────────────────────
# 비밀번호를 바꾸려면: GATE_PASSWORD 를 고치고 GATE_VERSION 을 v2 로 올린 뒤
# 다시 빌드한다. 버전이 바뀌면 기존 기기의 저장된 키가 무효가 되어 전부 재입력한다.
# 비밀번호는 저장소에 두지 않는다. gate.pw(.gitignore) 파일이나
# 환경변수 WOON_GATE_PW 에서 읽는다.
def _gate_password():
    pw = os.environ.get('WOON_GATE_PW')
    if pw:
        return pw.strip()
    try:
        return io.open('gate.pw', encoding='utf-8').read().strip()
    except IOError:
        raise SystemExit('gate.pw 가 없습니다. 비밀번호를 담은 gate.pw 를 만들거나 '
                         'WOON_GATE_PW 환경변수를 설정하세요.')

GATE_PASSWORD = _gate_password()

def _secrets():
    """비공개 값(계정·인증 링크·답변)은 secret.txt(.gitignore)에서 읽는다.
    저장소에 올라가는 스크립트에는 평문을 두지 않는다."""
    try:
        raw = [l.strip() for l in io.open('secret.txt', encoding='utf-8') if l.strip()]
    except IOError:
        raise SystemExit('secret.txt 가 없습니다. 비공개 값을 담은 secret.txt 를 만드세요.')
    d, key = {}, None
    for l in raw:
        if l.startswith('[') and l.endswith(']'):
            key = l[1:-1]
        elif key:
            d[key] = l
    return d

SECRET = _secrets()
GATE_VERSION  = 'woon-gate-v1'
PBKDF2_ITERS  = 310000


raw = [l.rstrip('\n') for l in io.open('content.txt', encoding='utf-8')]

H = ['외관','이름','나이','신장 / 체중','성격',
'무던 / 능청 / 화이불류和而不流(어울리되 휩쓸리지 아니한다.)',
'참견 / 수습 / 不踰矩 불유구(법도와 분수를 넘지 아니한다)',
'진중 / 잔정 / 회자정리會者定離','진영','전승한 요괴 또는 신수 종류','그릇과 이능력',
'一. 생체','二. 물','三. 피를 멎게 하는 법','부작용','평시','과용','폭주','등급','포지션','기타',
'탄생과 유년','집안과 이별','師 스승','脫胎 탈태','雲林 운림','유화가 죽고','行旅 떠돈 세월','月影 월영',
'목소리','水, 물','길라','수계 파수','잡다한 용처','호오','습관.',
'캐릭터 및 오너 선호/기피플','아래는 비공개 사항입니다.','비설','연락 가능한 계정','성인인증',
'통합문서 확인 및 신청서 작성을 완료하신 분들께서는 아래의 질문에 답하여주세요.']

pos = {}
for i, l in enumerate(raw):
    t = l.strip()
    if t in H and t not in pos:
        pos[t] = i
order = sorted(pos.items(), key=lambda kv: kv[1])
B = {}
for n, (h, i) in enumerate(order):
    end = order[n+1][1] if n+1 < len(order) else len(raw)
    B[h] = [x.strip() for x in raw[i+1:end] if x.strip()]

HERO_Q = [x.strip() for x in raw[:pos['외관']] if x.strip()][0]
HERO_Q = '"남은 물 좀 가진 게 있나?"'   # 교체 지시 — 인용 스타일은 그대로
# 따옴표가 없어도 대사로 다룰 줄
SPEECH = {'물을 가까이 하게 하시오.', '이 매듭만큼은 쉬이 끊어지지 않도록 하고.',
          '저 아이 가까이에는 복이 붙지 않는다.',
          '남들이야 몰라서 의심할 수 있지.', '저 사람은 아니겠지.',
          '너는 내가 아닌 줄 알았잖아.'}
# 화자가 운이 아닌 대사 — 캡션을 생략하거나 師 로 단다
MASTER = {'“사람을 살리겠다 데려가서는, 어디다 쓸지부터 헤아리더구나.”',
          '“칼끝만 들여다보고 살면 사람을 만나도 벨 자리부터 보인다. 그러니 눈부터 좀 넓혀두어.”',
          '“살다 보면 정말 갈 데 하나 없는 날도 온다. 그때가 오면 유화라는 이름이나 기억해두어.”'}
NOBY = {'“저 집 아이가 난 뒤로 하늘이 영 메말랐구먼.”',
        '물을 가까이 하게 하시오.', '이 매듭만큼은 쉬이 끊어지지 않도록 하고.',
        '저 아이 가까이에는 복이 붙지 않는다.'}

def byline(lines):
    if any(t in NOBY for t in lines):
        return ''
    who = '師' if any(t in MASTER for t in lines) else '雲'
    return '<p class="quote__by">&mdash; ' + who + '</p>'

def e(t):
    return html.escape(t, quote=False)

def sw(han, ko):
    return ('<span class="swap"><span class="swap__han">' + e(han) +
            '</span><span class="swap__ko">' + e(ko) + '</span></span>')

def sechead(no, hid, han, ko, sub=None):
    subp = ('\n        <p class="head__ko">' + e(sub) + '</p>') if sub else ''
    return ('<div class="head">\n'
            '        <span class="head__no">' + e(no) + '</span>\n'
            '        <h2 class="head__han reveal" id="' + hid + '">' + sw(han, ko) + '</h2>' +
            subp + '\n      </div>')

def isq(t):
    return (t.startswith('“') and t.endswith('”')) or (t.startswith('"') and t.endswith('"'))

# 본문 안에서 굵게 둘 문장 (원문 그대로, 배치만 강조)
BOLD = [
  '그 이후부터는 길고 긴 열병이 시작되었다.',
  '강철이에게 받은 기가 막 열린 그릇 안에서 미친 듯 날뛰었다. 조종자를 잃은 갈맥은 사람을 가리지 않았다',
  '근방에 있던 귀족가의 어린 혈족 하나 또한 그날의 갈맥에서 살아남지 못하였다.',
  '운의 스승도 그러했다.',
  '그날 이후 운은 오랫동안 쫓기는 신세가 되었다.',
  '운은 그때 처음으로 사람 목숨에도 값이 다를 수 있다는 것을 선명히 익혔다.',
  '귀족이라는 말을 들으면 속으로 먼저 한 번 삐딱하게 재어보는 정도의 악습은 아직 남아있다.',
  '남은 곳 가운데 제 몸 하나쯤 받아줄 만한 데가 그곳뿐이었기 때문이었다.',
  '제 손에 맡겨진 일이라면 끝을 볼 것. 벌인 일의 화禍를 남의 등에 떠넘기지 않을 것. 그리고 가능하다면 남이 먹고사는 터전만큼은 함부로 건드리지 않을 것.',
]
SUBLABEL = {'師傳 사전'}

def emph(t):
    """이스케이프한 뒤 지정 문장만 <strong> 로 감싼다. 글자는 손대지 않는다."""
    out = e(t)
    for phrase in BOLD:
        for cand in (phrase + '.', phrase):      # 마침표까지 포함되면 함께 감싼다
            k = e(cand)
            if k in out and '<strong>' + k not in out:
                out = out.replace(k, '<strong>' + k + '</strong>', 1)
                break
    return out

CAPMARK = {'— 雲': '雲', '— 師': '師'}

def body(lines, ind='        ', auto_caption=True):
    """auto_caption=False 면 원문에 '— 雲' 마커가 붙은 대사에만 캡션을 단다."""
    out, buf = [], []
    def flush():
        if buf:
            cap = byline(buf) if auto_caption else ''
            out.append(ind + '<blockquote class="quote reveal">' +
                       ''.join('<p>' + e(x) + '</p>' for x in buf) +
                       cap + '</blockquote>')
            del buf[:]
    for t in lines:
        if t in CAPMARK:
            flush()
            tail = '</blockquote>'
            # 자동 캡션이 이미 붙었으면 마커는 삼키기만 한다 (중복 방지)
            if out and out[-1].endswith(tail) and 'quote__by' not in out[-1]:
                out[-1] = (out[-1][:-len(tail)] +
                           '<p class="quote__by">&mdash; ' + CAPMARK[t] + '</p>' + tail)
            continue
        if isq(t) or t in SPEECH:
            buf.append(t)
        elif t in SUBLABEL:
            flush(); out.append(ind + '<p class="sublabel">' + e(t) + '</p>')
        else:
            flush(); out.append(ind + '<p>' + emph(t) + '</p>')
    flush()
    return '\n'.join(out)

def lead_split(lines):
    first = lines[0]
    m = re.match(r'^(.+?[.?!])\s+(\S.*)$', first)
    if m:
        return m.group(1), [m.group(2)] + lines[1:]
    return first, lines[1:]

def toggle(inner_head, lines, cls='', attr=''):
    return ('<div class="toggle' + ((' ' + cls) if cls else '') + '"' + attr + '>\n'
            '            <button class="toggle__head">\n'
            '              <span class="toggle__title">' + inner_head + '</span>\n'
            '              <span class="toggle__ind" aria-hidden="true"></span>\n'
            '            </button>\n'
            '            <div class="toggle__panel"><div class="toggle__inner"><div class="toggle__body prose">\n'
            + body(lines, '              ') + '\n'
            '            </div></div></div>\n'
            '          </div>')

# ── 프로필 ────────────────────────────────────────────────
nm = B['이름']; name_v, name_sub = nm[0], nm[1:]
REC = [('姓名','이름',   name_v, ''.join('<span class="sub">'+e(x)+'</span>' for x in name_sub), 'record__row--name'),
       ('年齡','나이',   B['나이'][0], '', ''),
       ('身長 / 體重','신장 / 체중', B['신장 / 체중'][0], '', ''),
       ('所屬','진영',   B['진영'][0], '', ''),
       ('等級','등급',   B['등급'][0], '', ''),
       ('位','포지션',   B['포지션'][0], '', '')]
record = '\n        '.join(
    '<div class="record__row ' + cls + '"><dt>' + sw(han, ko) + '</dt><dd>' + e(val) + extra + '</dd></div>'
    for han, ko, val, extra, cls in REC)

# ── 性情 3장 ──────────────────────────────────────────────
P1 = '무던 / 능청 / 화이불류和而不流(어울리되 휩쓸리지 아니한다.)'
P2 = '참견 / 수습 / 不踰矩 불유구(법도와 분수를 넘지 아니한다)'
P3 = '진중 / 잔정 / 회자정리會者定離'

def split_head(h):
    parts = [p.strip() for p in h.split('/')]
    tags, last = parts[:-1], parts[-1]
    m = re.search(r'\((.+)\)\s*$', last)
    gloss = m.group(1) if m else ''
    stem = re.sub(r'\(.+\)\s*$', '', last).strip()
    han = ''.join(re.findall(r'[一-鿿]', stem))
    ko = re.sub(r'[一-鿿]', '', stem).strip()
    return tags, han, ko, gloss

t1, han1, ko1, g1 = split_head(P1)
t2, han2, ko2, g2 = split_head(P2)
t3, han3, ko3, _ = split_head(P3)
p3lines = B[P3]
g3, p3_extra, p3_body = p3lines[1], p3lines[0], p3lines[2:]

# 不踰矩 · 會者定離 교체 원문 (nature.txt, 저장소에서는 제외)
try:
    nraw = [l.strip() for l in io.open('nature.txt', encoding='utf-8') if l.strip()]
except IOError:
    nraw = []
NT = {}
if nraw:
    nk = [i for i, l in enumerate(nraw) if l.startswith('[') and l.endswith(']')]
    for n, i in enumerate(nk):
        end = nk[n+1] if n+1 < len(nk) else len(nraw)
        NT[nraw[i][1:-1]] = nraw[i+1:end]

def chapter(kind, glyph, han, ko, tags, gloss, lines, extra=None, auto_caption=True):
    g = ('<p class="chapter__glyph" aria-hidden="true">' + e(glyph) + '</p>') if glyph else ''
    cord = '<span class="chapter__cord" aria-hidden="true"></span>' if kind == 'c' else ''
    ex = ('<p class="gloss">' + e(extra) + '</p>') if extra else ''
    main = ('<div class="chapter__main">\n          ' + cord +
            '<h3 class="chapter__title">' + sw(han, ko) + '</h3>\n'
            '          <p class="chapter__tags">' + e(' · '.join(tags)) + '</p>\n'
            '          <p class="chapter__gloss">' + e(gloss) + '</p>\n          ' + ex +
            '<div class="chapter__body prose">\n' + body(lines, '            ', auto_caption) +
            '\n          </div>\n        </div>')
    if kind == 'b':
        return '<div class="chapter chapter--b">' + main + g + '</div>'
    if kind == 'c':
        return '<div class="chapter chapter--c">' + g + main + '</div>'
    return '<div class="chapter chapter--a">' + g + main + '</div>'

nature = '\n\n      '.join([
    chapter('a', '和', han1, ko1, t1, g1, NT.get('和而不流', B[P1])),
    chapter('b', '矩', han2, ko2, t2, g2, NT.get('不踰矩', B[P2])),
    # 3장 — 會者定離 폐기, 磊落 으로 교체
    chapter('c', '磊', '磊落', '뇌락', ['단순', '소탈'],
            '마음에 걸림이 적고 작은 일에 오래 매이지 아니한다.',
            NT.get('磊落', p3_body)),
])

# ── 傳承 ──────────────────────────────────────────────────
sc = B['전승한 요괴 또는 신수 종류']; sc_name, sc_body = sc[0], sc[1:]

# ── 渴脈 ──────────────────────────────────────────────────
ab = B['그릇과 이능력']; ab_vessel, ab_name, ab_over = ab[0], ab[1], ab[2:]
# '이능력: 갈맥 渴脈 (갈할 갈渴, 맥 맥脈.)' → 표제/한자/훈음 주석으로 분해
m = re.match(r'^(.+?):\s*(\S+)\s+([\u4e00-\u9fff]+)\s*\((.+)\)\s*$', ab_name)
if m:
    ab_label, ab_ko, ab_han, ab_gloss = m.group(1), m.group(2), m.group(3), m.group(4)
else:
    ab_label, ab_ko, ab_han, ab_gloss = '이능력', '', ab_name, ''

def railitem(mark, han, ko, sub, inner):
    return ('<div class="rail__item">\n'
            '          <div class="rail__mark" aria-hidden="true">' + e(mark) + '</div>\n'
            '          <div class="rail__content">\n'
            '            <h3 class="rail__title">' + sw(han, ko) +
            '<span class="ko">' + e(sub) + '</span></h3>\n'
            '            <div class="rail__body prose">\n' + inner + '\n'
            '            </div>\n          </div>\n        </div>')

burst_head = ('<span class="han">' + sw('暴走', '폭주') + '</span>'
              '<span class="lead-wrap"><span class="lead">'
              + e(lead_split(B['폭주'])[0]) + '</span></span>')
side = body(B['부작용'], '              ') + '\n'
for han, ko in (('平時', '평시'), ('過用', '과용')):
    side += ('              <div class="stage">\n'
             '                <p class="stage__label">' + sw(han, ko) + '</p>\n'
             + body(B[ko], '                ') + '\n              </div>\n')
side += ('              <div class="stage">\n              '
         + toggle(burst_head, lead_split(B['폭주'])[1], cls='burst',
                  attr=' data-lead-type="keep"') + '\n              </div>')

ability = '\n\n        '.join([
    railitem('一', '生體', '생체', '一. 생체', body(B['一. 생체'], '              ')),
    railitem('二', '水', '물', '二. 물', body(B['二. 물'], '              ')),
    railitem('三', '止血', '지혈', '三. 피를 멎게 하는 법', body(B['三. 피를 멎게 하는 법'], '              ')),
    railitem('副', '副作用', '부작용', '부작용', side),
])

# ── 年代 ──────────────────────────────────────────────────
try:
    craw = [l.strip() for l in io.open('chron.txt', encoding='utf-8') if l.strip()]
except IOError:
    craw = []
CH = {}
if craw:
    keys = [i for i, l in enumerate(craw) if l.startswith('[') and l.endswith(']')]
    for n, i in enumerate(keys):
        end = keys[n+1] if n+1 < len(keys) else len(craw)
        CH[craw[i][1:-1]] = craw[i+1:end]

# 접힘 상태에 노출할 리드 문장 (원문에서 고른 한 줄)
LEADS = {
  '六歲':     '그리 몇 해를 견디다가 운이 여섯이 되던 즈음. 아비는 마침내 돌아오지 않았다.',
  '十二歲':   '결국 그해, 모자는 서로 다른 길을 들었다.',
  '十三歲':   '사람의 연緣이란 간혹 당사자보다 먼저 제 이름을 정해두는 법인가 하였다.',
  '十七歲':   '조종자를 잃은 갈맥은 사람을 가리지 않았다.',
  '其後雲林': '유화. 스승이 귀에 못이 박이도록 일러주던 사람.',
  '二十二歲': '유화가 죽은 뒤 꼭 한 해가 지나고서야, 운은 마침내 운림을 나섰다.',
}

try:
    araw = [l.strip() for l in io.open('appearance.txt', encoding='utf-8') if l.strip()]
except IOError:
    araw = []
AP = {}
if araw:
    ak = [i for i, l in enumerate(araw) if l.startswith('[') and l.endswith(']')]
    for n, i in enumerate(ak):
        end = ak[n+1] if n+1 < len(ak) else len(araw)
        AP[araw[i][1:-1]] = araw[i+1:end]

sep = B['집안과 이별']
cut = next(i for i, t in enumerate(sep) if t.startswith('먹을 것이 귀해지면'))
TL = [
    ('',         '誕生', '탄생', '탄생과 유년',      B['탄생과 유년'],  ''),
    ('六歲',     '父離', '부리', '집안과 이별 (상)', CH.get('六歲', sep[:cut]), ''),
    ('十二歲',   '離別', '이별', '집안과 이별 (하)', sep[cut:],         ''),
    ('十三歲',   '師',       '스승', '師 스승',          CH.get('十三歲', B['師 스승']), ''),
    ('十七歲',   '脫胎', '탈태', '脫胎 탈태',        B['脫胎 탈태'],    'tl__item--break'),
    ('其後',     '雲林', '운림', '雲林 운림',        B['雲林 운림'],    ''),
    ('二十二歲', '喪',       '상',   '유화가 죽고',      B['유화가 죽고'],  'tl__item--fade'),
    ('其後',     '出雲林 · 行旅', '출운림 · 행려', '行旅 떠돈 세월', B['行旅 떠돈 세월'], ''),
    ('其後',     '月影', '월영', '月影 월영',        B['月影 월영'],    ''),
]
AGEKO = {'六歲':'6세','十二歲':'12세','十三歲':'13세','十七歲':'17세',
         '二十二歲':'22세','其後':'그 후','三十二歲':'32세'}
rows = []
for age, han, ko, sub, lines, extra in TL:
    key = age + han if (age + han) in LEADS else age
    if key in LEADS:
        # 타입 B — 리드가 본문 중간 문장. 본문은 그대로 두고 펼치면 리드가 가라앉는다
        lead, rest, ltype = LEADS[key], lines, 'sink'
    else:
        # 타입 A — 리드가 본문 첫 문장이라 본문에서 잘려나갔다. 펼쳐도 남아야 한다
        lead, rest = lead_split(lines)
        ltype = 'keep'
    head = ('<span class="han">' + e(han) + '</span>'
            '<span class="ko">' + e(sub) + '</span>'
            '<span class="lead-wrap"><span class="lead">' + e(lead) + '</span></span>')
    agesub = ('<span class="tl__agesub">' + e(AGEKO[age]) + '</span>') if age in AGEKO else ''
    mob = ('<p class="tl__mobile-age">' + e(age) + agesub + '</p>') if age else ''
    theme = ' data-theme="driest"' if 'break' in extra else ''
    rows.append('<div class="tl__item toggle reveal ' + extra + '"' + theme +
        ' data-lead-type="' + ltype + '">\n'
        '          <div class="tl__age">' + e(age) + agesub + '</div>\n'
        '          <div class="tl__axis reveal" aria-hidden="true"><span class="tl__dot"></span></div>\n'
        '          <div class="tl__main">\n            ' + mob +
        '<button class="toggle__head">\n'
        '              <span class="toggle__title">' + head + '</span>\n'
        '              <span class="toggle__ind" aria-hidden="true"></span>\n'
        '            </button>\n'
        '            <div class="toggle__panel"><div class="toggle__inner"><div class="toggle__body prose">\n'
        + body(rest, '              ') + '\n'
        '            </div></div></div>\n          </div>\n        </div>')
rows.append('<div class="tl__item tl__item--now">\n'
    '          <div class="tl__age">三十二歲<span class="tl__agesub">32세</span></div>\n'
    '          <div class="tl__axis reveal" aria-hidden="true"><span class="tl__dot"></span></div>\n'
    '          <div class="tl__main">\n'
    '            <p class="tl__mobile-age">三十二歲</p>\n'
    '            <p class="tl__now">' + sw('今', '지금') + '</p>\n'
    '          </div>\n        </div>')
chron = '\n\n        '.join(rows)

# ── 日常 / 好惡·習 ────────────────────────────────────────
# 日常 교체 원문 (daily.txt, 저장소에서는 제외)
try:
    draw = [l.strip() for l in io.open('daily.txt', encoding='utf-8') if l.strip()]
except IOError:
    draw = []
DL = {}
if draw:
    dk = [i for i, l in enumerate(draw) if l.startswith('[') and l.endswith(']')]
    for n, i in enumerate(dk):
        end = dk[n+1] if n+1 < len(dk) else len(draw)
        DL[draw[i][1:-1]] = draw[i+1:end]

HAN = {'목소리': ('聲','목소리'), '水, 물': ('水','물'), '길라': ('吉羅','길라'),
       '수계 파수': ('水系','수계 파수'), '잡다한 용처': ('雜用','잡다한 용처'),
       '호오': ('好惡','호오'), '습관.': ('習','습관')}
ho = DL.get('호오', B['호오'])
ho_html = '\n'.join(
    ('              <p class="sublabel">' + e(t) + '</p>') if t in ('좋아하는 것.','꺼리는 것.')
    else ('              <p>' + e(t) + '</p>') for t in ho)

def item(key):
    """모든 항목을 항상 펼친 상태로. 원문 문단 구분을 그대로 쓴다(리드 분리 없음)."""
    lines = DL.get(key, B[key])
    han, ko = HAN[key]
    if key == '호오':
        inner = ho_html
    elif key == '잡다한 용처':
        # 마지막 한 줄은 곁에서 귀띔하는 투 — 색·정렬·여백으로만 구분
        inner = (body(lines[:-1], '            ') + '\n'
                 '            <p class="whisper">' + e(lines[-1]) + '</p>')
    else:
        inner = body(lines, '            ')
    return ('<div class="entry">\n'
            '            <h3 class="entry__title">' + e(han) +
            '<span class="ko">' + e(key) + '</span></h3>\n'
            '            <div class="entry__body prose">\n' + inner + '\n'
            '            </div>\n          </div>')

daily = '\n\n          '.join(item(k) for k in ['목소리','水, 물','길라','수계 파수','잡다한 용처'])
habit = '\n\n          '.join(item(k) for k in ['호오','습관.'])

# ── 好惡 표 ───────────────────────────────────────────────
pf = B['캐릭터 및 오너 선호/기피플']
col_c, col_o = pf[0], pf[1]
row1, c_like, o_like = pf[2], pf[3], pf[4]
row2, c_hate = pf[5], pf[6]
o_hate = pf[7] if len(pf) > 7 else ''
# 오너 열 — content.txt 에 없던 내용, 사용자가 직접 준 원문
o_like = ('폭력 및 유혈, 강압적 플레이, 음담패설, 도구플, 구속, 브컨, 요도플, 대디플, '
          '골든(시오후키, 장내배뇨), 약물 사용, 신체검사, 낙서, 그 외 기피를 제외한 다수.')
o_hate = ('제모플, 스캇, 저온초, 페이스 시팅, 합의되지 않은 영구적 상해 중 발치 및 성기 절단, '
          '유아퇴행, 하트 신음, 과도한 수동적 지문 및 거울 지문, '
          '남성향 신음(헤윽 - 류, ㅇ자 받침의 신음 등)')

# ── 확인 질문 ─────────────────────────────────────────────
QK = '통합문서 확인 및 신청서 작성을 완료하신 분들께서는 아래의 질문에 답하여주세요.'
qs = [t for t in B[QK] if t != 'Yes / No' and not t.startswith('답변:')]
q_items = []
for i, q in enumerate(qs, 1):
    if i < 3:
        ans = ('          <p class="qa__ans"><span class="picked">Yes</span>'
               '<span class="qa__slash">/</span><span class="unpicked">No</span></p>')
    else:
        ans = ('          <p class="qa__ans"><span class="qa__lab">답변:</span>'
               '<span class="picked">' + e(SECRET['answer3']) + '</span></p>')
    q_items.append('        <li>\n          <p class="qa__q">' + e(q) + '</p>\n' + ans + '\n        </li>')
q_html = '\n'.join(q_items)

# ── 非說 (hidden.txt) ─────────────────────────────────────
H_A = '一. 흉조凶兆와 남은 매듭'
H_B = '二. 배신자背信者'
try:
    hraw = [l.strip() for l in io.open('hidden.txt', encoding='utf-8') if l.strip()]
except IOError:
    hraw = []

hidden_html = ''
if hraw:
    at = [i for i, l in enumerate(hraw) if l in (H_A, H_B)]
    # 제목이 네 번 나온다: 요약 一 / 요약 二 / 전문 一 / 전문 二
    sum_a  = hraw[at[0]+1:at[1]]
    sum_b  = hraw[at[1]+1:at[2]]
    full_a = hraw[at[2]+1:at[3]]
    full_b = hraw[at[3]+1:]

    def hidden_item(title, summary, full, n):
        head = ('<span class="han">全文</span><span class="ko">전문</span>')
        return ('<article class="hidden-item">\n'
                '          <h3 class="hidden-item__title">' + e(title) + '</h3>\n'
                '          <div class="hidden-item__sum prose">\n'
                + body(summary, '            ') + '\n'
                '          </div>\n          '
                + toggle(head, full) + '\n        </article>')

    hidden_html = ('\n        '
                   + hidden_item(H_A, sum_a, full_a, 1)
                   + '\n\n        '
                   + hidden_item(H_B, sum_b, full_b, 2) + '\n      ')

# ── 우측 인덱스 ───────────────────────────────────────────
NAV = [('h-face','外貌','외모'), ('h-profile','身元','신원'),
       ('h-nature','性情','성정'), ('h-succ','傳承','전승'),
       ('h-ability','渴脈','갈맥'), ('h-chron','年代','연대'),
       ('h-daily','日常','일상'), ('h-pref','好惡','호오')]
nav = '\n      '.join(
    '<li><a href="#' + i + '" data-nav="' + i + '"><span class="index__dot" aria-hidden="true"></span>' + sw(h, k) + '</a></li>'
    for i, h, k in NAV)

SEAL = ('<svg class="seal" viewBox="0 0 120 120" aria-hidden="true">'
        '<rect x="4.5" y="4.5" width="111" height="111" rx="3" fill="none"'
        ' stroke="currentColor" stroke-width="7"/>'
        '<text x="60" y="62" text-anchor="middle" dominant-baseline="central"'
        ' font-family="Noto Serif KR, Nanum Myeongjo, serif" font-weight="700"'
        ' font-size="74" fill="currentColor">\u96f2</text>'
        '</svg>')

PRIVATE_TPL = '''  <!-- ══ 九. 非說 ═══════════════════════════════════════ -->
  <section class="section section--hidden" aria-labelledby="h-hidden">
    <div class="wrap editorial">
      %(head_hidden)s
      %(hidden)s
    </div>
  </section>


  <!-- ══ 十. 確認 ═══════════════════════════════════════ -->
  <section class="section section--form" aria-labelledby="h-form">
    <div class="wrap editorial">
      %(head_form)s

      <div class="form-block">
        <h3>연락 가능한 계정</h3>
        <p class="contact-id">%(acct)s</p>
        <p><a class="contact-link" href="%(acctlink)s" target="_blank" rel="noopener noreferrer">%(acctlink)s</a></p>
      </div>

      <div class="form-block">
        <h3>성인인증</h3>
        <a class="dl dl--sm" href="%(adulturl)s" target="_blank" rel="noopener noreferrer">성인인증 확인</a>
      </div>

      <div class="form-block">
        <h3>통합문서 확인 질문</h3>
        <p>%(qlead)s</p>
        <ol class="qa">
%(questions)s
        </ol>
      </div>

    </div>
  </section>
'''

DOC = '''<!DOCTYPE html>
<html lang="ko" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>[ 운 / 월영 / 파수 / 1품 / M]</title>
<meta name="description" content="月影 保管 · 一品 把守 人事錄">
<meta name="robots" content="noindex">
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="style.css">
</head>
<body>

<header class="topbar">
  <span class="topbar__title">[ 운 / 월영 / 파수 / 1품 / M]</span>
  <div class="viewers" tabindex="0" aria-live="polite" aria-label="열람자">
    <span class="viewers__dot" aria-hidden="true"></span>
    <span class="viewers__n"></span>
    <span class="viewers__tip" role="tooltip">이 기록을 함께 열람 중인 자 1인</span>
  </div>
</header>

<div class="unroll" aria-hidden="true"></div>
<div class="tint" aria-hidden="true"></div>
<div class="thread" aria-hidden="true"><span></span></div>

<nav class="index" aria-label="섹션 목차">
  <ul>
    <span class="index__cursor" aria-hidden="true"></span>
      %(nav)s
  </ul>
</nav>

<main>

  <!-- ══ HERO ═══════════════════════════════════════════ -->
  <header class="hero" data-theme="neutral">
    <div class="hero__wash" aria-hidden="true"></div>
    <img class="stain stain--hero" src="assets/ink-1.png" alt="" aria-hidden="true">
    <div class="wrap hero__grid">
      <div class="hero__info">
        <p class="hero__quote">%(heroq)s</p>
        <div class="hero__name">
          <h1 class="hero__han">雲</h1>
          <span class="hero__ko">운</span>
        </div>
        <div class="hero__cord" aria-hidden="true"></div>
        <ul class="hero__meta">
          <li><span class="tag">%(t_so)s</span>%(v_so)s</li>
          <li><span class="tag">%(t_de)s</span>%(v_de)s &middot; M</li>
          <li><span class="tag">%(t_jr)s</span>%(v_jr)s</li>
          <li><span class="tag">%(t_in)s</span>%(v_in)s</li>
        </ul>
      </div>
      <figure class="hero__figure">
        <img src="assets/character.png" alt="운(雲)의 전신 외관">
      </figure>
    </div>
    <p class="hero__scroll" aria-hidden="true">SCROLL</p>
  </header>


  <!-- ══ 一. 外貌 ═══════════════════════════════════════ -->
  <section class="section" data-theme="neutral" aria-labelledby="h-face">
    <div class="wrap editorial">
      %(head_face)s

      <div class="face">
        <figure class="face__figure">
          <button class="face__crop reveal" type="button" data-lightbox aria-label="전신 이미지 크게 보기">
            <img src="assets/character-bust.png" alt="운(雲)의 얼굴과 상반신">
          </button>
          <ul class="face__notes">
            <li><span class="han">%(n1)s</span>은백색 머리</li>
            <li><span class="han">%(n2)s</span>회청색 눈</li>
            <li><span class="han">%(n3)s</span>빛바랜 쪽빛 매듭</li>
          </ul>
        </figure>
        <div class="face__text reveal">
          <div class="prose textcol">
%(desc)s
          </div>
          <a class="dl" href="https://drive.google.com/file/d/1rQxDhYiVBbd-YzZENR1t57JeRU6BL-KN/view?usp=drive_link" target="_blank" rel="noopener noreferrer">전신 이미지 다운로드</a>
        </div>
      </div>
    </div>
  </section>


  <div class="wave" aria-hidden="true"><img src="assets/wave-divider.png" alt=""></div>


  <!-- ══ 二. 身元 ═══════════════════════════════════════ -->
  <section class="section" data-theme="neutral" aria-labelledby="h-profile">
    <div class="wrap editorial">
      <div class="record-head">
        %(head_profile)s
        <p class="file-no"><img class="stamp" src="assets/stamp.png" alt="" aria-hidden="true">月影 / 人事錄<br>FILE NO. 01-P</p>
      </div>

      <div class="record-frame">
        <span class="corner corner--tl" aria-hidden="true"></span>
        <span class="corner corner--br" aria-hidden="true"></span>
        <dl class="record">
          %(record)s
        </dl>
      </div>
    </div>
  </section>


  <!-- ══ 三. 性情 ═══════════════════════════════════════ -->
  <section class="section" data-theme="ink" aria-labelledby="h-nature">
    <div class="wrap editorial">
      <img class="stain stain--nature" src="assets/ink-wide.png" alt="" aria-hidden="true">
      %(head_nature)s

      %(nature)s
    </div>
  </section>


  <!-- ══ 간지 ═══════════════════════════════════════════ -->
  <div class="bridge" aria-hidden="true"><span class="bridge__han">傳</span></div>


  <!-- ══ 四. 傳承 ═══════════════════════════════════════ -->
  <section class="section" data-theme="ink" aria-labelledby="h-succ">
    <img class="stain stain--succ reveal" src="assets/ink-corner.png" alt="" aria-hidden="true">
    <div class="wrap editorial">
      %(head_succ)s

      <div class="succ">
        <span class="succ__mark reveal" aria-hidden="true">鋼鐵伊</span>
        <div class="succ__body prose">
          <p class="succ__name">%(succ)s</p>
%(succbody)s
        </div>
      </div>
    </div>
  </section>


  <!-- ══ 五. 渴脈 ═══════════════════════════════════════ -->
  <section class="section section--dry" data-theme="dry" aria-labelledby="h-ability">
    <img class="dry-crack" src="assets/crack-fine.png" alt="" aria-hidden="true">
    <div class="wrap editorial">
      %(head_ability)s

      <div class="ability__intro prose">
        <div class="ability__plate">
          <p class="ability__vessel">그릇 &mdash; %(vessel)s</p>
          <p class="ability__label">%(ablabel)s</p>
          <p class="ability__han">%(abhan)s<span class="ko">%(abko)s</span></p>
          <p class="ability__gloss">%(abgloss)s</p>
        </div>
%(abover)s
      </div>

      <div class="rail reveal">
        %(ability)s
      </div>
    </div>
  </section>


  <!-- ══ 六. 年代 ═══════════════════════════════════════ -->
  <section class="section" data-theme="neutral" aria-labelledby="h-chron">
    <div class="wrap editorial">
      %(head_chron)s

      <div class="tl">
        %(chron)s
      </div>
    </div>
  </section>


  <div class="wave" aria-hidden="true"><img src="assets/wave-divider.png" alt=""></div>


  <!-- ══ 七. 日常 ═══════════════════════════════════════ -->
  <section class="section" data-theme="neutral" aria-labelledby="h-daily">
    <img class="stain stain--daily" src="assets/ink-3.png" alt="" aria-hidden="true">
    <div class="wrap editorial">
      %(head_daily)s

      <div class="group">
        <div class="group__rule"></div>
          %(daily)s
      </div>

      <div class="group">
        <p class="group__label">好惡 &middot; 習</p>
        <div class="group__rule"></div>
          %(habit)s
      </div>
    </div>
  </section>


  <div class="wave" aria-hidden="true"><img src="assets/wave-divider.png" alt=""></div>


  <!-- ══ 엔딩 ═══════════════════════════════════════════ -->
  <section class="ending" data-theme="water" aria-label="맺음">
    <img class="ending__silhouette reveal" src="assets/character.png" alt="" aria-hidden="true">
  </section>


  <!-- ══ 八. 好惡 표 ════════════════════════════════════ -->
  <section class="section" aria-labelledby="h-pref">
    <div class="wrap editorial">
      %(head_pref)s

      <div class="pref-wrap">
        <table class="pref-table">
          <thead>
            <tr><td></td><th scope="col">%(colc)s</th><th scope="col">%(colo)s</th></tr>
          </thead>
          <tbody>
            <tr><th scope="row">%(row1)s</th><td>%(clike)s</td><td>%(olike)s</td></tr>
            <tr><th scope="row">%(row2)s</th><td>%(chate)s</td><td>%(ohate)s</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>


  <!-- 비공개 구역 — 암호문만 페이지에 실린다 -->
  <section class="section section--hidden" aria-labelledby="h-gate">
    <div class="wrap editorial">
      <p class="private-note">%(privnote)s</p>
      <div class="gate" id="gate" data-gate-version="woon-gate-v1">
        <div class="gate__panel">
          <p class="gate__mark" aria-hidden="true">封</p>
          <h2 class="gate__title" id="h-gate">非公開</h2>
          <p class="gate__lead">열람에는 인증이 필요합니다.</p>
          <form class="gate__form" autocomplete="off">
            <label class="sr-only" for="gate-pw">비밀번호</label>
            <input class="gate__input" id="gate-pw" type="password" inputmode="numeric"
                   autocomplete="off" spellcheck="false" aria-describedby="gate-msg">
            <button class="gate__btn" type="submit">확인</button>
          </form>
          <p class="gate__msg" id="gate-msg" role="status" aria-live="polite"></p>
        </div>
        <div class="gate__content" hidden></div>
      </div>
    </div>
  </section>

  <div class="wrap colophon-wrap">
    <p class="colophon">月影 保管 &middot; 一品 把守 &middot; 雲</p>
  </div>

</main>

<button class="totop" type="button" aria-label="맨 위로">上</button>

<div class="lightbox" id="lightbox" role="dialog" aria-modal="true" aria-label="전신 이미지">
  <button class="lightbox__close" type="button">닫기 ESC</button>
  <img src="assets/character.png" alt="운(雲)의 전신 외관">
</div>

<script type="application/json" id="gate-data">%(gatedata)s</script>
<script src="config.js"></script>
<script src="main.js"></script>
</body>
</html>
'''

# ── 비공개 구역: 렌더 → AES-GCM 암호화 ───────────────────
private_html = PRIVATE_TPL % dict(
    head_hidden=sechead('九', 'h-hidden', '非說', '비설'),
    head_form=sechead('十', 'h-form', '確認', '확인',
                      '연락 가능한 계정 · 성인인증 · 통합문서 확인'),
    hidden=(hidden_html if hidden_html else '<div class="blank"><p>&mdash;</p></div>'),
    qlead=e(QK), questions=q_html,
    acct=e(SECRET['account_id']), acctlink=e(SECRET['account_link']),
    adulturl=e(SECRET['adult_url']),
)

def encrypt_region(plain, password):
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    # salt 는 버전에서 결정적으로 만든다. 매 빌드마다 무작위로 두면
    # 기존 기기에 저장된 유도 키가 빌드할 때마다 무효가 된다.
    # 비밀번호를 바꿀 때는 GATE_VERSION 을 올리므로 salt 도 함께 바뀐다.
    salt = hashlib.sha256(('woon-gate-salt:' + GATE_VERSION).encode('utf-8')).digest()[:16]
    iv = os.urandom(12)
    key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, PBKDF2_ITERS, 32)
    ct = AESGCM(key).encrypt(iv, plain.encode('utf-8'), None)
    b64 = lambda x: base64.b64encode(x).decode('ascii')
    return {'v': GATE_VERSION, 'it': PBKDF2_ITERS,
            'salt': b64(salt), 'iv': b64(iv), 'ct': b64(ct)}

gatedata = json.dumps(encrypt_region(private_html, GATE_PASSWORD), separators=(',', ':'))

out = DOC % dict(
    gatedata=gatedata,
    nav=nav, seal=SEAL,
    t_so=sw('所屬','소속'), v_so=sw('月影','월영'),
    t_de=sw('等級','등급'), v_de=sw('一品','일품'),
    t_jr=sw('傳承','전승'), v_jr=sw('鋼鐵伊','강철이'),
    t_in=sw('異能','이능'), v_in=sw('渴脈','갈맥'),
    n1=sw('銀白','은백'), n2=sw('灰靑','회청'), n3=sw('藍結','남결'),
    heroq=e(HERO_Q),
    head_face=sechead('一','h-face','外貌','외모','외관'),
    head_profile=sechead('二','h-profile','身元','신원'),
    head_nature=sechead('三','h-nature','性情','성정','성격'),
    head_succ=sechead('四','h-succ','傳承','전승','전승한 요괴 또는 신수 종류'),
    head_ability=sechead('五','h-ability','渴脈','갈맥','그릇과 이능력'),
    head_chron=sechead('六','h-chron','年代','연대','기타'),
    head_daily=sechead('七','h-daily','日常','일상','기타'),
    head_pref=sechead('八','h-pref','好惡','호오','캐릭터 및 오너 선호/기피플'),
    desc=body(AP.get('外貌', B['외관']), '            '),
    record=record,
    nature=nature,
    succ=e(sc_name), succbody=body(sc_body, '          '),
    vessel=e(ab_vessel), abover=body(ab_over, '        '),
    ablabel=e(ab_label), abko=e(ab_ko), abhan=e(ab_han), abgloss=e(ab_gloss),
    ability=ability, chron=chron, daily=daily, habit=habit,
    colc=e(col_c), colo=e(col_o),
    row1=e(row1), clike=e(c_like), olike=e(o_like),
    row2=e(row2), chate=e(c_hate), ohate=e(o_hate),
    privnote=e('아래는 비공개 사항입니다.'),
)
io.open('index.html', 'w', encoding='utf-8').write(out)
print('index.html — %d bytes' % len(out.encode('utf-8')))


# ══ keeper.html — 열람 현황 (링크 어디에도 노출하지 않는다) ═══════════
#
# 비밀번호는 게이트와 같은 것을 쓰되, 평문은 저장소에 두지 않는다.
# gate.pw 에서 PBKDF2 로 검증값만 뽑아 페이지에 심고, 입력값을 같은 방식으로
# 유도해 맞춰 본다. 게이트의 복호화 키와 섞이지 않도록 salt 라벨을 달리 한다.
#
# 이 문은 속도 방지턱이지 자물쇠가 아니다. presence 채널은 anon 키로 누구나
# 구독할 수 있으므로, 채널에는 익명 이름과 섹션명 말고는 아무것도 싣지 않는다.

KEEPER_SALT = hashlib.sha256(
    ('woon-keeper-salt:' + GATE_VERSION).encode('utf-8')).digest()[:16]
KEEPER_VERIFIER = hashlib.pbkdf2_hmac(
    'sha256', GATE_PASSWORD.encode('utf-8'), KEEPER_SALT, PBKDF2_ITERS, 32).hex()

KEEPER_TPL = r'''<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>守 — 열람 현황</title>
<meta name="robots" content="noindex, nofollow">
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<style>
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@300;400;500;600;700&display=swap');
:root{
  --paper:#ECE9E4; --ash:#D6D2CC; --ink:#1F2328; --charcoal:#3D444B;
  --indigo:#4C5E84; --earth:#8D877E;
  --serif:"Noto Serif KR","Nanum Myeongjo","Apple SD Gothic Neo",serif;
  --hair:rgba(31,35,40,.11);
}
*{box-sizing:border-box}
body{
  margin:0; padding:clamp(28px,6vw,72px) clamp(20px,5vw,40px);
  background:var(--paper); color:var(--ink);
  font-family:var(--serif); font-size:17px; line-height:1.8;
  -webkit-font-smoothing:antialiased;
}
main{max-width:560px; margin:0 auto}
.mark{
  font-size:clamp(40px,9vw,56px); line-height:1; margin:0 0 .2em;
  color:var(--indigo); opacity:.22; font-weight:400;
}
h1{font-size:19px; font-weight:600; letter-spacing:.06em; margin:0 0 2px}
.sub{font-size:13px; color:var(--earth); margin:0 0 32px; letter-spacing:.04em}
form{display:flex; gap:8px; flex-wrap:wrap}
input{
  flex:1 1 180px; min-width:0; padding:11px 13px;
  border:1px solid var(--hair); border-radius:2px;
  background:rgba(255,255,255,.5); color:var(--ink);
  font-family:var(--serif); font-size:16px; letter-spacing:.3em;
}
input:focus{outline:none; border-color:var(--indigo)}
button{
  padding:11px 20px; border:1px solid var(--charcoal); border-radius:2px;
  background:var(--charcoal); color:var(--paper);
  font-family:var(--serif); font-size:15px; letter-spacing:.1em; cursor:pointer;
}
button:hover{background:var(--ink); border-color:var(--ink)}
.msg{font-size:13px; color:var(--earth); margin:12px 0 0; min-height:1.4em}
.msg.bad{color:#8a4a4a}
.count{font-size:13px; color:var(--earth); letter-spacing:.05em; margin:0 0 14px}
ul{list-style:none; margin:0; padding:0}
li{
  padding:13px 0; border-top:1px solid var(--hair);
  display:flex; flex-wrap:wrap; gap:2px 10px; align-items:baseline;
}
li:last-child{border-bottom:1px solid var(--hair)}
.who{font-size:16px}
.at{font-size:14px; color:var(--charcoal)}
.dur{font-size:12px; color:var(--earth); margin-left:auto; letter-spacing:.04em}
.empty{padding:16px 0; color:var(--earth); font-size:14px; border-top:1px solid var(--hair)}
.foot{margin:26px 0 0; font-size:12px; color:var(--earth); line-height:1.7}
[hidden]{display:none !important}
</style>
</head>
<body>
<main>
  <p class="mark" aria-hidden="true">守</p>
  <h1>열람 현황</h1>
  <p class="sub">月影 保管 · 人事錄</p>

  <form id="f" autocomplete="off">
    <input id="pw" type="password" inputmode="numeric" placeholder="비밀번호" aria-label="비밀번호">
    <button type="submit">확인</button>
  </form>
  <p class="msg" id="msg" role="status"></p>

  <section id="live" hidden>
    <p class="count" id="count">연결 중…</p>
    <ul id="list"></ul>
    <p class="foot">
      이 화면은 구독만 하고 자신을 알리지 않는다 — 열람자 수에 섞이지 않는다.<br>
      갱신은 4초에 한 번이라 방금 옮긴 섹션은 조금 늦게 보인다.
    </p>
  </section>
</main>

<script src="config.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script>
(function () {
  'use strict';
  var SALT = '__SALT__', ITERS = __ITERS__, VERIFIER = '__VERIFIER__';
  var STORE = 'woon-keeper-__VERSION__';

  var SECTIONS = ['外貌','身元','性情','傳承','渴脈','年代','日常','好惡','非說','確認','非公開'];

  var f = document.getElementById('f'), pw = document.getElementById('pw');
  var msg = document.getElementById('msg'), live = document.getElementById('live');
  var list = document.getElementById('list'), count = document.getElementById('count');

  function hex(buf) {
    return Array.from(new Uint8Array(buf))
      .map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }
  function bytes(h) {
    var a = new Uint8Array(h.length / 2);
    for (var i = 0; i < a.length; i++) a[i] = parseInt(h.substr(i * 2, 2), 16);
    return a;
  }
  function derive(p) {
    return crypto.subtle
      .importKey('raw', new TextEncoder().encode(p), 'PBKDF2', false, ['deriveBits'])
      .then(function (k) {
        return crypto.subtle.deriveBits(
          { name: 'PBKDF2', salt: bytes(SALT), iterations: ITERS, hash: 'SHA-256' }, k, 256);
      }).then(hex);
  }

  function open_() {
    f.hidden = true;
    msg.textContent = '';
    live.hidden = false;
    start();
  }

  f.addEventListener('submit', function (e) {
    e.preventDefault();
    msg.className = 'msg';
    msg.textContent = '확인하는 중…';
    derive(pw.value).then(function (h) {
      if (h !== VERIFIER) {
        msg.className = 'msg bad';
        msg.textContent = '맞지 않는다.';
        pw.value = '';
        return;
      }
      try { localStorage.setItem(STORE, h); } catch (err) {}
      open_();
    }).catch(function () {
      msg.className = 'msg bad';
      msg.textContent = '확인할 수 없다.';
    });
  });

  try {
    if (localStorage.getItem(STORE) === VERIFIER) open_();
  } catch (e) {}

  function elapsed(ms) {
    var s = Math.max(0, Math.round(ms / 1000));
    if (s < 60) return s + '초';
    if (s < 3600) return Math.floor(s / 60) + '분';
    return Math.floor(s / 3600) + '시간 ' + Math.floor((s % 3600) / 60) + '분';
  }

  function start() {
    var cfg = window.WOON_CONFIG || {};
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY || !window.supabase) {
      count.textContent = '연결할 수 없다.';
      return;
    }
    var client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
      realtime: { params: { eventsPerSecond: 2 } }
    });
    // track 하지 않는다 — 구독만 한다. 그래야 열람자 수에 잡히지 않는다.
    var ch = client.channel(cfg.PRESENCE_CHANNEL || 'woon-page', {
      config: { presence: { key: 'keeper-' + Math.random().toString(36).slice(2, 8) } }
    });

    function render() {
      var st = {};
      try { st = ch.presenceState(); } catch (e) { return; }
      var rows = [];
      Object.keys(st).forEach(function (k) {
        var m = (st[k] && st[k][0]) || {};
        var name = typeof m.name === 'string' ? m.name.slice(0, 20) : '';
        if (name.indexOf('익명의 ') !== 0) name = '익명의 방문자';
        var sec = SECTIONS.indexOf(m.section) >= 0 ? m.section : '';
        rows.push({ name: name, sec: sec, at: typeof m.at === 'number' ? m.at : Date.now() });
      });
      rows.sort(function (a, b) { return a.at - b.at; });

      count.textContent = rows.length
        ? '열람 중 ' + rows.length + '인'
        : '지금은 아무도 없다.';
      list.textContent = '';
      if (!rows.length) {
        var p = document.createElement('li');
        p.className = 'empty';
        p.textContent = '—';
        list.appendChild(p);
        return;
      }
      var now = Date.now();
      rows.forEach(function (r) {
        var li = document.createElement('li');
        var a = document.createElement('span');
        a.className = 'who';
        a.textContent = r.name;
        var b = document.createElement('span');
        b.className = 'at';
        b.textContent = r.sec ? '— ' + r.sec + ' 열람 중' : '— 열람 중';
        var c = document.createElement('span');
        c.className = 'dur';
        c.textContent = '접속 ' + elapsed(now - r.at);
        li.appendChild(a); li.appendChild(b); li.appendChild(c);
        list.appendChild(li);
      });
    }

    ch.on('presence', { event: 'sync' }, render);
    ch.subscribe(function (st) {
      if (st === 'SUBSCRIBED') render();
      else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') count.textContent = '연결이 끊겼다.';
    });
    setInterval(render, 10000);   // 접속 시간만 다시 그린다
  }
})();
</script>
</body>
</html>
'''

keeper = (KEEPER_TPL
          .replace('__SALT__', KEEPER_SALT.hex())
          .replace('__ITERS__', str(PBKDF2_ITERS))
          .replace('__VERIFIER__', KEEPER_VERIFIER)
          .replace('__VERSION__', GATE_VERSION))
io.open('keeper.html', 'w', encoding='utf-8').write(keeper)
print('keeper.html — %d bytes' % len(keeper.encode('utf-8')))

# robots.txt — 통째로 막는다.
# keeper.html 만 Disallow 하면 오히려 그 경로를 광고하는 꼴이다.
ROBOTS = 'User-agent: *\nDisallow: /\n'
io.open('robots.txt', 'w', encoding='utf-8').write(ROBOTS)
print('robots.txt — %d bytes' % len(ROBOTS))
