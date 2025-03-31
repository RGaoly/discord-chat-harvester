console.log('Background script 已加载');

// 监听来自popup的下载请求
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  console.log('Background 收到消息:', message);
  
  if (message.action === 'downloadData') {
    console.log('准备下载数据:', message.filename);
    
    chrome.downloads.download({
      url: message.url,
      filename: message.filename,
      saveAs: true
    }, function(downloadId) {
      if (chrome.runtime.lastError) {
        console.error('下载错误:', chrome.runtime.lastError);
        sendResponse({success: false, error: chrome.runtime.lastError.message});
      } else {
        console.log('下载已开始, ID:', downloadId);
        sendResponse({success: true});
      }
    });
    
    return true; // 保持消息通道开放，以便异步响应
  }
});

// 监听来自content script的消息
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  if (message.action === 'updateCollectionProgress') {
    // 更新收集进度
    chrome.storage.local.get(['discordMessages', 'collectionStatus'], function(result) {
      const messages = result.discordMessages || [];
      const status = result.collectionStatus || {};
      
      if (status.isCollecting) {
        // 发送通知到popup
        chrome.runtime.sendMessage({
          action: 'progressUpdate',
          count: messages.length,
          target: status.targetCount
        });
      }
    });
  }
  
  // ... 现有代码 ...
}); 