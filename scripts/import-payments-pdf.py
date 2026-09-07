#!/usr/bin/env python3
# scripts/import-payments-pdf.py
# -------------------------------------------------------------
# استيراد إيصالات الاشتراكات من تقرير "gym payments 2026.pdf"
# اللي في مجلد prisma، وإضافتها لـ prisma/gym.db.
#
# المدى اللي في التقرير: من ١ يناير ٢٠٢٦ لحد ٣٠ أبريل ٢٠٢٦
#   (٩٣٧ صف، إجمالي مدفوع 595,400 — نفس رقم صف الـ Sum اللي في آخر
#    صفحة في الـ PDF، وده اللي بنتحقق بيه إن القراءة طلعت مضبوطة).
#
# التقرير ده بتاع نفس الجيم اللي في gym.db: ٦٢٤ من الـ ٦٣٢ تليفون اللي
# فيه موجودين في جدول Member، و٩٢٥ صف رقم عضويته متطابق من غير أي
# اختلاف واحد. عشان كده الإيصالات بتتربط بالأعضاء برقم العضوية،
# بشرط إن التليفون يطابق كمان — وأي صف مايتأكدش بيتساب من غير ربط.
#
# من غير --replace الاستيراد بيبقى إضافة فوق اللي موجود، وده بيكرّر
# الشهور لأن صفوف التقرير دي موجودة أصلاً في الداتابيز.
#
# مع --replace التقرير بيبقى هو المصدر للشهور اللي بيغطيها: إيصالات
# الاشتراكات اللي جوّه مداه بتتمسح الأول وتتحط مكانها صفوف التقرير.
# المدى بيتحسب من التقرير نفسه، وأي نوع تاني جوّه المدى (زائر يومي،
# PT، اشتراك More…) مابيتلمسش خالص.
#
# الحركات:
#   "دفع"    → إيصال عادي بالمبلغ المدفوع
#   "ارتجاع" → المبلغ بالسالب عشان صافي الإيراد يظبط
#   "ملغاه"  → المبلغ صفر و isCancelled = true
#
# كل الصفوف المضافة id بتاعها بيبدأ بـ 'cpdf' وفيها
# itemDetails.importSource = 'gym payments 2026.pdf' — عشان تعرف
# تلاقيها أو تشيلها في أي وقت:
#   DELETE FROM Receipt WHERE id LIKE 'cpdf%';
# (بس ده مابيرجّعش الصفوف اللي --replace مسحها — لو عايز ترجّع كله
#  استخدم النسخة الاحتياطية.)
#
# التشغيل:
#   python3 scripts/import-payments-pdf.py --dry-run
#   python3 scripts/import-payments-pdf.py
#   python3 scripts/import-payments-pdf.py --replace # التقرير يبقى المصدر لشهوره
#   python3 scripts/import-payments-pdf.py --purge   # يشيل استيراد قديم الأول
#   GYM_DB=prisma/demo.db python3 scripts/import-payments-pdf.py
#
# المتطلبات: مفيش — بيقرا الـ PDF بالمكتبة القياسية بس (zlib).
# -------------------------------------------------------------

import datetime
import json
import os
import re
import secrets
import sqlite3
import sys
import zlib
from zoneinfo import ZoneInfo

# ⚙️ إعدادات
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF = os.environ.get('PAYMENTS_PDF', os.path.join(ROOT, 'prisma', 'gym payments 2026.pdf'))
DB = os.environ.get('GYM_DB', os.path.join(ROOT, 'prisma', 'gym.db'))

CAIRO = ZoneInfo('Africa/Cairo')
ID_PREFIX = 'cpdf'
IMPORT_TAG = 'gym payments 2026.pdf'
EXPECTED_TOTAL = 595400.0     # صف الـ Sum اللي في آخر صفحة في التقرير

DRY_RUN = '--dry-run' in sys.argv
PURGE = '--purge' in sys.argv
REPLACE = '--replace' in sys.argv

# التقرير ده إيصالات اشتراكات بس — مافيهوش زائر يومي ولا PT ولا غيرهم.
# عشان كده --replace بيمسح الأنواع دي بس، والباقي جوّه المدى بيفضل زي ما هو.
MEMBERSHIP_TYPES = ('Member', 'membershipRenewal', 'ترقية باكدج')

PAY_MAP = {
    'نقدى': 'cash', 'نقدي': 'cash', 'كاش': 'cash',
    'انستا باي': 'instapay', 'إنستا باي': 'instapay',
    'محفظه': 'wallet', 'محفظة': 'wallet',
    'فيزا': 'visa',
}

MONTHS = {'يناير': 1, 'فبراير': 2, 'مارس': 3, 'ابريل': 4, 'أبريل': 4, 'مايو': 5,
          'يونيو': 6, 'يوليو': 7, 'اغسطس': 8, 'أغسطس': 8, 'سبتمبر': 9,
          'اكتوبر': 10, 'أكتوبر': 10, 'نوفمبر': 11, 'ديسمبر': 12}

# ترتيب أعمدة التقرير من اليمين للشمال — نفس ترتيب شيت الإيرادات القديم
COLS = ['date', 'move', 'memberNo', 'rep', 'name', 'gender', 'phone', 'invoice',
        'plan', 'offer', 'start', 'end', 'first', 'channel', 'freeCoach',
        'price', 'remaining', 'by', 'account', 'paid']


# ═══════════════════════════════════════════════ قراءة الـ PDF
# التقرير مصدّر من Oracle APEX: PDF كلاسيكي (مفيش object streams)، وكل
# خانة في الجدول مرسومة كمستطيل `x y w h re b` والنص بتاعها بيجي بعده
# على طول — فتقسيم الخانات بيطلع مظبوط من غير أي تخمين بالإحداثيات.

_data = open(PDF, 'rb').read()

_REF = re.compile(rb'(\d+)\s+0\s+R')
_HEXPAIR = re.compile(rb'<([0-9A-Fa-f]+)>')
_ARABIC = re.compile(r'[؀-ۿ]')

_TOKEN = re.compile(rb"""
    (?P<str>\((?:\\.|[^()\\]|\((?:\\.|[^()\\])*\))*\))
  | (?P<hex><[0-9A-Fa-f\s]*>)
  | (?P<num>[-+]?[0-9]*\.?[0-9]+)
  | (?P<name>/[^\s/\[\]<>(){}]*)
  | (?P<delim>[\[\]])
  | (?P<op>[A-Za-z'"*][A-Za-z0-9'"*]*)
""", re.X)


def _load_objects():
    """الإزاحات بتتقرا من جدول الـ xref — المسح عن "N 0 obj" كان هيلقط
    بايتات جوّه الـ streams المضغوطة."""
    offsets = {}
    start = int(re.search(rb'startxref\s+(\d+)', _data[-2048:]).group(1))
    xref = _data[start:_data.find(b'trailer', start)]
    for sec in re.finditer(rb'(\d+)\s+(\d+)\s*\r?\n((?:\d{10}\s\d{5}\s[nf]\s?\s?\r?\n?)+)', xref):
        first = int(sec.group(1))
        for i, ent in enumerate(re.finditer(rb'(\d{10})\s(\d{5})\s([nf])', sec.group(3))):
            if ent.group(3) == b'n':
                offsets[first + i] = int(ent.group(1))

    heads, stream_at = {}, {}
    for num, off in offsets.items():
        m = re.match(rb'\s*(\d+)\s+(\d+)\s+obj', _data[off:off + 40])
        if not m or int(m.group(1)) != num:
            continue
        p = off + m.end()
        s_at, e_at = _data.find(b'stream', p), _data.find(b'endobj', p)
        if s_at != -1 and (e_at == -1 or s_at < e_at):
            heads[num] = _data[p:s_at]
            j = s_at + 6
            j += 2 if _data[j:j + 2] == b'\r\n' else (1 if _data[j:j + 1] in (b'\n', b'\r') else 0)
            stream_at[num] = j
        else:
            heads[num] = _data[p:e_at if e_at != -1 else p + 4096]
    return heads, stream_at


OBJS, STREAM_AT = _load_objects()


def _dict_get(body, key):
    """قراءة قيمة /Key من داخل dict — بتتعامل مع [..] و <<..>> والمراجع."""
    m = re.search(re.escape(key) + rb'\s*', body)
    if not m:
        return None
    p = m.end()
    if body[p:p + 1] == b'[':
        depth = 0
        for q in range(p, len(body)):
            if body[q:q + 1] == b'[':
                depth += 1
            elif body[q:q + 1] == b']':
                depth -= 1
                if depth == 0:
                    return body[p:q + 1]
        return body[p:]
    if body[p:p + 2] == b'<<':
        depth, q = 0, p
        while q < len(body):
            if body[q:q + 2] == b'<<':
                depth += 1
                q += 2
            elif body[q:q + 2] == b'>>':
                depth -= 1
                q += 2
                if depth == 0:
                    return body[p:q]
            else:
                q += 1
        return body[p:]
    m2 = re.match(rb'\s*(\d+\s+\d+\s+R|/[^\s/\[\]<>()]+|[-\d.]+)', body[p:])
    return m2.group(1) if m2 else None


def _resolve(raw):
    m = raw and re.fullmatch(rb'\s*(\d+)\s+\d+\s+R\s*', raw)
    return OBJS[int(m.group(1))] if m else raw


def _stream(num):
    if num not in STREAM_AT:
        return b''
    head, j = OBJS[num], STREAM_AT[num]
    length = _dict_get(head, b'/Length')
    n = None
    if length is not None:
        m = _REF.fullmatch(length.strip())
        n = int(re.search(rb'\d+', OBJS[int(m.group(1))]).group()) if m else int(float(length))
    raw = _data[j:j + n] if n else _data[j:_data.find(b'endstream', j)]
    return zlib.decompressobj().decompress(raw) if b'/FlateDecode' in head else raw


def _pages():
    cat = next(n for n, b in OBJS.items() if b'/Type /Catalog' in b or b'/Type/Catalog' in b)
    root = int(_REF.search(_dict_get(OBJS[cat], b'/Pages')).group(1))
    out = []

    def walk(num):
        body = OBJS[num]
        if b'/Type /Page' in body and b'/Type /Pages' not in body:
            out.append(num)
            return
        for k in _REF.findall(_dict_get(body, b'/Kids') or b''):
            walk(int(k))

    walk(root)
    return out


_FONTS = {}


def _font(num):
    """(two_byte, code→unicode). الخط مجزّأ ومن غير جدول cmap، فالمصدر
    الوحيد للحروف هو الـ ToUnicode — وهو بصيغة bfrange بمصفوفة."""
    if num in _FONTS:
        return _FONTS[num]
    head = OBJS[num]
    table = {}
    tu = _dict_get(head, b'/ToUnicode')
    if tu:
        m = _REF.match(tu.strip())
        if m:
            cmap = _stream(int(m.group(1)))
            for blk in re.findall(rb'beginbfchar(.*?)endbfchar', cmap, re.S):
                toks = _HEXPAIR.findall(blk)
                for i in range(0, len(toks) - 1, 2):
                    table[int(toks[i], 16)] = bytes.fromhex(toks[i + 1].decode()).decode('utf-16-be', 'replace')
            for blk in re.findall(rb'beginbfrange(.*?)endbfrange', cmap, re.S):
                for m2 in re.finditer(
                        rb'<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(?:\[([^\]]*)\]|<([0-9A-Fa-f]+)>)', blk):
                    lo, hi = int(m2.group(1), 16), int(m2.group(2), 16)
                    if m2.group(3) is not None:
                        for i, dst in enumerate(_HEXPAIR.findall(m2.group(3))):
                            table[lo + i] = bytes.fromhex(dst.decode()).decode('utf-16-be', 'replace')
                    else:
                        base = int(m2.group(4), 16)
                        for cc in range(lo, hi + 1):
                            table[cc] = chr(base + (cc - lo))
    _FONTS[num] = (b'/Type0' in head, table)
    return _FONTS[num]


def _unescape(s):
    out, body, i = bytearray(), s[1:-1], 0
    esc = {b'n': 10, b'r': 13, b't': 9, b'b': 8, b'f': 12, b'(': 40, b')': 41, b'\\': 92}
    while i < len(body):
        if body[i:i + 1] == b'\\':
            nxt = body[i + 1:i + 2]
            if nxt in esc:
                out.append(esc[nxt]); i += 2
            elif nxt.isdigit():
                j, oc = i + 1, b''
                while j < len(body) and len(oc) < 3 and body[j:j + 1].isdigit():
                    oc += body[j:j + 1]; j += 1
                out.append(int(oc, 8) & 0xFF); i = j
            elif nxt in (b'\n', b'\r'):
                i += 2
            else:
                out.append(nxt[0]); i += 2
        else:
            out.append(body[i]); i += 1
    return bytes(out)


def _mul(a, b):
    return (a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3],
            a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3],
            a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5])


def _decode(raw, two_byte, table):
    codes = ([int.from_bytes(raw[i:i + 2], 'big') for i in range(0, len(raw) - 1, 2)]
             if two_byte else list(raw))
    return ''.join(table.get(c, '' if two_byte else chr(c)) for c in codes)


def _cell_text(cell):
    """السطور المرسومة → نص بترتيب منطقي. العربي بيتكتب في الـ PDF
    بترتيب بصري (من اليمين للشمال) فبيتقلب هنا."""
    if not cell['runs']:
        return ''
    lines = []
    for y, x, t in sorted(cell['runs'], key=lambda r: (-r[0], -r[1])):
        if lines and abs(lines[-1][0] - y) < 1.5:
            lines[-1][1].append((x, t))
        else:
            lines.append((y, [(x, t)]))
    parts = []
    for _y, runs in lines:
        runs.sort(key=lambda r: -r[0])
        parts.append(''.join(t[::-1] if _ARABIC.search(t) else t for _x, t in runs))
    return ''.join(parts).strip()


def _page_rows(pnum):
    body = OBJS[pnum]
    fonts = {}
    fd = _dict_get(_resolve(_dict_get(body, b'/Resources') or b''), b'/Font')
    if fd:
        for m in re.finditer(rb'(/[A-Za-z0-9_.#-]+)\s+(\d+)\s+0\s+R', _resolve(fd)):
            fonts[m.group(1)] = int(m.group(2))

    cs = b''
    for r in _REF.findall(_dict_get(body, b'/Contents') or b''):
        cs += _stream(int(r)) + b'\n'

    cells, cur, stack = [], None, []
    tm = tlm = (1, 0, 0, 1, 0, 0)
    cur_font, leading = (False, {}), 0.0

    for m in _TOKEN.finditer(cs):
        kind, val = m.lastgroup, m.group()
        if kind == 'op':
            op = val.decode('latin-1')
            if op == 're' and len(stack) >= 4:
                x, y, w, h = (float(v) for v in stack[-4:])
                cur = {'x': x, 'y': y, 'w': w, 'h': h, 'runs': []}
                cells.append(cur)
            elif op == 'Tf' and len(stack) >= 2 and stack[-2] in fonts:
                cur_font = _font(fonts[stack[-2]])
            elif op == 'TL' and stack:
                leading = float(stack[-1])
            elif op in ('Td', 'TD') and len(stack) >= 2:
                tx, ty = float(stack[-2]), float(stack[-1])
                if op == 'TD':
                    leading = -ty
                tlm = tm = _mul((1, 0, 0, 1, tx, ty), tlm)
            elif op == 'Tm' and len(stack) >= 6:
                tlm = tm = tuple(float(v) for v in stack[-6:])
            elif op == 'BT':
                tm = tlm = (1, 0, 0, 1, 0, 0)
            elif op == 'T*':
                tlm = tm = _mul((1, 0, 0, 1, 0, -leading), tlm)
            elif op in ('Tj', 'TJ', "'", '"'):
                if op == 'TJ':
                    arr = stack[-1] if stack and isinstance(stack[-1], list) else []
                    pieces = [e for e in arr if isinstance(e, bytes)]
                else:
                    pieces = [stack[-1]] if stack and isinstance(stack[-1], bytes) else []
                txt = ''.join(_decode(p, cur_font[0], cur_font[1]) for p in pieces)
                # الرن لازم يكون جوّه المستطيل — رقم الصفحة في الفوتر بييجي
                # بعد آخر مستطيل وكان هيتلزق في آخر خانة.
                if txt and cur is not None and \
                        cur['x'] - 2 <= tm[4] <= cur['x'] + cur['w'] + 2 and \
                        cur['y'] - 2 <= tm[5] <= cur['y'] + cur['h'] + 2:
                    cur['runs'].append((round(tm[5], 2), round(tm[4], 2), txt))
            stack = []
        elif kind == 'delim':
            if val == b'[':
                stack.append('[')
            else:
                i = len(stack) - 1
                while i >= 0 and stack[i] != '[':
                    i -= 1
                arr, stack = stack[i + 1:], stack[:i]
                stack.append(arr)
        elif kind == 'num':
            stack.append(float(val))
        elif kind == 'name':
            stack.append(val)
        elif kind == 'str':
            stack.append(_unescape(val))
        elif kind == 'hex':
            h = re.sub(rb'\s', b'', val[1:-1])
            stack.append(bytes.fromhex((h + b'0' if len(h) % 2 else h).decode()))

    bands = {}
    for c in cells:
        bands.setdefault(round(c['y'], 1), []).append(c)
    return [[_cell_text(c) for c in sorted(bands[y], key=lambda c: -c['x'])]
            for y in sorted(bands, reverse=True)]


# ═══════════════════════════════════════════════ تحويل الصفوف
_DATE_RE = re.compile(r'(\d{1,2})\s*-?\s*([؀-ۿ]+)\s*-?\s*(\d{4})'
                      r'(?:\s*(\d{1,2}):(\d{2}):(\d{2}))?')


def parse_date(s):
    m = _DATE_RE.search(s or '')
    if not m or m.group(2) not in MONTHS:
        return None
    h, mi, sec = (int(m.group(4)), int(m.group(5)), int(m.group(6))) if m.group(4) else (0, 0, 0)
    try:
        return datetime.datetime(int(m.group(3)), MONTHS[m.group(2)], int(m.group(1)), h, mi, sec)
    except ValueError:
        return None


def num(s):
    m = re.search(r'-?\d+(?:\.\d+)?', (s or '').replace(',', ''))
    return float(m.group()) if m else 0.0


def to_utc_ms(local_dt):
    """وقت القاهرة المحلي → UTC epoch بالمللي ثانية (زي ما النظام بيخزن)."""
    return int(local_dt.replace(tzinfo=CAIRO).timestamp() * 1000)


def iso_utc(local_dt):
    if local_dt is None:
        return None
    return local_dt.replace(tzinfo=CAIRO).astimezone(datetime.timezone.utc) \
                   .strftime('%Y-%m-%dT%H:%M:%S.000Z')


def new_id(i):
    return f'{ID_PREFIX}{i:06d}{secrets.token_hex(8)}'


def build_rows():
    raw, skipped = [], 0
    for pnum in _pages():
        for cells in _page_rows(pnum):
            if len(cells) != 20 or cells[0].strip() == 'التاريخ':
                continue
            r = dict(zip(COLS, (c.strip() for c in cells)))
            d = parse_date(r['date'])
            if d is None:          # صف الـ Sum اللي في آخر صفحة
                skipped += 1
                continue
            r['_dt'] = d
            raw.append(r)
    raw.sort(key=lambda r: r['_dt'])

    rows = []
    for r in raw:
        paid = num(r['paid'])
        move = r['move']
        start, end = parse_date(r['start']), parse_date(r['end'])
        by = (r['by'] or '').split('@')[0].strip() or None
        method = PAY_MAP.get(r['account'], 'cash')
        # التقرير نفسه بيخزّن "ارتجاع" بمبلغ سالب و"ملغاه" بصفر، وصف الـ Sum
        # بتاعه محسوب على الأساس ده — فالمبلغ بيتاخد زي ما هو من غير أي قلب.

        details = {
            'memberNumber': r['memberNo'] or None,
            'memberName': r['name'] or None,
            'phone': r['phone'] or None,
            'gender': r['gender'] or None,
            'subscriptionPrice': num(r['price']),
            'paidAmount': paid,
            'remainingAmount': num(r['remaining']),
            'staffName': by,
            'salesPersonName': r['rep'] or None,
            'offerName': r['offer'] or None,
            'startDate': iso_utc(start),
            'expiryDate': iso_utc(end),
            'subscriptionDays': (end - start).days if start and end else None,
            'paymentPlan': r['plan'] or None,
            'invoiceNumber': r['invoice'] or None,
            'marketingChannel': r['channel'] or None,
            'movementType': move,
            'importSource': IMPORT_TAG,
        }
        rows.append({
            'local': r['_dt'],
            'createdAt': to_utc_ms(r['_dt']),
            # 'نعم' = اشتراك أول. الباقي تجديد — الليجاتور لام-ألف بيخلي
            # "لا" تطلع "ل" من الـ PDF، فبنقارن على "نعم" بس.
            'type': 'Member' if r['first'] == 'نعم' else 'membershipRenewal',
            'amount': paid,
            'paid': paid,
            'itemDetails': json.dumps(details, ensure_ascii=False),
            'paymentMethod': json.dumps({'methods': [{'method': method, 'amount': paid}]},
                                        ensure_ascii=False),
            'staffName': by,
            'memberNo': r['memberNo'] or None,
            'phone': r['phone'] or None,
            'isCancelled': 1 if move == 'ملغاه' else 0,
            'cancelReason': 'ملغاه — من تقرير gym payments 2026' if move == 'ملغاه' else None,
        })
    return rows, skipped


def link_members(cur, rows):
    """ربط كل صف بعضو برقم العضوية، بشرط إن التليفون يطابق كمان.
    أي صف مايتأكدش بيتساب من غير ربط بدل ما يتعلّق بعضو غلط."""
    digits = lambda p: re.sub(r'\D', '', p or '')[-11:]
    by_num = {}
    for mid, mnum, phone in cur.execute(
            'SELECT id, memberNumber, phone FROM Member WHERE memberNumber IS NOT NULL'):
        by_num.setdefault(str(mnum), (mid, digits(phone)))

    linked = conflict = 0
    for r in rows:
        hit = by_num.get(str(r['memberNo'])) if r['memberNo'] else None
        if not hit:
            r['memberId'] = None
            continue
        mid, mphone = hit
        rphone = digits(r['phone'])
        # التليفون لو ناقص من أي ناحية بنعتمد على رقم العضوية لوحده
        if rphone and mphone and rphone != mphone:
            r['memberId'] = None
            conflict += 1
            continue
        r['memberId'] = mid
        linked += 1
    return linked, conflict


def main():
    rows, skipped = build_rows()
    if not rows:
        sys.exit('❌ مافيش أي صف اتقرا من الـ PDF — اتأكد إن الملف مكانه صح.')

    total_paid = sum(r['paid'] for r in rows)
    ok = abs(total_paid - EXPECTED_TOTAL) < 0.5

    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    old = cur.execute("SELECT COUNT(*), COALESCE(SUM(amount), 0) FROM Receipt "
                      "WHERE id LIKE ?", (ID_PREFIX + '%',)).fetchone()
    max_rn = cur.execute('SELECT MAX(receiptNumber) FROM Receipt').fetchone()[0] or 0

    by_month = {}
    for r in rows:
        k = r['local'].strftime('%Y-%m')
        c, s = by_month.get(k, (0, 0.0))
        by_month[k] = (c + 1, s + r['paid'])

    print(f'التقرير        : {PDF}')
    print(f'قاعدة البيانات : {DB}')
    print(f'المدى          : {rows[0]["local"]:%Y-%m-%d} → {rows[-1]["local"]:%Y-%m-%d} (بتوقيت القاهرة)')
    print(f'صفوف مقروءة    : {len(rows)}   (+{skipped} صف إجمالي/عنوان اتخطى)')
    for k in sorted(by_month):
        c, s = by_month[k]
        print(f'   {k}   {c:4d} صف   {s:11,.0f}')
    print(f'إجمالي المدفوع : {total_paid:,.0f}  '
          f'{"✅ مطابق لصف الـ Sum في التقرير" if ok else f"⚠️  متوقع {EXPECTED_TOTAL:,.0f}"}')
    print(f'   منهم {sum(1 for r in rows if r["amount"] < 0)} ارتجاع '
          f'(بالسالب، إجمالي {sum(r["amount"] for r in rows if r["amount"] < 0):,.0f}) '
          f'و {sum(r["isCancelled"] for r in rows)} ملغاه (بصفر)')
    print(f'أرقام الإيصالات: {max_rn + 1} → {max_rn + len(rows)}')

    # وضع الاستبدال: التقرير بيبقى هو المصدر للشهور اللي بيغطيها.
    # المدى بيتحسب من التقرير نفسه — من أول يوم فيه لآخر يوم، بتوقيت القاهرة.
    doomed = []
    if REPLACE:
        lo = to_utc_ms(rows[0]['local'].replace(hour=0, minute=0, second=0, microsecond=0))
        hi = to_utc_ms((rows[-1]['local'] + datetime.timedelta(days=1))
                       .replace(hour=0, minute=0, second=0, microsecond=0))
        ph = ','.join('?' * len(MEMBERSHIP_TYPES))
        doomed = cur.execute(
            f'SELECT id, amount, type FROM Receipt WHERE createdAt >= ? AND createdAt < ?'
            f' AND type IN ({ph})', (lo, hi, *MEMBERSHIP_TYPES)).fetchall()
        kept = cur.execute(
            f'SELECT type, COUNT(*) n FROM Receipt WHERE createdAt >= ? AND createdAt < ?'
            f' AND type NOT IN ({ph}) GROUP BY 1 ORDER BY 2 DESC', (lo, hi, *MEMBERSHIP_TYPES)).fetchall()
        print(f'استبدال        : هيتمسح {len(doomed)} إيصال اشتراك جوّه المدى '
              f'(بإجمالي {sum(d["amount"] for d in doomed):,.0f}) ويتحط مكانهم صفوف التقرير')
        print('   بيفضل زي ما هو : '
              + (' · '.join(f'{k["type"]} {k["n"]}' for k in kept) or 'مفيش'))
    elif old[0]:
        print(f'⚠️  في {old[0]} إيصال متستورد قبل كده من نفس التقرير (بإجمالي {old[1]:,.0f}). '
              f'{"هيتمسحوا الأول." if PURGE else "شغّل --replace أو --purge عشان ما تكرّرهمش."}')
    linked, conflict = link_members(cur, rows)
    print(f'ربط بالأعضاء   : {linked} صف اتربط بعضو، {len(rows) - linked} من غير ربط'
          + (f' (منهم {conflict} التليفون مختلف)' if conflict else ''))

    if not ok:
        print('\n⚠️  الإجمالي مش مطابق — راجع قبل ما تكمل.')
    if DRY_RUN:
        print('\n--dry-run — مفيش أي تعديل اتعمل.')
        conn.close()
        return

    try:
        cur.execute('BEGIN')
        if PURGE:
            cur.execute('DELETE FROM Receipt WHERE id LIKE ?', (ID_PREFIX + '%',))
        if doomed:
            cur.executemany('DELETE FROM Receipt WHERE id = ?', [(d['id'],) for d in doomed])
        if PURGE or doomed:
            max_rn = cur.execute('SELECT MAX(receiptNumber) FROM Receipt').fetchone()[0] or 0
        cur.executemany(
            'INSERT INTO Receipt (id, receiptNumber, type, amount, itemDetails, paymentMethod,'
            ' createdAt, staffName, memberId, isCancelled, cancelledAt, cancelledBy, cancelReason)'
            ' VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
            [(new_id(i), max_rn + 1 + i, r['type'], r['amount'], r['itemDetails'],
              r['paymentMethod'], r['createdAt'], r['staffName'], r['memberId'], r['isCancelled'],
              r['createdAt'] if r['isCancelled'] else None,
              'استيراد' if r['isCancelled'] else None, r['cancelReason'])
             for i, r in enumerate(rows)])
        cur.execute('UPDATE ReceiptCounter SET current = ? WHERE current < ?',
                    (max_rn + len(rows), max_rn + len(rows)))
        conn.commit()
        print(f'\n✅ تم — {len(rows)} إيصال اتضاف.')
    except Exception as e:
        conn.rollback()
        sys.exit(f'\n❌ فشل — اترجع كل حاجة زي ما كانت: {e}')
    finally:
        conn.close()


if __name__ == '__main__':
    main()
