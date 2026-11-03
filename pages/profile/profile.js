Page({
  data: {
    name: '',
    studentId: ''
  },

  onLoad() {
    const p = wx.getStorageSync('profile') || {};
    this.setData({ name: p.name || '', studentId: p.studentId || '' });
  },

  onNameInput(e) {
    this.setData({ name: e.detail.value });
  },

  onIdInput(e) {
    this.setData({ studentId: e.detail.value });
  },

  save() {
    const name = this.data.name.trim();
    const studentId = this.data.studentId.trim();
    if (!name || !studentId) {
      wx.showToast({ title: '姓名和学号都要填', icon: 'none' });
      return;
    }
    wx.setStorageSync('profile', { name, studentId });
    wx.showToast({ title: '已保存', icon: 'success' });
    setTimeout(() => wx.navigateBack(), 600);
  }
});
