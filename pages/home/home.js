const { SUBJECTS, getNext } = require('../../utils/subjects');

Page({
  data: {
    profile: { name: '', studentId: '' },
    subjects: []
  },

  onShow() {
    const profile = wx.getStorageSync('profile') || { name: '', studentId: '' };
    const subjects = SUBJECTS.map((s) => ({
      name: s.name,
      nextLabel: s.label(getNext(s.name))
    }));
    this.setData({ profile, subjects });
  },

  goProfile() {
    wx.navigateTo({ url: '/pages/profile/profile' });
  },

  chooseSubject(e) {
    if (!this.data.profile.name || !this.data.profile.studentId) {
      wx.showToast({ title: '请先填写姓名和学号', icon: 'none' });
      setTimeout(() => this.goProfile(), 600);
      return;
    }
    const name = e.currentTarget.dataset.name;
    wx.navigateTo({ url: '/pages/submit/submit?subject=' + encodeURIComponent(name) });
  }
});
