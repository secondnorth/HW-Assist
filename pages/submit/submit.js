const api = require('../../utils/api');
const { findSubject, getNext, setNext } = require('../../utils/subjects');

const MAX_PAGES = 20;
// 想要文字更清晰可改成 ['original']（原图更大，上传更慢）
const SIZE_TYPE = ['compressed'];

Page({
  data: {
    subjectName: '',
    number: 1, // 本次的编号 X
    numberText: '1', // 输入框里显示的文字（允许用户输入过程中是空的）
    xLabel: '',
    wheelValue: [0], // 滚轮当前位置（= 编号 - 1）
    labels: [], // 滚轮上的每一行文字，如 第1周 … 第17周
    maxNumber: 17,
    profile: { name: '', studentId: '' },
    images: [], // [{ path: 本地临时路径, rotate: 0/90/180/270（顺时针） }]，数组顺序即 PDF 页序
    maxPages: MAX_PAGES,
    enhance: true,
    loading: false,
    loadingText: '',
    result: null // { filename, filePath, warnings }
  },

  onLoad(options) {
    const name = decodeURIComponent(options.subject || '');
    const subject = findSubject(name);
    if (!subject) {
      wx.reLaunch({ url: '/pages/home/home' });
      return;
    }
    this.subject = subject;
    wx.setNavigationBarTitle({ title: subject.name });

    const labels = [];
    for (let n = 1; n <= subject.max; n++) {
      labels.push(subject.label(n));
    }
    // 滚轮的行和选中位置放在同一次 setData 里，避免位置没生效
    this.setData(
      Object.assign(
        { subjectName: subject.name, labels: labels, maxNumber: subject.max },
        this.numberFields(getNext(subject.name))
      )
    );
  },

  onShow() {
    const profile = wx.getStorageSync('profile') || { name: '', studentId: '' };
    this.setData({ profile });
  },

  goProfile() {
    wx.navigateTo({ url: '/pages/profile/profile' });
  },

  // ---------- 编号 ----------
  // 根据编号 n 算出所有相关的显示字段
  numberFields(n) {
    return {
      number: n,
      numberText: String(n),
      xLabel: this.subject.label(n),
      wheelValue: [n - 1]
    };
  },

  // 上下滑动滚轮
  onWheelChange(e) {
    const n = e.detail.value[0] + 1;
    this.setData(Object.assign(this.numberFields(n), { result: null }));
  },

  // 输入过程中：数字合法就同步滚轮；不合法先不管，等输入完（失焦）再处理
  onNumInput(e) {
    const text = e.detail.value;
    const n = parseInt(text, 10);
    if (n >= 1 && n <= this.subject.max) {
      this.setData(
        Object.assign(this.numberFields(n), { numberText: text, result: null })
      );
    }
  },

  // 输入完成：空的、0、超过上限的都要纠正
  onNumBlur(e) {
    const max = this.subject.max;
    let n = parseInt(e.detail.value, 10);
    if (!(n >= 1)) {
      wx.showToast({ title: '请输入 1~' + max + ' 的数字', icon: 'none' });
      n = this.data.number;
    } else if (n > max) {
      wx.showToast({ title: '最大只到 ' + max, icon: 'none' });
      n = max;
    }
    this.setData(Object.assign(this.numberFields(n), { result: null }));
  },

  onEnhanceChange(e) {
    this.setData({ enhance: e.detail.value, result: null });
  },

  // ---------- 图片 ----------
  updateImages(images) {
    this.setData({ images, result: null });
  },

  chooseImages() {
    const remain = MAX_PAGES - this.data.images.length;
    if (remain <= 0) return;
    wx.chooseMedia({
      count: Math.min(remain, 9),
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      sizeType: SIZE_TYPE,
      success: (res) => {
        const added = res.tempFiles.map((f) => ({ path: f.tempFilePath, rotate: 0 }));
        this.updateImages(this.data.images.concat(added));
      }
    });
  },

  // 点击某一页，弹出操作菜单（微信限制最多 6 项）
  onTapImage(e) {
    const idx = Number(e.currentTarget.dataset.index);
    const last = this.data.images.length - 1;
    const items = ['查看大图', '向右旋转 90°', '重拍这一页'];
    const actions = ['view', 'rotate', 'retake'];
    if (idx > 0) {
      items.push('前移一位');
      actions.push('forward');
    }
    if (idx < last) {
      items.push('后移一位');
      actions.push('back');
    }
    items.push('删除这一页');
    actions.push('delete');

    wx.showActionSheet({
      itemList: items,
      success: (res) => this.doAction(actions[res.tapIndex], idx)
    });
  },

  doAction(action, idx) {
    const images = this.data.images.slice();
    if (action === 'view') {
      wx.previewImage({ current: images[idx].path, urls: images.map((i) => i.path) });
    } else if (action === 'rotate') {
      images[idx] = { path: images[idx].path, rotate: (images[idx].rotate + 90) % 360 };
      this.updateImages(images);
    } else if (action === 'retake') {
      this.retake(idx);
    } else if (action === 'forward') {
      const tmp = images[idx - 1];
      images[idx - 1] = images[idx];
      images[idx] = tmp;
      this.updateImages(images);
    } else if (action === 'back') {
      const tmp = images[idx + 1];
      images[idx + 1] = images[idx];
      images[idx] = tmp;
      this.updateImages(images);
    } else if (action === 'delete') {
      images.splice(idx, 1);
      this.updateImages(images);
    }
  },

  retake(idx) {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera'],
      sizeType: SIZE_TYPE,
      success: (res) => {
        const images = this.data.images.slice();
        images[idx] = { path: res.tempFiles[0].tempFilePath, rotate: 0 };
        this.updateImages(images);
      }
    });
  },

  // ---------- 生成 PDF ----------
  async generate() {
    const { profile, images, number, enhance } = this.data;

    if (!profile.name || !profile.studentId) {
      wx.showToast({ title: '请先填写姓名和学号', icon: 'none' });
      return;
    }
    if (!images.length) {
      wx.showToast({ title: '请先拍照', icon: 'none' });
      return;
    }

    // 一次生成任务的唯一编号，后端用它把同一批图片归到一起
    const taskId = Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    this.setData({ loading: true, result: null });

    try {
      // 图片按当前页序依次上传，index 就是页码（从 0 开始）
      for (let i = 0; i < images.length; i++) {
        this.setData({ loadingText: '上传第 ' + (i + 1) + '/' + images.length + ' 页…' });
        await api.uploadPage(taskId, i, images[i].path);
      }

      this.setData({ loadingText: '正在处理并生成 PDF…' });
      const res = await api.makePdf({
        task_id: taskId,
        subject: this.subject.name,
        number: number,
        name: profile.name,
        student_id: profile.studentId,
        rotations: images.map((i) => i.rotate), // 与页码一一对应
        enhance: enhance
      });

      this.setData({ loadingText: '正在下载…' });
      const filePath = await api.downloadFile(res.url);

      // 成功后，下次编号自动 +1（页面上当前显示的编号保持不变）
      setNext(this.subject.name, number + 1);
      this.setData({
        result: { filename: res.filename, filePath, warnings: res.warnings || [] }
      });
    } catch (err) {
      wx.showModal({
        title: '出错了',
        content: (err && err.message) || '未知错误',
        showCancel: false
      });
    } finally {
      this.setData({ loading: false, loadingText: '' });
    }
  },

  // ---------- 导出 ----------
  openPdf() {
    wx.openDocument({
      filePath: this.data.result.filePath,
      fileType: 'pdf',
      showMenu: true // 右上角菜单里可转发、用其他应用打开
    });
  },

  sharePdf() {
    const { filePath, filename } = this.data.result;
    wx.shareFileMessage({
      filePath,
      fileName: filename, // 发出去的文件名就是后端自动命名的结果
      fail: (e) => {
        wx.showToast({ title: '未发送：' + (e.errMsg || ''), icon: 'none' });
      }
    });
  },

  // 再做一份：清空照片，编号取最新的“下次编号”
  reset() {
    this.setData(Object.assign({ images: [], result: null }, this.numberFields(getNext(this.subject.name))));
  }
});
