(function () {
  // Guard against multiple injections
  if (window.__linkedin_job_collector_injected) return;
  window.__linkedin_job_collector_injected = true;

  console.log('LinkedIn Job Collector Content Script loaded.');

  // Helper: Sleep utility
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Helper: Escape string for CSV output
  const escapeCSV = (val) => {
    if (val === null || val === undefined) return '""';
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    const str = String(val).trim();
    const escaped = str.replace(/"/g, '""');
    return `"${escaped}"`;
  };

  // Helper: Copy text to clipboard with fallback
  const copyToClipboard = async (text) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (err) {
      console.warn('Clipboard API failed, using fallback:', err);
    }

    // Fallback: document.execCommand('copy')
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    let success = false;
    try {
      success = document.execCommand('copy');
    } catch (err) {
      console.error('Fallback copy command failed:', err);
    }
    document.body.removeChild(textarea);
    return success;
  };

  // Find the scrolling container for job cards
  const getJobsContainer = () => {
    return (
      document.querySelector('.jobs-search-results-list') ||
      document.querySelector('.scaffold-layout__list') ||
      document.querySelector('div[data-results-list-top-scroll-sentinel]')?.parentElement ||
      window
    );
  };

  // Smooth scroll container to un-occlude all virtual-scroll job cards
  const unoccludeJobCards = async () => {
    const container = getJobsContainer();
    if (!container) return;

    const isWindow = container === window;
    const scrollHeight = isWindow ? document.body.scrollHeight : container.scrollHeight;
    const clientHeight = isWindow ? window.innerHeight : container.clientHeight;

    if (scrollHeight <= clientHeight) return;

    const step = Math.max(250, Math.floor(clientHeight / 2));
    let currentScroll = isWindow ? window.scrollY : container.scrollTop;

    while (currentScroll + clientHeight < scrollHeight - 30) {
      currentScroll += step;
      if (isWindow) {
        window.scrollTo({ top: currentScroll, behavior: 'smooth' });
      } else {
        container.scrollTo({ top: currentScroll, behavior: 'smooth' });
      }
      await sleep(150);
    }

    // Pause at bottom to ensure occluded cards render
    await sleep(400);
  };

  // Scroll container back to top
  const scrollToTop = async () => {
    const container = getJobsContainer();
    if (!container) return;
    const isWindow = container === window;
    if (isWindow) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      container.scrollTo({ top: 0, behavior: 'smooth' });
    }
    await sleep(200);
  };

  // Parse visible job cards on the current DOM
  const extractJobsFromDOM = (jobsMap) => {
    const cardElements = document.querySelectorAll(
      'li[data-occludable-job-id], div[data-job-id], [componentkey^="job-card-component-ref-"], .job-card-container'
    );

    let newJobsFound = 0;

    cardElements.forEach(card => {
      // 1. Extract Job ID
      let jobId = card.getAttribute('data-job-id') || card.getAttribute('data-occludable-job-id');

      if (!jobId) {
        const compKey = card.getAttribute('componentkey');
        if (compKey) {
          const match = compKey.match(/ref-(\d+)/);
          if (match) jobId = match[1];
        }
      }

      if (!jobId) {
        const link = card.querySelector('a[href*="/jobs/view/"]');
        if (link && link.href) {
          const match = link.href.match(/\/jobs\/view\/(\d+)/);
          if (match) jobId = match[1];
        }
      }

      if (!jobId || jobsMap.has(jobId)) return;

      // 2. Title
      let title = '';
      const dismissBtn = card.querySelector('button[aria-label^="Dismiss"]');
      if (dismissBtn) {
        const ariaLabel = dismissBtn.getAttribute('aria-label') || '';
        title = ariaLabel
          .replace(/^Dismiss\s+/, '')
          .replace(/\s+job$/, '')
          .replace(/\s+\(Verified job\)$/, '')
          .replace(/\s+with verification$/, '')
          .trim();
      }

      if (!title) {
        const titleEl = card.querySelector(
          'a.job-card-list__title--link, a.job-card-container__link, .artdeco-entity-lockup__title a'
        );
        if (titleEl) {
          const strong = titleEl.querySelector('strong');
          title = strong ? strong.innerText.trim() : titleEl.innerText.trim();
        }
      }

      if (!title) title = 'Unknown Title';

      // 3. Company & Location
      let company = '';
      let location = '';

      const subtitleEl = card.querySelector('.job-card-list__subtitle, .artdeco-entity-lockup__subtitle');
      if (subtitleEl) company = subtitleEl.innerText.trim();

      const locationEl = card.querySelector('.job-card-container__metadata-wrapper li, .artdeco-entity-lockup__caption');
      if (locationEl) location = locationEl.innerText.trim();

      if (!company || !location) {
        const paragraphs = Array.from(card.querySelectorAll('p'))
          .map(p => p.innerText.trim().split('\n')[0])
          .filter(t => t.length > 0 && t !== '·');

        if (!company && paragraphs.length > 1) company = paragraphs[1];
        if (!location && paragraphs.length > 2) location = paragraphs[2];
      }

      // 4. Salary
      let salary = '';
      const paragraphs = Array.from(card.querySelectorAll('p, span'));
      const salaryEl = paragraphs.find(p =>
        /(INR|₹|\$|LPA|\/month|\/yr|€|£)/i.test(p.innerText) && /\d/.test(p.innerText)
      );
      if (salaryEl) salary = salaryEl.innerText.trim();

      // 5. Easy Apply
      const cardText = card.innerText || card.textContent || '';
      const isEasyApply =
        cardText.includes('Easy Apply') ||
        !!card.querySelector('svg[data-test-icon="linkedin-bug-color-small"]');

      // 6. Verified
      const isVerified =
        cardText.includes('Verified job') ||
        title.includes('Verified') ||
        !!card.querySelector('svg[data-test-icon="verified-small"]') ||
        !!card.querySelector('use[href*="verified"]') ||
        (card.querySelector('a[aria-label*="verification"]') !== null);

      // 7. Posted Date
      let postedDate = '';
      const timeEl = card.querySelector('time');
      if (timeEl) {
        postedDate = timeEl.innerText.trim();
      } else {
        const postedMatch =
          cardText.match(/Posted (.*?ago)/i) ||
          cardText.match(/(\d+\s+(minute|hour|day|week|month)s?\s+ago)/i);
        if (postedMatch) postedDate = postedMatch[1];
      }

      // 8. URL
      const url = `https://www.linkedin.com/jobs/view/${jobId}`;

      jobsMap.set(jobId, {
        jobId,
        title,
        company,
        location,
        salary,
        postedDate,
        isEasyApply,
        isVerified,
        url
      });

      newJobsFound++;
    });

    return newJobsFound;
  };

  // Click element reliably with full mouse events
  const clickElement = (el) => {
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.focus();
    el.click();
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  };

  // Attempt to navigate to the next page using LinkedIn SPA pagination
  const navigateToNextPage = async (previousJobIds, targetPageIndex) => {
    // 1. Scroll down to pagination section so buttons are in view and interactive
    const paginationSection = document.querySelector('.jobs-search-pagination, .jobs-search-results-list__pagination');
    if (paginationSection) {
      paginationSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(300);
    }

    // 2. Look for target page button or Next button
    const pageNum = targetPageIndex + 1; // 1-indexed (Page 2, Page 3, Page 4...)
    let nextBtn =
      document.querySelector(`button[aria-label="Page ${pageNum}"]`) ||
      document.querySelector(`button[aria-label="Go to page ${pageNum}"]`) ||
      document.querySelector('button.jobs-search-pagination__button--next') ||
      document.querySelector('button[aria-label="View next page"]') ||
      document.querySelector('.jobs-search-pagination__pages .jobs-search-pagination__indicator-button--active')?.parentElement?.nextElementSibling?.querySelector('button');

    if (!nextBtn || nextBtn.disabled || nextBtn.getAttribute('aria-disabled') === 'true') {
      console.log(`No pagination button found for Page ${pageNum} or pagination ended.`);
      return false;
    }

    console.log(`Clicking pagination button for Page ${pageNum}...`);
    clickElement(nextBtn);

    // 3. Poll for new job IDs in DOM
    const startTime = Date.now();
    const maxWait = 4500;

    while (Date.now() - startTime < maxWait) {
      await sleep(300);
      const currentCards = document.querySelectorAll('li[data-occludable-job-id], div[data-job-id], [componentkey^="job-card-component-ref-"]');

      for (const card of currentCards) {
        let id = card.getAttribute('data-job-id') || card.getAttribute('data-occludable-job-id');
        if (!id) {
          const compKey = card.getAttribute('componentkey');
          if (compKey) {
            const match = compKey.match(/ref-(\d+)/);
            if (match) id = match[1];
          }
        }
        if (id && !previousJobIds.has(id)) {
          await sleep(500); // Give LinkedIn time to settle DOM rendering
          await scrollToTop();
          return true;
        }
      }
    }

    // 4. Fallback: If button click did not trigger SPA load, try URL searchParams start update
    console.warn('Button click did not load new jobs in time. Trying URL start parameter update...');
    const startOffset = targetPageIndex * 25;
    const url = new URL(window.location.href);
    url.searchParams.set('start', startOffset.toString());
    
    // Update URL via pushState
    window.history.pushState({}, '', url.toString());
    window.dispatchEvent(new Event('popstate'));
    await sleep(1500);

    // Check once more after URL fallback
    const checkCards = document.querySelectorAll('li[data-occludable-job-id], div[data-job-id]');
    for (const card of checkCards) {
      const id = card.getAttribute('data-job-id') || card.getAttribute('data-occludable-job-id');
      if (id && !previousJobIds.has(id)) {
        await scrollToTop();
        return true;
      }
    }

    return false;
  };

  // Main Extraction Flow
  const runCollection = async (targetCount = 100) => {
    const jobsMap = new Map();

    const notifyProgress = (current) => {
      try {
        chrome.runtime.sendMessage({
          type: 'PROGRESS',
          current: Math.min(current, targetCount),
          target: targetCount
        });
      } catch (e) {
        // Context invalidation guard
      }
    };

    notifyProgress(0);

    let pageIndex = 0; // 0 = Page 1, 1 = Page 2, 2 = Page 3, 3 = Page 4
    let consecutiveFailures = 0;

    while (jobsMap.size < targetCount && consecutiveFailures < 2) {
      // Step 1: Un-occlude virtual cards by scrolling container
      await unoccludeJobCards();

      // Step 2: Extract visible jobs
      const countBefore = jobsMap.size;
      extractJobsFromDOM(jobsMap);
      const countAfter = jobsMap.size;

      notifyProgress(countAfter);

      if (countAfter >= targetCount) break;

      // Step 3: Navigate to next page
      pageIndex++;
      const pageChanged = await navigateToNextPage(jobsMap, pageIndex);

      if (!pageChanged) {
        console.warn(`Failed to navigate to page index ${pageIndex}. Retrying or stopping.`);
        consecutiveFailures++;
      } else {
        consecutiveFailures = 0;
      }
    }

    // Generate CSV
    const headers = [
      'Job ID', 'Title', 'Company', 'Location', 'Salary',
      'Posted Date', 'Easy Apply', 'Verified', 'URL'
    ];

    const rows = [headers.join(',')];

    jobsMap.forEach(job => {
      const row = [
        escapeCSV(job.jobId),
        escapeCSV(job.title),
        escapeCSV(job.company),
        escapeCSV(job.location),
        escapeCSV(job.salary),
        escapeCSV(job.postedDate),
        job.isEasyApply,
        job.isVerified,
        escapeCSV(job.url)
      ];
      rows.push(row.join(','));
    });

    const csvContent = rows.join('\n');

    // Copy to clipboard
    const copied = await copyToClipboard(csvContent);

    if (!copied) {
      throw new Error('Failed to copy CSV to clipboard.');
    }

    return jobsMap.size;
  };

  // Message Handler for Popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'PING') {
      sendResponse({ status: 'PONG' });
      return true;
    }

    if (request.action === 'START_COLLECTION') {
      const targetCount = request.targetCount || 100;

      runCollection(targetCount)
        .then((count) => {
          sendResponse({ success: true, count });
        })
        .catch((err) => {
          console.error('LinkedIn Job Collector Execution Error:', err);
          sendResponse({ success: false, error: err.message || 'Extraction failed' });
        });

      return true; // Keep message channel open for async response
    }
  });

})();
