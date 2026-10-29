// Cost history in chrome.storage.local: one entry per video, merged across its translation chunks.

// Serialize writes so parallel tabs don't drop each other's cost entries.
let historyLock = Promise.resolve();

function record(entry) {
  historyLock = historyLock.then(async () => {
    const { history = [] } = await chrome.storage.local.get('history');
    const last = history[history.length - 1];
    if (last && last.video === entry.video && last.model === entry.model) {
      last.inTok += entry.inTok;
      last.outTok += entry.outTok;
      last.cost += entry.cost;
      last.ts = entry.ts;
    } else history.push(entry);
    await chrome.storage.local.set({ history });
  });
  return historyLock;
}
