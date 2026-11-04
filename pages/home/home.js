const { SUBJECTS, findSubject } = require('../../utils/subjects');
const { ASSIGNMENTS } = require('../../utils/data');
const { ddlText, pickUpcoming, parseTime } = require('../../utils/format');

// 某科目的作业列表，按编号从小到大排好
function listOf(name) {
  return (ASSIGNMENTS[name] || []).slice().sort((a, b) => a.number - b.number);
}

// 卡片上的 ddl 一行：取“还没截止、离现在最近”的那一项；没有就显示“暂无”
function ddlLine(name) {
  const list = listOf(name);
  list.forEach((a) => {
    if (a.ddl && !parseTime(a.ddl)) {
      // 管理员把 ddl 写错格式时，在控制台提醒（正确格式：'2026-11-08 23:59'）
      console.warn('[data.js] ' + name + ' 第' + a.number + '项的 ddl 格式不对：' + a.ddl);
    }
  });
  const next = pickUpcoming(list, new Date());
  return next ? ddlText(next.ddl) : 'ddl：暂无';
}

// 把一次作业整理成弹窗要显示的内容
function buildCard(subject, list, index) {
  const a = list[index];
  return {
    show: true,
    subject: subject.name,
    title: a.title || subject.prefix + a.number + subject.suffix + '作业',
    ddl: a.ddl ? ddlText(a.ddl) : '',
    items: (a.items || []).map((it, i) => ({ key: i, label: it.label, text: it.text })),
    supplements: (a.supplements || []).map((s, i) => ({
      key: i,
      title: s.title,
      tag: s.type === 'doc' ? '文档' : '链接'
    })),
    hasPrev: index > 0,
    hasNext: index < list.length - 1,
    pos: index + 1 + ' / ' + list.length
  };
}

Page({
  data: {
    profile: { name: '', studentId: '' },
    subjects: [],
    popup: { show: false }
  },

  onShow() {
    const profile = wx.getStorageSync('profile') || { name: '', studentId: '' };
    const subjects = SUBJECTS.map((s) => ({
      name: s.name,
      canSubmit: s.canSubmit,
      ddl: ddlLine(s.name)
    }));
    this.setData({ profile, subjects });
  },

  noop() {},

  goProfile() {
    wx.navigateTo({ url: '/pages/profile/profile' });
  },

  goSubmit(e) {
    if (!this.data.profile.name || !this.data.profile.studentId) {
      wx.showToast({ title: '请先填写姓名和学号', icon: 'none' });
      setTimeout(() => this.goProfile(), 600);
      return;
    }
    const name = e.currentTarget.dataset.name;
    wx.navigateTo({ url: '/pages/submit/submit?subject=' + encodeURIComponent(name) });
  },

  // ---------- 作业详情（公告弹窗） ----------
  openDetail(e) {
    const subject = findSubject(e.currentTarget.dataset.name);
    const list = listOf(subject.name);
    if (!list.length) {
      wx.showToast({ title: '管理员还没有发布作业内容', icon: 'none' });
      return;
    }
    // 默认显示“本周”的：最近一个还没截止的；都截止了就显示最新的一次
    const upcoming = pickUpcoming(list, new Date());
    let index = list.length - 1;
    if (upcoming) index = list.indexOf(upcoming);
    this.subject = subject;
    this.list = list;
    this.index = index;
    this.setData({ popup: buildCard(subject, list, index) });
  },

  closePopup() {
    this.setData({ popup: { show: false } });
  },

  // 左箭头：看更早的一次
  prevItem() {
    if (this.index <= 0) return;
    this.index -= 1;
    this.setData({ popup: buildCard(this.subject, this.list, this.index) });
  },

  // 右箭头：回到更新的一次
  nextItem() {
    if (this.index >= this.list.length - 1) return;
    this.index += 1;
    this.setData({ popup: buildCard(this.subject, this.list, this.index) });
  },

  // 点补充作业：文档就下载并打开，链接就复制
  openSupplement(e) {
    const s = this.list[this.index].supplements[Number(e.currentTarget.dataset.index)];
    if (!s) return;

    if (s.type === 'doc') {
      wx.showLoading({ title: '打开中…' });
      wx.downloadFile({
        url: s.url,
        success: (res) => {
          if (res.statusCode !== 200) {
            wx.showToast({ title: '下载失败', icon: 'none' });
            return;
          }
          const opts = {
            filePath: res.tempFilePath,
            showMenu: true,
            fail: () => wx.showToast({ title: '打不开这个文件', icon: 'none' })
          };
          if (s.fileType) opts.fileType = s.fileType;
          wx.openDocument(opts);
        },
        fail: () => wx.showToast({ title: '下载失败', icon: 'none' }),
        complete: () => wx.hideLoading()
      });
      return;
    }

    // 小程序里不能直接打开外部网页，所以把链接复制下来，让同学去浏览器粘贴
    wx.setClipboardData({
      data: s.url,
      success: () => {
        wx.hideToast();
        wx.showToast({ title: '链接已复制，请到浏览器粘贴打开', icon: 'none', duration: 2500 });
      }
    });
  }
});
