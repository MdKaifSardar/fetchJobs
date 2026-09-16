document.addEventListener('DOMContentLoaded', async () => {
  const collectBtn = document.getElementById('collectBtn');
  const btnText = document.getElementById('btnText');
  const spinner = document.getElementById('spinner');
  const statusEl = document.getElementById('status');

  const updateStatus = (text, type = 'normal') => {
    statusEl.textContent = text;
    statusEl.className = 'status-card';
    if (type === 'success') statusEl.classList.add('success');
    if (type === 'error') statusEl.classList.add('error');
  };

  const setLoading = (loading) => {
    collectBtn.disabled = loading;
    spinner.style.display = loading ? 'inline-block' : 'none';
    if (!loading) {
      btnText.textContent = 'Copy 100 Jobs';
    }
  };

  // Obtain active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.url || !tab.url.includes('linkedin.com/jobs/')) {
    updateStatus('Open a LinkedIn Jobs search page first.', 'error');
    collectBtn.disabled = true;
    return;
  }

  // Listen for real-time progress updates from content script
  chrome.runtime.onMessage.addListener((message) => {
    if (message && message.type === 'PROGRESS') {
      const { current, target } = message;
      updateStatus(`Collecting... ${current}/${target}`);
    }
  });

  collectBtn.addEventListener('click', async () => {
    setLoading(true);
    updateStatus('Collecting... 0/100');

    try {
      // Ensure content script is injected
      try {
        await chrome.tabs.sendMessage(tab.id, { action: 'PING' });
      } catch (e) {
        // Content script not ready yet, inject it manually
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
      }

      // Send start collection command
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'START_COLLECTION',
        targetCount: 100
      });

      if (response && response.success) {
        const count = response.count || 0;
        updateStatus(`Copied ${count} jobs to clipboard.`, 'success');
      } else {
        const err = (response && response.error) ? response.error : 'Could not load the next result batch.';
        updateStatus(err, 'error');
      }
    } catch (err) {
      console.error('LinkedIn Job Collector Error:', err);
      updateStatus('Could not load the next result batch.', 'error');
    } finally {
      setLoading(false);
    }
  });
});
