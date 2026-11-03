const { BASE_URL } = require('./config');

// 上传一页图片。wx.uploadFile 一次只能传一个文件，所以前端会循环调用。
function uploadPage(taskId, index, filePath) {
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: BASE_URL + '/api/upload',
      filePath,
      name: 'file',
      formData: { task_id: taskId, index: String(index) },
      success(res) {
        let data = null;
        try {
          data = JSON.parse(res.data);
        } catch (e) {
          return reject(new Error('服务器返回的不是 JSON（状态码 ' + res.statusCode + '）'));
        }
        if (res.statusCode !== 200 || !data.ok) {
          return reject(new Error(data.message || '上传失败（状态码 ' + res.statusCode + '）'));
        }
        resolve(data);
      },
      fail(e) {
        reject(new Error('无法连接服务器，请检查地址和网络：' + e.errMsg));
      }
    });
  });
}

// 通知后端：这个任务的图片传完了，请合成 PDF 并命名。
function makePdf(payload) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: BASE_URL + '/api/make_pdf',
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: payload,
      success(res) {
        const data = res.data || {};
        if (res.statusCode !== 200 || !data.ok) {
          return reject(new Error(data.message || '生成失败（状态码 ' + res.statusCode + '）'));
        }
        resolve(data);
      },
      fail(e) {
        reject(new Error('无法连接服务器，请检查地址和网络：' + e.errMsg));
      }
    });
  });
}

// 把后端生成的 PDF 下载到手机临时目录。url 形如 "/files/xxx.pdf"
function downloadFile(url) {
  return new Promise((resolve, reject) => {
    wx.downloadFile({
      url: BASE_URL + url,
      success(res) {
        if (res.statusCode !== 200) {
          return reject(new Error('下载失败（状态码 ' + res.statusCode + '）'));
        }
        resolve(res.tempFilePath);
      },
      fail(e) {
        reject(new Error('下载失败：' + e.errMsg));
      }
    });
  });
}

module.exports = { uploadPage, makePdf, downloadFile };
