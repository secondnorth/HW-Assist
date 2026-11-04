const { SEMESTER_START } = require('./data');

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

function pad2(n) {
  return n < 10 ? '0' + n : String(n);
}

// '2026-11-08 23:59' → Date（按本地时间）。
// 不直接用 new Date('2026-11-08 23:59')，因为 iOS 上不认这种写法。
function parseTime(str) {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?$/.exec(String(str || '').trim());
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] || 0), Number(m[5] || 0));
}

// '2026-11-08 23:59' → 'ddl：11月8日（星期日） 时间：23:59'
function ddlText(str) {
  const d = parseTime(str);
  if (!d) return '';
  return (
    'ddl：' + (d.getMonth() + 1) + '月' + d.getDate() + '日（星期' + WEEKDAYS[d.getDay()] + '） ' +
    '时间：' + pad2(d.getHours()) + ':' + pad2(d.getMinutes())
  );
}

// 1~99 转中文数字：9 → 九，10 → 十，11 → 十一，20 → 二十，35 → 三十五
function toChinese(n) {
  n = Math.floor(n);
  if (n <= 0 || n >= 100) return String(n);
  if (n < 10) return DIGITS[n];
  if (n === 10) return '十';
  if (n < 20) return '十' + DIGITS[n - 10];
  const t = Math.floor(n / 10);
  const u = n % 10;
  return DIGITS[t] + '十' + (u ? DIGITS[u] : '');
}

// 第 n 周对应的日期范围，如 '11.2-11.8'（周一到周日）
function weekRange(n) {
  const s = parseTime(SEMESTER_START);
  const a = new Date(s.getFullYear(), s.getMonth(), s.getDate() + (n - 1) * 7);
  const b = new Date(a.getFullYear(), a.getMonth(), a.getDate() + 6);
  return (a.getMonth() + 1) + '.' + a.getDate() + '-' + (b.getMonth() + 1) + '.' + b.getDate();
}

// 在一个科目的作业列表里，找出“还没截止、离现在最近”的那一项；都截止了返回 null
function pickUpcoming(list, now) {
  let best = null;
  let bestTime = 0;
  (list || []).forEach((a) => {
    const d = parseTime(a.ddl);
    if (!d || d.getTime() <= now.getTime()) return;
    if (!best || d.getTime() < bestTime) {
      best = a;
      bestTime = d.getTime();
    }
  });
  return best;
}

module.exports = { parseTime, ddlText, toChinese, weekRange, pickUpcoming };
