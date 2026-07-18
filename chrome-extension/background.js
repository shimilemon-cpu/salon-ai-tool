chrome.runtime.onInstalled.addListener(async () => {
  const tabs = await chrome.tabs.query({ url: '*://*.hotpepper.jp/*' });
  for (const tab of tabs) {
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
      await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['content.css'] });
    } catch (_) {}
  }
});
