# 💼 LinkedIn Job Collector (Stealth Edition)

> A lightweight, zero-risk Chrome & Edge (Manifest V3) extension that extracts all jobs visible on your current LinkedIn search page (~25 jobs) and copies clean CSV directly to your clipboard.

---

## 🛡️ Stealth & Anti-Detection Architecture

Designed from the ground up to **eliminate account suspension risks & anti-bot flags**:

- 👤 **100% User-Driven Navigation**: Zero automated clicks, page navigations, or synthetic mouse events (`isTrusted === false`). You browse LinkedIn pages naturally.
- 👁️ **Passive Read-Only Extraction**: Reads existing text directly from the DOM (`innerText`, `getAttribute`). Makes **zero external API/network requests**, leaving zero digital footprint.
- 🌊 **Humanized Micro-Scrolling**: Smoothly un-occludes virtual list cards using randomized micro-step distances (140px–280px) and jittered human delays (90ms–210ms).
- 📋 **Direct Clipboard Output**: Copies RFC 4180 formatted CSV straight to your system clipboard without file downloads or DevTools.

---

## 📊 Extracted CSV Schema

The copied CSV contains **9 fields**:

| Field | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| **Job ID** | String | Unique LinkedIn Job Identifier | `"4467432818"` |
| **Title** | String | Clean Job Title | `"Software Development Engineer"` |
| **Company** | String | Hiring Company Name | `"Clearwater Analytics"` |
| **Location** | String | Work location & modality | `"Mumbai (On-site)"` |
| **Salary** | String | Extracted compensation (if listed) | `"₹8 - ₹12 LPA"` |
| **Posted Date** | String | Relative posting timeframe | `"2 hours ago"` |
| **Easy Apply** | Boolean | Easy Apply availability flag | `true` |
| **Verified** | Boolean | Verified job posting indicator | `true` |
| **URL** | String | Direct link to job posting | `"https://www.linkedin.com/jobs/view/4467432818"` |

---

## 🚀 Quick Start (Installation)

1. Clone or download this repository.
2. Navigate to `chrome://extensions` (or `edge://extensions`) in your browser.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the `job-extractor` directory.

---

## 🎯 How to Use

1. Open any LinkedIn Jobs search page (e.g., `https://www.linkedin.com/jobs/search-results/?...`).
2. Click the **LinkedIn Job Collector** extension icon.
3. Click **"Copy Page Jobs"**.
4. The extension gently micro-scrolls the container to un-occlude all page cards (~25 jobs) and copies the CSV.
5. Paste (`Ctrl+V` / `Cmd+V`) into **Google Sheets**, **Excel**, **ChatGPT**, or **Python/Pandas**!
6. To extract more pages, simply navigate to Page 2 naturally on LinkedIn and click the button again!

---

## 📝 License

MIT
