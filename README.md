# 💼 LinkedIn Job Collector

> A lightweight Chrome & Edge (Manifest V3) extension that collects the first **100 jobs** from any LinkedIn search results page and copies clean CSV directly to your clipboard — with zero page reloads.

---

## ✨ Features

- 🚀 **Zero Page Reloads**: Keeps your exact search filters, keywords, URL, and tab state completely intact.
- ⚡ **Automated SPA Pagination**: Smooth-scrolls to un-occlude virtual cards and programmatically fetches up to 100 unique jobs.
- 📋 **Direct Clipboard Output**: Copies clean, RFC 4180 escaped CSV straight to your clipboard. No extra file downloads or DevTools needed.
- 🛡️ **Read-Only & Privacy First**: No tracking, no background servers, no automated applications, and uses minimum Manifest V3 permissions.
- 🔤 **Full Unicode & Currency Support**: Accurately preserves salary symbols (`₹`, `$`, `€`, `£`) and Unicode text formatting.

---

## 📊 Extracted CSV Schema

The generated CSV contains the following **9 fields**:

| Field | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| **Job ID** | String | Unique LinkedIn Job Identifier | `"4467432818"` |
| **Title** | String | Clean Job Title | `"Software Development Engineer"` |
| **Company** | String | Hiring Company Name | `"Clearwater Analytics"` |
| **Location** | String | Work location & work modality | `"Mumbai (On-site)"` |
| **Salary** | String | Extracted compensation (if listed) | `"₹8 - ₹12 LPA"` |
| **Posted Date** | String | Relative posting timeframe | `"2 hours ago"` |
| **Easy Apply** | Boolean | Easy Apply availability flag | `true` |
| **Verified** | Boolean | Verified job posting indicator | `true` |
| **URL** | String | Direct link to job posting | `"https://www.linkedin.com/jobs/view/4467432818"` |

---

## 🚀 Quick Start (Installation)

1. **Clone or Download** this repository.
2. Open Chrome or Edge and navigate to `chrome://extensions` (or `edge://extensions`).
3. Enable **Developer mode** using the toggle switch in the top right corner.
4. Click **Load unpacked** and select the `job-extractor` directory.

---

## 🎯 How to Use

1. Open a LinkedIn Jobs search page (e.g., `https://www.linkedin.com/jobs/search-results/?...`).
2. Click the **LinkedIn Job Collector** extension icon in your browser toolbar.
3. Click **"Copy 100 Jobs"**.
4. Watch the progress status (`Collecting... 25/100`, `Collecting... 50/100`...).
5. Paste (`Ctrl+V` / `Cmd+V`) your clean CSV directly into **Google Sheets**, **Excel**, **ChatGPT**, or **Python/Pandas**!

---

## ⚙️ Tech Stack

- **Manifest V3**
- **Vanilla JavaScript** (ES2022)
- **HTML5 & CSS3** (Custom Dark Theme Popup UI)
- **DOM Parsing & Virtual Scroll Observer**

---

## 📝 License

MIT
