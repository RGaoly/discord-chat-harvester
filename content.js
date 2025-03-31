console.log('Discord Chat Harvester content script 已加载');

// 全局变量
let isCollecting = false;
let shouldCancel = false;
let collectedMessages = [];

// 监听来自popup的消息
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  console.log('content script 收到消息:', message);
  
  if (message.action === 'startCollection') {
    console.log('开始收集消息，设置:', message.settings);
    
    // 立即发送响应
    sendResponse({status: 'started'});
    
    // 模拟收集过程
    simulateCollection(message.settings);
    
    return true;
  } else if (message.action === 'cancelCollection') {
    console.log('取消收集');
    sendResponse({status: 'cancelled'});
    return true;
  }
});

// 模拟收集过程
function simulateCollection(settings) {
  const depth = settings.depth;
  let collected = 0;
  
  // 发送初始进度
  updateProgress(0, depth, 0);
  
  // 模拟进度更新
  const interval = setInterval(() => {
    collected += 5;
    const percentage = Math.min(Math.round((collected / depth) * 100), 100);
    
    updateProgress(collected, depth, percentage);
    
    if (collected >= depth) {
      clearInterval(interval);
      
      // 生成模拟数据
      const data = [];
      const users = ['用户A', '用户B', '用户C', '用户D', '用户E'];
      const now = new Date();
      
      for (let i = 0; i < collected; i++) {
        const item = {};
        
        if (settings.includeUsername) {
          item.username = users[Math.floor(Math.random() * users.length)];
        }
        
        if (settings.includeTimestamp) {
          const date = new Date(now - i * 60000);
          item.timestamp = date.toLocaleString();
        }
        
        if (settings.includeContent) {
          item.content = `这是第 ${i + 1} 条测试消息内容。`;
        }
        
        data.push(item);
      }
      
      // 发送完成消息
      chrome.runtime.sendMessage({
        action: 'collectionComplete',
        data: data
      });
    }
  }, 300);
}

// 更新进度
function updateProgress(collected, total, percentage) {
  chrome.runtime.sendMessage({
    action: 'updateProgress',
    collected: collected,
    total: total,
    percentage: percentage
  });
}

// 辅助函数：延迟
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
} 