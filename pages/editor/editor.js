const { makeImage, rotated, layoutFor, windowInfo, safeBottom } = require('../../utils/images');

const TOOLS_H = 84; // 工具栏高度（px）
const FOOT_H = 68; // 底部“取消 / 完成”栏高度（px，不含安全区）

function images() {
  return getApp().globalData.images;
}

function setImages(list) {
  getApp().globalData.images = list;
}

Page({
  data: {
    item: null, // 当前这页的排版：{ id, path, rotate, w, h }
    index: 0,
    total: 0,
    canPrev: false,
    canNext: false,
    stageH: 0,
    toolsH: TOOLS_H,
    footH: 0,
    safe: 0
  },

  onLoad(options) {
    const info = windowInfo();
    const safe = safeBottom(info);
    const footH = FOOT_H + safe;
    this.stageW = info.windowWidth;
    this.stageH = info.windowHeight - TOOLS_H - footH;
    // 进入时先存一份，点“取消”就恢复成这样
    this.snapshot = images().map((im) => Object.assign({}, im));
    const index = Math.min(Math.max(Number(options.index) || 0, 0), images().length - 1);
    this.setData({ stageH: this.stageH, footH: footH, safe: safe });
    this.show(index);
  },

  show(index) {
    const list = images();
    this.setData({
      index: index,
      total: list.length,
      item: layoutFor(list[index], this.stageW, this.stageH),
      canPrev: index > 0,
      canNext: index < list.length - 1
    });
  },

  // dir：-1 向左旋转，1 向右旋转
  rotate(e) {
    const dir = Number(e.currentTarget.dataset.dir);
    const list = images().slice();
    const i = this.data.index;
    list[i] = rotated(list[i], dir);
    setImages(list);
    this.show(i);
  },

  // 重拍：拍一张新的，替换这一页（旋转角度清零）
  retake() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera'],
      sizeType: ['compressed'],
      success: (res) => {
        const list = images().slice();
        const i = this.data.index;
        list[i] = makeImage(res.tempFiles[0].tempFilePath);
        setImages(list);
        this.show(i);
      }
    });
  },

  // dir：-1 前移一位，1 后移一位
  move(e) {
    const dir = Number(e.currentTarget.dataset.dir);
    const list = images().slice();
    const i = this.data.index;
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const tmp = list[i];
    list[i] = list[j];
    list[j] = tmp;
    setImages(list);
    this.show(j); // 跟着这张图走，页面上仍停在它身上
  },

  remove() {
    const list = images().slice();
    const i = this.data.index;
    list.splice(i, 1);
    setImages(list);
    if (!list.length) {
      // 删光了：连大图页一起退回提交页
      getApp().globalData.viewIndex = null;
      wx.navigateBack({ delta: 2 });
      return;
    }
    this.show(Math.min(i, list.length - 1));
  },

  cancel() {
    setImages(this.snapshot);
    wx.navigateBack();
  },

  done() {
    getApp().globalData.viewIndex = this.data.index;
    wx.navigateBack();
  }
});
