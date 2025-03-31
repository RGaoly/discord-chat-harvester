document.addEventListener('DOMContentLoaded', function() {
  const generateButton = document.getElementById('generate-button');
  const messageCount = document.getElementById('message-count');
  const exportFormat = document.getElementById('export-format');
  const includeUsername = document.getElementById('include-username');
  const includeTimestamp = document.getElementById('include-timestamp');
  const includeContent = document.getElementById('include-content');
  const status = document.getElementById('status');
  const collectButton = document.getElementById('collect-button');
  const autoScroll = document.getElementById('auto-scroll');
  const scrollToTop = document.getElementById('scroll-to-top');
  
  const startCollectButton = document.getElementById('start-collect-button');
  const exportButton = document.getElementById('export-button');
  const progressContainer = document.getElementById('progress-container');
  const progressText = document.getElementById('progress-text');
  const progressPercentage = document.getElementById('progress-percentage');
  const progressBar = document.getElementById('progress-bar');
  
  // 全局变量，用于跟踪收集状态
  let isCollecting = false;
  let collectedCount = 0;
  let targetCount = 0;
  
  // 初始化时检查是否有已收集的消息
  chrome.storage.local.get(['discordMessages', 'collectionStatus'], function(result) {
    if (result.discordMessages && result.discordMessages.length > 0) {
      status.textContent = `已收集 ${result.discordMessages.length} 条消息，点击"导出收集结果"按钮导出`;
      collectedCount = result.discordMessages.length;
    } else {
      status.textContent = `准备就绪，请点击"开始收集"按钮收集 Discord 消息`;
    }
    
    if (result.collectionStatus && result.collectionStatus.isCollecting) {
      isCollecting = true;
      targetCount = result.collectionStatus.targetCount;
      updateProgressUI(collectedCount, targetCount);
      progressContainer.style.display = 'block';
      startCollectButton.textContent = '停止收集';
      startCollectButton.style.backgroundColor = '#ED4245';
    }
  });
  
  generateButton.addEventListener('click', function() {
    const count = parseInt(messageCount.value);
    const format = exportFormat.value;
    
    status.textContent = '正在生成数据...';
    
    // 获取设置
    const settings = {
      count: count,
      format: format,
      includeUsername: includeUsername.checked,
      includeTimestamp: includeTimestamp.checked,
      includeContent: includeContent.checked
    };
    
    // 生成模拟数据
    const data = generateMockData(settings);
    
    // 准备下载
    const blob = prepareDataForDownload(data, settings);
    const url = URL.createObjectURL(blob);
    
    // 发送下载请求到background
    chrome.runtime.sendMessage({
      action: 'downloadData',
      url: url,
      filename: `discord-messages-${new Date().toISOString().slice(0, 10)}.${format}`
    }, function(response) {
      if (chrome.runtime.lastError) {
        console.error('发送消息错误:', chrome.runtime.lastError);
        status.textContent = '下载失败: ' + chrome.runtime.lastError.message;
      } else {
        status.textContent = '数据已生成，准备下载';
      }
    });
  });
  
  // 开始收集按钮
  startCollectButton.addEventListener('click', function() {
    if (isCollecting) {
      // 如果正在收集，则停止收集
      isCollecting = false;
      chrome.storage.local.set({
        collectionStatus: { isCollecting: false }
      });
      startCollectButton.textContent = '开始收集';
      startCollectButton.style.backgroundColor = '#57F287';
      status.textContent = `已停止收集，共收集 ${collectedCount} 条消息，点击"导出收集结果"按钮导出`;
      return;
    }
    
    const count = parseInt(messageCount.value);
    targetCount = count;
    
    status.textContent = '正在准备收集 Discord 消息，请保持页面打开...';
    
    // 获取设置
    const settings = {
      count: count,
      includeUsername: includeUsername.checked,
      includeTimestamp: includeTimestamp.checked,
      includeContent: includeContent.checked,
      autoScroll: autoScroll.checked,
      scrollToTop: scrollToTop.checked
    };
    
    // 保存设置和状态
    chrome.storage.local.set({
      collectionSettings: settings,
      collectionStatus: {
        isCollecting: true,
        targetCount: count,
        startTime: new Date().getTime()
      },
      discordMessages: [] // 清空之前收集的消息
    }, function() {
      // 检查当前页面是否是Discord
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (!tabs || tabs.length === 0) {
          status.textContent = '错误：无法获取当前标签页';
          return;
        }
        
        const currentUrl = tabs[0].url;
        if (!currentUrl || !currentUrl.includes('discord.com')) {
          status.textContent = '请在Discord页面上使用此功能';
          return;
        }
        
        // 开始收集
        isCollecting = true;
        collectedCount = 0;
        updateProgressUI(0, count);
        progressContainer.style.display = 'block';
        startCollectButton.textContent = '停止收集';
        startCollectButton.style.backgroundColor = '#ED4245';
        
        // 使用executeScript注入收集脚本
        chrome.scripting.executeScript({
          target: {tabId: tabs[0].id},
          function: startMessageCollection,
          args: [settings]
        });
        
        // 定期检查收集进度
        checkCollectionProgress();
      });
    });
  });
  
  // 导出按钮
  exportButton.addEventListener('click', function() {
    const format = exportFormat.value;
    
    chrome.storage.local.get(['discordMessages', 'collectionSettings'], function(result) {
      if (!result.discordMessages || result.discordMessages.length === 0) {
        status.textContent = '没有可导出的消息，请先收集';
        return;
      }
      
      const data = result.discordMessages;
      const settings = {
        ...result.collectionSettings,
        format: format
      };
      
      // 准备下载
      const blob = prepareDataForDownload(data, settings);
      const url = URL.createObjectURL(blob);
      
      // 发送下载请求到background
      chrome.runtime.sendMessage({
        action: 'downloadData',
        url: url,
        filename: `discord-messages-${new Date().toISOString().slice(0, 10)}.${format}`
      });
      
      status.textContent = `正在导出 ${data.length} 条消息，请稍候...`;
      setTimeout(() => {
        status.textContent = `导出成功！共导出 ${data.length} 条消息`;
      }, 2000);
    });
  });
  
  // 定期检查收集进度
  function checkCollectionProgress() {
    if (!isCollecting) return;
    
    chrome.storage.local.get(['discordMessages', 'collectionStatus'], function(result) {
      if (result.discordMessages) {
        collectedCount = result.discordMessages.length;
        updateProgressUI(collectedCount, targetCount);
        
        if (collectedCount >= targetCount) {
          // 收集完成
          isCollecting = false;
          chrome.storage.local.set({
            collectionStatus: { isCollecting: false }
          });
          startCollectButton.textContent = '开始收集';
          startCollectButton.style.backgroundColor = '#57F287';
          status.textContent = `收集完成，共收集 ${collectedCount} 条消息，点击"导出收集结果"按钮导出`;
        } else {
          // 继续检查
          setTimeout(checkCollectionProgress, 1000);
        }
      } else {
        setTimeout(checkCollectionProgress, 1000);
      }
    });
  }
  
  // 更新进度UI
  function updateProgressUI(current, total) {
    const percentage = Math.min(Math.round((current / total) * 100), 100);
    progressText.textContent = `已收集 ${current} / ${total} 条消息`;
    progressPercentage.textContent = `${percentage}%`;
    progressBar.style.width = `${percentage}%`;
  }
  
  // 生成模拟数据
  function generateMockData(settings) {
    const data = [];
    const users = ['用户A', '用户B', '用户C', '用户D', '用户E'];
    const now = new Date();
    
    for (let i = 0; i < settings.count; i++) {
      const item = {};
      
      if (settings.includeUsername) {
        item.username = users[Math.floor(Math.random() * users.length)];
      }
      
      if (settings.includeTimestamp) {
        item.timestamp = new Date(now - i * 60000).toLocaleString();
      }
      
      if (settings.includeContent) {
        item.content = `这是第 ${i + 1} 条测试消息内容。`;
      }
      
      data.push(item);
    }
    
    return data;
  }
  
  // 准备下载数据
  function prepareDataForDownload(data, settings) {
    let content;
    let type;
    
    if (settings.format === 'json') {
      content = JSON.stringify(data, null, 2);
      type = 'application/json';
    } else if (settings.format === 'csv') {
      // 获取所有可能的键
      const keys = new Set();
      data.forEach(item => {
        Object.keys(item).forEach(key => keys.add(key));
      });
      
      // 创建CSV头
      const headers = Array.from(keys);
      const csvRows = [headers.join(',')];
      
      // 添加数据行
      data.forEach(item => {
        const values = headers.map(header => {
          const value = item[header] || '';
          // 处理包含逗号的值
          return typeof value === 'string' && value.includes(',') 
            ? `"${value.replace(/"/g, '""')}"` 
            : value;
        });
        csvRows.push(values.join(','));
      });
      
      content = csvRows.join('\n');
      type = 'text/csv';
    } else if (settings.format === 'txt') {
      content = data.map(item => {
        const parts = [];
        if (item.username) parts.push(`用户: ${item.username}`);
        if (item.timestamp) parts.push(`时间: ${item.timestamp}`);
        if (item.content) parts.push(`内容: ${item.content}`);
        return parts.join('\n');
      }).join('\n\n---\n\n');
      type = 'text/plain';
    }
    
    return new Blob([content], {type: type});
  }
  
  // 在页面上下文中执行的收集函数
  function startMessageCollection(settings) {
    // 解析可见的消息
    function parseVisibleMessages() {
      const messages = [];
      const messageElements = document.querySelectorAll('[id^="chat-messages-"]');
      
      messageElements.forEach(element => {
        try {
          const messageId = element.id.replace('chat-messages-', '');
          
          // 跳过系统消息
          if (element.classList.contains('systemMessage')) return;
          
          // 获取用户名
          const usernameElement = element.querySelector('[class*="username"]');
          const username = usernameElement ? usernameElement.textContent.trim() : '未知用户';
          
          // 获取时间戳
          const timestampElement = element.querySelector('[class*="timestamp"]');
          const timestamp = timestampElement ? timestampElement.textContent.trim() : '';
          
          // 获取消息内容
          const contentElement = element.querySelector('[id^="message-content-"]');
          const content = contentElement ? contentElement.textContent.trim() : '';
          
          const item = {
            id: messageId // 添加ID以便去重
          };
          
          if (settings.includeUsername) {
            item.username = username;
          }
          
          if (settings.includeTimestamp) {
            item.timestamp = timestamp;
          }
          
          if (settings.includeContent) {
            item.content = content;
          }
          
          messages.push(item);
        } catch (error) {
          console.error('解析消息时出错:', error);
        }
      });
      
      return messages;
    }
    
    // 创建状态指示器
    const statusDiv = document.createElement('div');
    statusDiv.style.position = 'fixed';
    statusDiv.style.top = '10px';
    statusDiv.style.right = '10px';
    statusDiv.style.padding = '8px 12px';
    statusDiv.style.backgroundColor = 'rgba(88, 101, 242, 0.9)';
    statusDiv.style.color = 'white';
    statusDiv.style.borderRadius = '4px';
    statusDiv.style.zIndex = '9999';
    statusDiv.style.fontSize = '14px';
    statusDiv.textContent = '开始收集消息...';
    document.body.appendChild(statusDiv);
    
    // 获取消息容器
    const scroller = document.querySelector('[data-list-id="chat-messages"]');
    if (!scroller) {
      statusDiv.textContent = '错误：无法找到消息容器';
      setTimeout(() => document.body.removeChild(statusDiv), 3000);
      return;
    }
    
    // 开始持续收集
    let isRunning = true;
    let scrollCount = 0;
    const maxScrolls = 300; // 增加最大滚动次数
    
    // 检查是否应该继续收集
    function checkShouldContinue() {
      return new Promise(resolve => {
        chrome.storage.local.get('collectionStatus', function(result) {
          if (result.collectionStatus && result.collectionStatus.isCollecting) {
            resolve(true);
          } else {
            resolve(false);
          }
        });
      });
    }
    
    // 保存收集到的消息
    function saveMessages(messages) {
      return new Promise(resolve => {
        chrome.storage.local.get('discordMessages', function(result) {
          const existingMessages = result.discordMessages || [];
          const messageMap = new Map();
          
          // 合并现有消息和新消息，去重
          [...existingMessages, ...messages].forEach(msg => {
            if (msg.id) {
              messageMap.set(msg.id, msg);
            }
          });
          
          const mergedMessages = Array.from(messageMap.values());
          
          chrome.storage.local.set({
            discordMessages: mergedMessages
          }, function() {
            resolve(mergedMessages.length);
          });
        });
      });
    }
    
    // 收集循环
    async function collectLoop() {
      // 检查是否应该继续
      const shouldContinue = await checkShouldContinue();
      if (!shouldContinue || scrollCount >= maxScrolls) {
        statusDiv.textContent = '收集已停止';
        setTimeout(() => {
          try {
            document.body.removeChild(statusDiv);
          } catch (e) {}
        }, 2000);
        return;
      }
      
      // 收集当前可见消息
      const messages = parseVisibleMessages();
      const savedCount = await saveMessages(messages);
      
      scrollCount++;
      statusDiv.textContent = `已收集 ${savedCount} 条消息，继续滚动...`;
      
      // 滚动到顶部或底部
      if (settings.scrollToTop) {
        scroller.scrollTop = 0; // 滚动到顶部加载历史消息
      } else {
        scroller.scrollTop = scroller.scrollHeight; // 滚动到底部加载新消息
      }
      
      // 等待消息加载，然后继续收集
      setTimeout(collectLoop, 1000);
    }
    
    // 开始收集循环
    collectLoop();
    
    // 返回初始收集到的消息数量
    return parseVisibleMessages().length;
  }
});