const { MAX_PAGES, makeImage, windowInfo, safeBottom } = require('../../utils/images');

const STRIP_H = 76; // 已拍缩略图一栏的高度（px）
const BAR_H = 104; // 底部快门栏高度（px，不含安全区）

Page({
  data: {
    shots: [], // 本次连拍已拍的照片路径
    left: 0, // 还能再拍几张
    denied: false, // 没有相机权限
    camH: 0,
    stripH: STRIP_H,
    barH: 0,
    safe: 0
  },

  onLoad() {
    const info = windowInfo();
    const safe = safeBottom(info);
    const barH = BAR_H + safe;
    this.shots = [];
    this.capacity = MAX_PAGES - getApp().globalData.images.length; // 总共还能放几张
    this.setData({
      camH: info.windowHeight - STRIP_H - barH,
      barH: barH,
      safe: safe,
      left: this.capacity
    });
    this.updateTitle();
    wx.authorize({
      scope: 'scope.camera',
      fail: () => this.setData({ denied: true })
    });
  },

  // 标题栏显示还能再拍几张
  updateTitle() {
    wx.setNavigationBarTitle({ title: '批量拍照（还能拍 ' + (this.capacity - this.shots.length) + ' 张）' });
  },

  shoot() {
    if (this.busy) return;
    if (this.shots.length >= this.capacity) {
      wx.showToast({ title: '照片已经满了', icon: 'none' });
      return;
    }
    this.busy = true;
    wx.createCameraContext().takePhoto({
      quality: 'high',
      success: (res) => {
        this.shots.push(res.tempImagePath);
        this.setData({
          shots: this.shots.slice(),
          left: this.capacity - this.shots.length
        });
        this.updateTitle();
      },
      fail: () => wx.showToast({ title: '拍照失败，请重试', icon: 'none' }),
      complete: () => {
        this.busy = false;
      }
    });
  },

  // 完成：把这次拍的全部加到照片列表末尾，回到提交页
  finish() {
    if (this.shots.length) {
      const app = getApp();
      app.globalData.images = app.globalData.images.concat(this.shots.map((p) => makeImage(p)));
    }
    wx.navigateBack();
  },

  cancel() {
    if (!this.shots.length) {
      wx.navigateBack();
      return;
    }
    wx.showModal({
      title: '放弃这次拍的照片？',
      content: '已经拍了 ' + this.shots.length + ' 张，退出后不会保留。',
      confirmText: '放弃',
      success: (res) => {
        if (res.confirm) wx.navigateBack();
      }
    });
  },

  openSetting() {
    wx.openSetting({
      success: (res) => {
        if (res.authSetting && res.authSetting['scope.camera']) this.setData({ denied: false });
      }
    });
  },

  onError() {
    wx.showModal({
      title: '相机不可用',
      content: '电脑上的开发者工具可能不支持相机，请用手机“预览”来试；或者回到上一页用“拍照/相册”。',
      showCancel: false
    });
  }
});
