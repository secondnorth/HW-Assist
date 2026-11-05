// 裁切用到的几何计算。都是纯函数，不碰微信接口，方便单独测试。
//
// 几个名词：
//   舞台   编辑页里显示图片的那块区域，单位 px
//   rect   图片在舞台里实际占的矩形 { x, y, w, h }（已经按旋转后的样子算）
//   box    裁切框 { x, y, w, h }，坐标系和 rect 一样，永远在 rect 里面

// 把 (vw × vh) 的图按比例放进舞台，四周留出 margin，居中。
function fitRect(vw, vh, stageW, stageH, margin) {
  const aw = stageW - 2 * margin;
  const ah = stageH - 2 * margin;
  const s = Math.min(aw / vw, ah / vh);
  const w = vw * s;
  const h = vh * s;
  return { x: (stageW - w) / 2, y: (stageH - h) / 2, w: w, h: h };
}

// 手指按下的位置（px, py）落在裁切框的什么地方。
// 返回 { l, r, t, b, move }：按在边/角上就是对应的边为 true（两个边同时为 true 就是角），
// 按在框里面是 move，其他地方返回 null。r 是触摸判定的半径。
function hitTest(box, px, py, r) {
  const L = box.x;
  const R = box.x + box.w;
  const T = box.y;
  const B = box.y + box.h;
  const dL = Math.abs(px - L);
  const dR = Math.abs(px - R);
  const dT = Math.abs(py - T);
  const dB = Math.abs(py - B);
  const inX = px >= L - r && px <= R + r;
  const inY = py >= T - r && py <= B + r;
  const mode = { l: false, r: false, t: false, b: false, move: false };

  // 框很小时左右两条边的判定区会重叠，谁离得近算谁
  if (inY && dL <= r && dL <= dR) mode.l = true;
  else if (inY && dR <= r) mode.r = true;
  if (inX && dT <= r && dT <= dB) mode.t = true;
  else if (inX && dB <= r) mode.b = true;

  if (mode.l || mode.r || mode.t || mode.b) return mode;
  if (px > L && px < R && py > T && py < B) {
    mode.move = true;
    return mode;
  }
  return null;
}

// 手指从按下点拖动了 (dx, dy)，算出新的裁切框。box0 是按下那一刻的框。
// bounds 是图片矩形（框不能超出去），minSize 是框最小边长。
function dragBox(box0, mode, dx, dy, bounds, minSize) {
  const min = Math.min(minSize, bounds.w, bounds.h);
  const bx0 = bounds.x;
  const by0 = bounds.y;
  const bx1 = bounds.x + bounds.w;
  const by1 = bounds.y + bounds.h;

  if (mode.move) {
    const x = Math.min(Math.max(box0.x + dx, bx0), bx1 - box0.w);
    const y = Math.min(Math.max(box0.y + dy, by0), by1 - box0.h);
    return { x: x, y: y, w: box0.w, h: box0.h };
  }

  let L = box0.x;
  let R = box0.x + box0.w;
  let T = box0.y;
  let B = box0.y + box0.h;
  if (mode.l) L = Math.min(Math.max(L + dx, bx0), R - min);
  if (mode.r) R = Math.max(Math.min(R + dx, bx1), L + min);
  if (mode.t) T = Math.min(Math.max(T + dy, by0), B - min);
  if (mode.b) B = Math.max(Math.min(B + dy, by1), T + min);
  return { x: L, y: T, w: R - L, h: B - T };
}

// 裁切框是不是（几乎）盖住了整张图，是的话不需要处理
function isFullBox(box, rect, tol) {
  return (
    Math.abs(box.x - rect.x) <= tol &&
    Math.abs(box.y - rect.y) <= tol &&
    Math.abs(box.x + box.w - (rect.x + rect.w)) <= tol &&
    Math.abs(box.y + box.h - (rect.y + rect.h)) <= tol
  );
}

function clamp(n, lo, hi) {
  return Math.min(Math.max(n, lo), hi);
}

// 算出怎么把“旋转后再裁切”的结果画到 canvas 上。
//   imgW, imgH  图片自己的宽高（像素，没旋转之前）
//   rotate      顺时针旋转角度 0/90/180/270（旋转会一起“烤”进新图片里）
//   rect, box   舞台上图片矩形和裁切框，只用它们的比例，所以和 px 单位无关
//   maxSide     输出图片最长边的上限（像素）
// 画法：translate(-cx, -cy) → translate(tx, ty) → rotate(angle) → drawImage(img, 0, 0)
function exportPlan(imgW, imgH, rotate, rect, box, maxSide) {
  const odd = rotate % 180 !== 0;
  const VW = odd ? imgH : imgW; // 旋转后图片的宽高（像素）
  const VH = odd ? imgW : imgH;

  let cx = Math.round(((box.x - rect.x) / rect.w) * VW);
  let cy = Math.round(((box.y - rect.y) / rect.h) * VH);
  let cw = Math.round((box.w / rect.w) * VW);
  let ch = Math.round((box.h / rect.h) * VH);
  cx = clamp(cx, 0, VW - 1);
  cy = clamp(cy, 0, VH - 1);
  cw = clamp(cw, 1, VW - cx);
  ch = clamp(ch, 1, VH - cy);

  const scale = Math.min(1, maxSide / Math.max(cw, ch));

  // 图片左上角转完以后落在哪儿，要平移回画面里
  let tx = 0;
  let ty = 0;
  if (rotate === 90) tx = VW;
  else if (rotate === 180) {
    tx = VW;
    ty = VH;
  } else if (rotate === 270) ty = VH;

  return {
    VW: VW,
    VH: VH,
    cx: cx,
    cy: cy,
    cw: cw,
    ch: ch,
    scale: scale,
    outW: Math.max(1, Math.round(cw * scale)),
    outH: Math.max(1, Math.round(ch * scale)),
    tx: tx,
    ty: ty,
    angle: rotate
  };
}

module.exports = { fitRect, hitTest, dragBox, isFullBox, exportPlan };
