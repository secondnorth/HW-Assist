const { makeImage, rotated, layoutFor, windowInfo, safeBottom } = require('../../utils/images');
const crop = require('../../utils/crop');

const TOOLS_H = 84; // 工具栏高度（px）
const FOOT_H = 68; // 底部“取消 / 完成”栏高度（px，不含安全区）
const CROP_MARGIN = 20; // 裁切时图片四周留白（px），给拖动边角留位置
const CROP_HIT = 28; // 手指离边多近算“按住了这条边”（px）
const CROP_MIN = 60; // 裁切框最小边长（px）
const CROP_MAX_SIDE = 3000; // 裁切后图片最长边上限（像素）

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
    safe: 0,
    cropping: false, // 是否在裁切模式
    crop: null, // 裁切框 { x, y, w, h }（px，舞台坐标）
    cropPic: null // 裁切模式下图片的摆放 { w, h, left, top }
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
  },

  // ───────────── 裁切 ─────────────

  // 进入裁切：先量出图片真实宽高，再把它按比例摆进舞台
  startCrop() {
    const it = images()[this.data.index];
    wx.getImageInfo({
      src: it.path,
      success: (info) => {
        // 照片带“横拍/竖拍”标记时，显示出来的宽高和文件里记的是反的
        const swap = ['left', 'right', 'left-mirrored', 'right-mirrored'].indexOf(info.orientation) >= 0;
        const natW = swap ? info.height : info.width;
        const natH = swap ? info.width : info.height;
        this.natW = natW;
        this.natH = natH;
        this.fitCrop();
      },
      fail: () => {
        wx.showToast({ title: '图片读取失败', icon: 'none' });
      }
    });
  },

  // 按当前旋转角度摆好图片，裁切框默认盖住整张图
  fitCrop() {
    const it = images()[this.data.index];
    const odd = it.rotate % 180 !== 0;
    const VW = odd ? this.natH : this.natW; // 旋转后的宽高
    const VH = odd ? this.natW : this.natH;
    const rect = crop.fitRect(VW, VH, this.stageW, this.stageH, CROP_MARGIN);
    this.cropRect = rect;
    const bw = odd ? rect.h : rect.w; // 图片元素自己的宽高（旋转之前）
    const bh = odd ? rect.w : rect.h;
    this.setData({
      cropping: true,
      crop: { x: rect.x, y: rect.y, w: rect.w, h: rect.h },
      cropPic: {
        w: bw,
        h: bh,
        left: rect.x + rect.w / 2,
        top: rect.y + rect.h / 2
      }
    });
  },

  resetCrop() {
    const r = this.cropRect;
    this.setData({ crop: { x: r.x, y: r.y, w: r.w, h: r.h } });
  },

  cancelCrop() {
    this.dragging = null;
    this.setData({ cropping: false, crop: null, cropPic: null });
  },

  onCropStart(e) {
    const t = e.touches[0];
    const box = this.data.crop;
    const mode = crop.hitTest(box, t.clientX, t.clientY, CROP_HIT);
    this.dragging = mode ? { mode: mode, x0: t.clientX, y0: t.clientY, box0: Object.assign({}, box) } : null;
  },

  onCropMove(e) {
    const d = this.dragging;
    if (!d) return;
    const t = e.touches[0];
    const box = crop.dragBox(d.box0, d.mode, t.clientX - d.x0, t.clientY - d.y0, this.cropRect, CROP_MIN);
    this.setData({ crop: box });
  },

  onCropEnd() {
    this.dragging = null;
  },

  // 确定：把“旋转 + 裁切”画到画布上，导出成新图片替换这一页
  applyCrop() {
    const rect = this.cropRect;
    const box = this.data.crop;
    if (crop.isFullBox(box, rect, 3)) {
      this.cancelCrop(); // 没动过，不用处理
      return;
    }
    const i = this.data.index;
    const it = images()[i];
    const plan = crop.exportPlan(this.natW, this.natH, it.rotate, rect, box, CROP_MAX_SIDE);

    wx.showLoading({ title: '处理中', mask: true });
    const fail = () => {
      wx.hideLoading();
      wx.showToast({ title: '裁切失败，请重试', icon: 'none' });
    };

    wx.createSelectorQuery()
      .select('#cropCanvas')
      .fields({ node: true })
      .exec((res) => {
        const canvas = res && res[0] && res[0].node;
        if (!canvas) return fail();
        const img = canvas.createImage();
        img.onerror = fail;
        img.onload = () => {
          canvas.width = plan.outW;
          canvas.height = plan.outH;
          const ctx = canvas.getContext('2d');
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, plan.outW, plan.outH);
          // 变换从下往上生效：先旋转，再平移回画面，再对齐裁切起点，最后缩放
          ctx.scale(plan.scale, plan.scale);
          ctx.translate(-plan.cx, -plan.cy);
          ctx.translate(plan.tx, plan.ty);
          ctx.rotate((plan.angle * Math.PI) / 180);
          ctx.drawImage(img, 0, 0, this.natW, this.natH);
          wx.canvasToTempFilePath({
            canvas: canvas,
            fileType: 'jpg',
            quality: 0.92,
            success: (out) => {
              wx.hideLoading();
              const list = images().slice();
              // 旋转已经画进新图片里，角度归零
              list[i] = Object.assign({}, list[i], { path: out.tempFilePath, rotate: 0 });
              setImages(list);
              this.cancelCrop();
              this.show(i);
            },
            fail: fail
          });
        };
        img.src = it.path;
      });
  }
});
