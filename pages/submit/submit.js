const api = require('../../utils/api');
const { MAX_PAGES, makeImage, rotated } = require('../../utils/images');
const {
  findSubject,
  wheelRows,
  getNext,
  setNext,
  MIN_NUMBER,
  MAX_NUMBER
} = require('../../utils/subjects');

// 想要文字更清晰可改成 ['original']（原图更大，上传更慢）
const SIZE_TYPE = ['compressed'];

// 提交页、大图页、编辑页、连拍页共用 app.globalData.images
function images() {
  return getApp().globalData.images;
}

function setImages(list) {
  getApp().globalData.images = list;
}

Page({
  data: {
    subjectName: '',
    prefix: '',
    suffix: '',
    number: 1, // 本次的编号（第几周 / Lecture 几 / 第几章）
    numberText: '1', // 输入框里的文字（输入过程中可能是空的或不合法的）
    wheelRows: [],
    wheelValue: [0], // 滚轮当前位置（= 编号 - 1）
    profile: { name: '', studentId: '' },
    cells: [], // 缩略图：{ id, path, rotate, checked }
    imageCount: 0,
    maxPages: MAX_PAGES,
    selecting: false, // 批量编辑模式
    selectedCount: 0,
    allChecked: false,
    enhance: true,
    loading: false,
    loadingText: '',
    result: null // { filename, filePath, warnings }
  },

  onLoad(options) {
    const subject = findSubject(decodeURIComponent(options.subject || ''));
    if (!subject || !subject.canSubmit) {
      wx.reLaunch({ url: '/pages/home/home' });
      return;
    }
    this.subject = subject;
    this.checked = {}; // 批量编辑时被勾选的图片 id
    setImages([]);
    wx.setNavigationBarTitle({ title: subject.name + ' · 提交作业' });
    this.setData(
      Object.assign(
        {
          subjectName: subject.name,
          prefix: subject.prefix,
          suffix: subject.suffix,
          wheelRows: wheelRows(subject)
        },
        this.numberFields(getNext(subject.name))
      )
    );
  },

  // 从大图页、编辑页、连拍页回来时，照片可能变了，所以每次显示都重新读一遍
  onShow() {
    const profile = wx.getStorageSync('profile') || { name: '', studentId: '' };
    this.setData({ profile });
    if (this.subject) this.refreshImages();
  },

  goProfile() {
    wx.navigateTo({ url: '/pages/profile/profile' });
  },

  // ---------- 编号：第【】周 ----------
  numberFields(n) {
    return {
      number: n,
      numberText: String(n),
      wheelValue: [n - MIN_NUMBER]
    };
  },

  // 上下滑动滚轮
  onWheelChange(e) {
    const n = e.detail.value[0] + MIN_NUMBER;
    this.setData(Object.assign(this.numberFields(n), { result: null }));
  },

  // 输入过程中：合法就同步滚轮，不合法先不管，等输入完（失焦）再提示
  onNumInput(e) {
    const text = e.detail.value;
    const patch = { result: null };
    if (/^\d{1,2}$/.test(text)) {
      const n = Number(text);
      if (n >= MIN_NUMBER && n <= MAX_NUMBER) Object.assign(patch, this.numberFields(n));
    }
    patch.numberText = text;
    this.setData(patch);
  },

  // 输入完成：空的、不是整数、超出范围的，都只提示“输入有误”，并恢复成原来的编号
  onNumBlur(e) {
    const text = String(e.detail.value).trim();
    const n = Number(text);
    if (!/^\d{1,2}$/.test(text) || n < MIN_NUMBER || n > MAX_NUMBER) {
      wx.showToast({ title: '输入有误', icon: 'none' });
      this.setData(this.numberFields(this.data.number));
      return;
    }
    this.setData(Object.assign(this.numberFields(n), { result: null }));
  },

  onEnhanceChange(e) {
    this.setData({ enhance: e.detail.value, result: null });
  },

  // ---------- 图片列表 ----------
  refreshImages() {
    const list = images();
    const cells = list.map((im) => ({
      id: im.id,
      path: im.path,
      rotate: im.rotate,
      checked: !!this.checked[im.id]
    }));
    const selectedCount = cells.filter((c) => c.checked).length;
    this.setData({
      cells,
      imageCount: cells.length,
      selectedCount,
      allChecked: cells.length > 0 && selectedCount === cells.length,
      result: null
    });
  },

  // 拍照 / 相册：一次最多 9 张，总数不超过上限
  chooseImages() {
    const remain = MAX_PAGES - images().length;
    if (remain <= 0) return;
    wx.chooseMedia({
      count: Math.min(remain, 9),
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      sizeType: SIZE_TYPE,
      success: (res) => {
        const added = res.tempFiles.map((f) => makeImage(f.tempFilePath));
        setImages(images().concat(added));
        this.refreshImages();
      }
    });
  },

  // 批量拍照：进入连拍页，连着拍好几张再一起带回来
  batchCamera() {
    if (images().length >= MAX_PAGES) {
      wx.showToast({ title: '照片已经满了', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/camera/camera' });
  },

  // 点缩略图：批量编辑时是勾选，否则打开大图页
  onTapCell(e) {
    const { id, index } = e.currentTarget.dataset;
    if (this.data.selecting) {
      if (this.checked[id]) delete this.checked[id];
      else this.checked[id] = true;
      this.refreshImages();
      return;
    }
    wx.navigateTo({ url: '/pages/viewer/viewer?index=' + index });
  },

  // ---------- 批量编辑 ----------
  enterSelect() {
    if (!images().length) {
      wx.showToast({ title: '还没有照片', icon: 'none' });
      return;
    }
    this.checked = {};
    this.setData({ selecting: true });
    this.refreshImages();
  },

  exitSelect() {
    this.checked = {};
    this.setData({ selecting: false });
    this.refreshImages();
  },

  // 全选 / 取消全选
  toggleAll() {
    if (this.data.allChecked) {
      this.checked = {};
    } else {
      images().forEach((im) => {
        this.checked[im.id] = true;
      });
    }
    this.refreshImages();
  },

  // dir：-1 向左旋转，1 向右旋转
  batchRotate(e) {
    if (!this.data.selectedCount) {
      wx.showToast({ title: '请先选择图片', icon: 'none' });
      return;
    }
    const dir = Number(e.currentTarget.dataset.dir);
    setImages(images().map((im) => (this.checked[im.id] ? rotated(im, dir) : im)));
    this.refreshImages();
  },

  batchDelete() {
    const n = this.data.selectedCount;
    if (!n) {
      wx.showToast({ title: '请先选择图片', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '删除',
      content: '确定删除选中的 ' + n + ' 张吗？',
      success: (res) => {
        if (!res.confirm) return;
        setImages(images().filter((im) => !this.checked[im.id]));
        this.checked = {};
        if (!images().length) this.setData({ selecting: false });
        this.refreshImages();
      }
    });
  },

  // ---------- 生成 PDF ----------
  async generate() {
    const { profile, number, enhance } = this.data;
    const list = images();

    if (!profile.name || !profile.studentId) {
      wx.showToast({ title: '请先填写姓名和学号', icon: 'none' });
      return;
    }
    if (!list.length) {
      wx.showToast({ title: '请先拍照', icon: 'none' });
      return;
    }

    // 一次生成任务的唯一编号，后端用它把同一批图片归到一起
    const taskId = Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    this.setData({ loading: true, result: null });

    try {
      // 图片按当前页序依次上传，index 就是页码（从 0 开始）
      for (let i = 0; i < list.length; i++) {
        this.setData({ loadingText: '上传第 ' + (i + 1) + '/' + list.length + ' 页…' });
        await api.uploadPage(taskId, i, list[i].path);
      }

      this.setData({ loadingText: '正在处理并生成 PDF…' });
      const res = await api.makePdf({
        task_id: taskId,
        subject: this.subject.name,
        number: number,
        name: profile.name,
        student_id: profile.studentId,
        rotations: list.map((i) => i.rotate), // 与页码一一对应，顺时针角度
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
    setImages([]);
    this.checked = {};
    this.setData(Object.assign({ selecting: false }, this.numberFields(getNext(this.subject.name))));
    this.refreshImages();
  }
});
