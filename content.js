(function () {
  // Guard against multiple injections
  if (window.__linkedin_job_collector_injected) return;
  window.__linkedin_job_collector_injected = true;

  console.log('LinkedIn Job Collector (Stealth Edition) loaded.');

  // Helper: Sleep with randomized human jitter
  const sleepRandom = (minMs, maxMs) => {
    const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    return new Promise(resolve => setTimeout(resolve, ms));
  };

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

  // Human-like stealth scrolling to un-occlude virtual cards on current page
  const stealthUnoccludeCards = async () => {
    const container = getJobsContainer();
    if (!container) return;

    const isWindow = container === window;
    const scrollHeight = isWindow ? document.body.scrollHeight : container.scrollHeight;
    const clientHeight = isWindow ? window.innerHeight : container.clientHeight;

    if (scrollHeight <= clientHeight) return;

    let currentScroll = isWindow ? window.scrollY : container.scrollTop;

    // Micro-step scrolling with randomized distance & human jitter delay
    while (currentScroll + clientHeight < scrollHeight - 30) {
      const randomStep = Math.floor(Math.random() * 140) + 140; // 140px - 280px step
      currentScroll += randomStep;

      if (isWindow) {
        window.scrollTo({ top: currentScroll, behavior: 'smooth' });
      } else {
        container.scrollTo({ top: currentScroll, behavior: 'smooth' });
      }

      await sleepRandom(90, 210); // Human-like variable delay
    }

    // Brief natural pause at bottom
    await sleepRandom(300, 500);

    // Smoothly scroll back to top
    if (isWindow) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      container.scrollTo({ top: 0, behavior: 'smooth' });
    }
    await sleepRandom(200, 350);
  };

  // Extract visible job cards on current page DOM
  const extractPageJobs = () => {
    const jobsMap = new Map();

    const cardElements = document.querySelectorAll(
      'li[data-occludable-job-id], div[data-job-id], [componentkey^="job-card-component-ref-"], .job-card-container'
    );

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
    });

    return jobsMap;
  };

  // Main Single-Page Extraction Flow (100% Stealth Mode)
  const runSinglePageCollection = async () => {
    // Step 1: Smooth human-like micro-scroll to reveal occluded cards
    await stealthUnoccludeCards();

    // Step 2: Read current DOM cards
    const jobsMap = extractPageJobs();

    if (jobsMap.size === 0) {
      throw new Error('No job cards found on current page.');
    }

    // Step 3: Generate CSV
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

    // Step 4: Copy directly to clipboard
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
      runSinglePageCollection()
        .then((count) => {
          sendResponse({ success: true, count });
        })
        .catch((err) => {
          console.error('LinkedIn Job Collector Execution Error:', err);
          sendResponse({ success: false, error: err.message || 'Extraction failed' });
        });

      return true; // Asynchronous response channel
    }
  });

})();
