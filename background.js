chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "local") return;
  const changedKeys = Object.keys(changes).filter(k => k.startsWith("cm:"));
  if (changedKeys.length === 0) return;

  const tabs = await chrome.tabs.query({});

  for (const k of changedKeys) {
    const host = k.slice(3);
    if (!host) continue;

    for (const t of tabs) {
      try {
        const h = t.url ? new URL(t.url).hostname : null;
        if (h === host && t.id) {
          chrome.tabs.sendMessage(t.id, { type: "cm:reload" });
        }
      } catch {
      }
    }
  }
});
