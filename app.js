App({
  globalData: {
    // 提交页、大图页、编辑页、连拍页共用的照片列表。
    // 每一项是 { id, path, rotate }，数组顺序就是 PDF 的页序。
    images: []
  },

  onLaunch() {
    // 全局配置都放在 utils/config.js，这里不需要做什么
  }
});
