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

    const step = Math.max(200, Math.floor(clientHeight / 2));
    let currentScroll = isWindow ? window.scrollY : container.scrollTop;

    while (currentScroll + clientHeight < scrollHeight - 50) {
      currentScroll += step;
      if (isWindow) {
        window.scrollTo({ top: currentScroll, behavior: 'smooth' });
      } else {
        container.scrollTo({ top: currentScroll, behavior: 'smooth' });
      }
      await sleep(150);
    }

    // Brief pause at bottom to let dynamic items render
    await sleep(350);

    // Scroll back to top for good measure
    if (isWindow) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      container.scrollTo({ top: 0, behavior: 'smooth' });
    }
    await sleep(200);
  };

  // Parse visible job cards on the current DOM
  const extractJobsFromDOM = (jobsMap) => {
    // Select all potential job card elements
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
          // Check for strong tag inside or fallback to innerText
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

      // Fallback via paragraphs if company/location missing
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

      // Save to map
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

  // Attempt to navigate to the next page using LinkedIn SPA pagination
  const navigateToNextPage = async (previousJobIds) => {
    const nextBtn =
      document.querySelector('button.jobs-search-pagination__button--next') ||
      document.querySelector('button[aria-label="View next page"]') ||
      document.querySelector('.jobs-search-pagination__pages .jobs-search-pagination__indicator-button--active')?.parentElement?.nextElementSibling?.querySelector('button');

    if (!nextBtn || nextBtn.disabled || nextBtn.getAttribute('aria-disabled') === 'true') {
      console.log('No next page button found or pagination ended.');
      return false;
    }

    console.log('Clicking Next page button...');
    nextBtn.click();

    // Poll until DOM updates with new Job IDs or timeout reached
    const startTime = Date.now();
    const maxWait = 4000;

    while (Date.now() - startTime < maxWait) {
      await sleep(300);
      const currentCards = document.querySelectorAll('li[data-occludable-job-id], div[data-job-id]');
      let foundNewId = false;

      for (const card of currentCards) {
        const id = card.getAttribute('data-job-id') || card.getAttribute('data-occludable-job-id');
        if (id && !previousJobIds.has(id)) {
          foundNewId = true;
          break;
        }
      }

      if (foundNewId) {
        await sleep(500); // Allow additional rendering time
        return true;
      }
    }

    // Default return true if max timeout reached (will process whatever DOM has)
    return true;
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

    let attemptsWithoutNewJobs = 0;

    while (jobsMap.size < targetCount && attemptsWithoutNewJobs < 3) {
      // Step 1: Un-occlude virtual cards by scrolling
      await unoccludeJobCards();

      // Step 2: Extract visible jobs
      const previousCount = jobsMap.size;
      extractJobsFromDOM(jobsMap);
      const currentCount = jobsMap.size;

      notifyProgress(currentCount);

      if (currentCount >= targetCount) break;

      if (currentCount === previousCount) {
        attemptsWithoutNewJobs++;
      } else {
        attemptsWithoutNewJobs = 0;
      }

      // Step 3: Navigate to next page
      const pageChanged = await navigateToNextPage(jobsMap);
      if (!pageChanged) break;
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
