const { layoutFor, windowInfo, safeBottom } = require('../../utils/images');

const BAR_H = 56; // 底部栏高度（px，不含底部安全区）

Page({
  data: {
    items: [], // 每页的排版：{ id, path, rotate, w, h }
    current: 0,
    total: 0,
    stageH: 0,
    barH: 0,
    safe: 0
  },

  onLoad(options) {
    const info = windowInfo();
    const safe = safeBottom(info);
    const barH = BAR_H + safe;
    this.stageW = info.windowWidth;
    this.setData({
      stageH: info.windowHeight - barH,
      barH: barH,
      safe: safe,
      current: Number(options.index) || 0
    });
  },

  // 从编辑页回来时，照片可能被旋转、换序、删除，所以每次显示都重新读
  onShow() {
    const app = getApp();
    const list = app.globalData.images;
    if (!list.length) {
      wx.navigateBack();
      return;
    }
    let current = this.data.current;
    if (app.globalData.viewIndex != null) {
      current = app.globalData.viewIndex; // 编辑页告诉我们它停在了第几页
      app.globalData.viewIndex = null;
    }
    current = Math.min(Math.max(current, 0), list.length - 1);
    this.setData({
      items: list.map((im) => layoutFor(im, this.stageW, this.data.stageH)),
      total: list.length,
      current: current
    });
  },

  onChange(e) {
    this.setData({ current: e.detail.current });
  },

  goEdit() {
    wx.navigateTo({ url: '/pages/editor/editor?index=' + this.data.current });
  }
});
