// salon-ai-tool ページ上で動作し、タグ生成を検知して chrome.storage.local に自動保存する
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data?.type !== 'SALON_AI_HPB_TAGS') return;
  const { type, ...data } = event.data;
  chrome.storage.local.set({ aiTagsData: data });
});
