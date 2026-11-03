// 编号上限：一共 17 周（高等代数的 Lecture、微观经济学的章也沿用 17，
// 如果某科目数量不同，改它自己那一项的 max 即可）
const MAX_NUMBER = 17;

// label(n)：把编号 n 显示成“第3周 / Lecture3 / 第3章”
const SUBJECTS = [
  { name: '数学分析', max: MAX_NUMBER, label: (n) => '第' + n + '周' },
  { name: '高等代数', max: MAX_NUMBER, label: (n) => 'Lecture' + n },
  { name: '微观经济学', max: MAX_NUMBER, label: (n) => '第' + n + '章' },
  { name: '会计学原理', max: MAX_NUMBER, label: (n) => '第' + n + '周' }
];

function findSubject(name) {
  return SUBJECTS.find((s) => s.name === name);
}

// 每个科目各记一个“下次要交的编号”，存在本机，默认从 1 开始，最大不超过 max
function getNext(name) {
  const subject = findSubject(name);
  const max = subject ? subject.max : MAX_NUMBER;
  const counters = wx.getStorageSync('counters') || {};
  const n = Number(counters[name]);
  if (!(n >= 1)) return 1;
  return Math.min(n, max);
}

function setNext(name, n) {
  const subject = findSubject(name);
  const max = subject ? subject.max : MAX_NUMBER;
  const counters = wx.getStorageSync('counters') || {};
  counters[name] = Math.min(n, max);
  wx.setStorageSync('counters', counters);
}

module.exports = { SUBJECTS, MAX_NUMBER, findSubject, getNext, setNext };
