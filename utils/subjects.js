const { toChinese, weekRange } = require('./format');

// 周数 / Lecture / 章数 的取值范围。这个范围不展示给用户，输入不在范围内只提示“输入有误”。
const MIN_NUMBER = 1;
const MAX_NUMBER = 50;

// 五个科目。
//   canSubmit  是否开放“提交作业”（程序设计只显示 ddl，所以是 false）
//   prefix / suffix  提交页里编号输入框两边的字，如 “第 [ ] 周”、“Lecture [ ]”
//   showDates  滚轮里是否在后面标注这一周的具体日期（按周的科目才标）
//   wheelText(n)  滚轮里每一行的文字
const SUBJECTS = [
  {
    name: '数学分析',
    canSubmit: true,
    prefix: '第',
    suffix: '周',
    showDates: true,
    wheelText: (n) => '第' + toChinese(n) + '周'
  },
  {
    name: '高等代数',
    canSubmit: true,
    prefix: 'Lecture',
    suffix: '',
    showDates: false,
    wheelText: (n) => 'Lecture ' + n
  },
  {
    name: '微观经济学',
    canSubmit: true,
    prefix: '第',
    suffix: '章',
    showDates: false,
    wheelText: (n) => '第' + toChinese(n) + '章'
  },
  {
    name: '会计学原理',
    canSubmit: true,
    prefix: '第',
    suffix: '周',
    showDates: true,
    wheelText: (n) => '第' + toChinese(n) + '周'
  },
  {
    name: '程序设计',
    canSubmit: false,
    prefix: '第',
    suffix: '周',
    showDates: false,
    wheelText: (n) => '第' + toChinese(n) + '周'
  }
];

function findSubject(name) {
  return SUBJECTS.find((s) => s.name === name);
}

// 滚轮的每一行：{ n, text, date }。date 是灰色斜体的日期注释，没有就是空串
function wheelRows(subject) {
  const rows = [];
  for (let n = MIN_NUMBER; n <= MAX_NUMBER; n++) {
    rows.push({ n: n, text: subject.wheelText(n), date: subject.showDates ? weekRange(n) : '' });
  }
  return rows;
}

function clamp(n) {
  return Math.min(MAX_NUMBER, Math.max(MIN_NUMBER, n));
}

// 每个科目各记一个“下次要交的编号”，存在本机，默认从 1 开始
function getNext(name) {
  const counters = wx.getStorageSync('counters') || {};
  const n = Number(counters[name]);
  return n >= MIN_NUMBER ? clamp(n) : MIN_NUMBER;
}

function setNext(name, n) {
  const counters = wx.getStorageSync('counters') || {};
  counters[name] = clamp(n);
  wx.setStorageSync('counters', counters);
}

module.exports = { SUBJECTS, MIN_NUMBER, MAX_NUMBER, findSubject, wheelRows, getNext, setNext };
