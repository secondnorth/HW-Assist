// 图片对象：{ id, path, rotate }
//   id      唯一编号（列表渲染用）
//   path    本地临时路径
//   rotate  顺时针旋转角度，只会是 0 / 90 / 180 / 270
// 一次最多放多少页
const MAX_PAGES = 20;

let seq = 0;

function makeImage(path) {
  seq += 1;
  return { id: Date.now() + '_' + seq, path: path, rotate: 0 };
}

// 旋转 dir 个 90°（dir 为 1 是向右，-1 是向左），结果仍落在 0~270
function rotated(img, dir) {
  return Object.assign({}, img, { rotate: (img.rotate + dir * 90 + 360) % 360 });
}

// 大图/编辑页的排版：旋转 90°/270° 时，图片框的宽高要互换，
// 这样转完以后正好占满舞台，不会被裁掉。
function layoutFor(img, stageW, stageH) {
  const odd = img.rotate % 180 !== 0;
  return {
    id: img.id,
    path: img.path,
    rotate: img.rotate,
    w: Math.round(odd ? stageH : stageW),
    h: Math.round(odd ? stageW : stageH)
  };
}

// 取窗口信息，新接口优先
function windowInfo() {
  return wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
}

// 底部安全区高度（px），没有就是 0
function safeBottom(info) {
  if (!info.safeArea || !info.screenHeight) return 0;
  return Math.max(0, info.screenHeight - info.safeArea.bottom);
}

module.exports = { MAX_PAGES, makeImage, rotated, layoutFor, windowInfo, safeBottom };
