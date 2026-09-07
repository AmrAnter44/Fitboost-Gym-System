#!/usr/bin/env python3
# scripts/fix-text-datetimes.py
# -------------------------------------------------------------
# تصليح التواريخ المخزّنة نص (TEXT) في قاعدة البيانات المهاجرة من
# النظام القديم — بيحوّلها لـ INTEGER (UTC epoch ms) زي ما Prisma
# والنظام بيخزّنوا.
#
# المشكلة: الصفوف المهاجرة تواريخها متخزّنة كنص ISO زي
# '2026-01-01T00:31:05.000Z' بدل رقم. SQLite بيقارن النص مع الرقم
# على إنه أكبر من أي رقم، فأي فلتر بتاريخ بيتجاهل الصفوف دي تمامًا —
# يعني شهور ديسمبر ٢٠٢٥ → مايو ٢٠٢٦ بتطلع فاضية في التقارير رغم إن
# الداتا موجودة فعلًا في الداتابيز.
#
# ⚠️ التوقيت: النص ده وقت محلي (القاهرة) وعليه لاحقة Z غلط — مش UTC.
#    الدليل: تقرير "gym payments 2026.pdf" (اللي بيطبع بالتوقيت
#    المحلي) بيدّي نفس الساعة بالظبط للصف نفسه — مثلًا فاتورة No.192
#    في التقرير 2026-01-01 00:31:05، وفي الداتابيز
#    '2026-01-01T00:31:05.000Z'. ٧١٤ صف من التقرير طابقوا كده
#    بالظبط، وصفر صف طابق لو اتقرا النص كـ UTC.
#    عشان كده التحويل بيقرا النص كتوقيت قاهرة.
#
# التشغيل:
#   python3 scripts/fix-text-datetimes.py --dry-run
#   python3 scripts/fix-text-datetimes.py --only Receipt
#   python3 scripts/fix-text-datetimes.py
#   GYM_DB=prisma/gym.db python3 scripts/fix-text-datetimes.py
# -------------------------------------------------------------

import datetime
import os
import re
import shutil
import sqlite3
import sys
from zoneinfo import ZoneInfo

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = os.environ.get('GYM_DB', os.path.join(ROOT, 'prisma', 'gym.db'))
CAIRO = ZoneInfo('Africa/Cairo')

DRY_RUN = '--dry-run' in sys.argv
ONLY = None
if '--only' in sys.argv:
    ONLY = sys.argv[sys.argv.index('--only') + 1]

# الجداول/الأعمدة اللي بتتصلّح. _prisma_migrations مستثنى عن قصد —
# ده جدول بتاع Prisma نفسه وبيتوقّع نص.
TARGETS = [
    ('Receipt', 'createdAt'),
    ('Visitor', 'createdAt'),
    ('FollowUpActivity', 'createdAt'),
    ('FollowUp', 'nextFollowUpDate'),
    ('Expense', 'createdAt'),
    ('DayUseInBody', 'createdAt'),
    ('PT', 'startDate'),
    ('Staff', 'createdAt'),
    ('DayUseService', 'createdAt'),
]

ISO = re.compile(r'^(\d{4})-(\d{2})-(\d{2})([T ])(\d{2}):(\d{2}):(\d{2})')


def to_ms(text):
    """نص تاريخ → UTC epoch ms. None لو الصيغة مش مفهومة.

    في صيغتين مختلفتين وكل واحدة توقيتها غير:
      '2026-01-01T00:31:05.000Z'  ← صفوف الهجرة من النظام القديم.
          دي وقت قاهرة محلي واللاحقة Z غلط (اتأكدنا من التقرير).
      '2026-08-22 23:17:22'       ← CURRENT_TIMESTAMP بتاع SQLite،
          ودي UTC حقيقي.
    """
    m = ISO.match((text or '').strip())
    if not m:
        return None
    g = m.groups()
    try:
        naive = datetime.datetime(*(int(x) for x in (g[0], g[1], g[2], g[4], g[5], g[6])))
    except ValueError:
        return None
    tz = CAIRO if g[3] == 'T' else datetime.timezone.utc
    return int(naive.replace(tzinfo=tz).timestamp() * 1000)


def main():
    if not os.path.exists(DB):
        sys.exit(f'❌ مالقيتش قاعدة البيانات: {DB}')

    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    have = {r[0] for r in cur.execute(
        "SELECT name FROM sqlite_master WHERE type='table'")}

    print(f'قاعدة البيانات : {DB}')
    print(f'التحويل        : نص (وقت القاهرة) → INTEGER بالـ UTC epoch ms\n')

    plan, skipped = [], []
    for table, col in TARGETS:
        if table not in have or (ONLY and table != ONLY):
            continue
        rows = cur.execute(
            f'SELECT rowid, "{col}" FROM "{table}" WHERE typeof("{col}") = \'text\'').fetchall()
        if not rows:
            continue
        conv, bad = [], []
        for rid, val in rows:
            ms = to_ms(val)
            (conv if ms is not None else bad).append((ms, rid) if ms is not None else val)
        if conv:
            lo = min(c[0] for c in conv)
            hi = max(c[0] for c in conv)
            fmt = lambda ms: datetime.datetime.fromtimestamp(ms / 1000, datetime.timezone.utc) \
                                     .astimezone(CAIRO).strftime('%Y-%m-%d')
            print(f'  {table}.{col:18} {len(conv):5d} صف   {fmt(lo)} → {fmt(hi)}'
                  + (f'   ⚠️ {len(bad)} صيغة غير مفهومة' if bad else ''))
            plan.append((table, col, conv))
        if bad:
            skipped.append((table, col, bad[:3]))

    if not plan:
        print('  مفيش أي صف محتاج تصليح. ✅')
        conn.close()
        return

    total = sum(len(c) for _t, _c, c in plan)
    print(f'\nالإجمالي       : {total} صف في {len(plan)} جدول')
    for t, c, sample in skipped:
        print(f'  ⚠️  {t}.{c} فيه صيغ مش متعرّف عليها، هتفضل زي ما هي: {sample}')

    if DRY_RUN:
        print('\n--dry-run — مفيش أي تعديل اتعمل.')
        conn.close()
        return

    bak = DB + '.bak-before-datetime-fix'
    dst = sqlite3.connect(bak)
    with dst:
        conn.backup(dst)
    dst.close()
    print(f'\nنسخة احتياطية  : {bak}')

    try:
        cur.execute('BEGIN')
        for table, col, conv in plan:
            cur.executemany(f'UPDATE "{table}" SET "{col}" = ? WHERE rowid = ?', conv)
        conn.commit()
        print(f'✅ تم — {total} صف اتحوّل.')
    except Exception as e:
        conn.rollback()
        sys.exit(f'❌ فشل — اترجع كل حاجة زي ما كانت: {e}')
    finally:
        conn.close()


if __name__ == '__main__':
    main()
