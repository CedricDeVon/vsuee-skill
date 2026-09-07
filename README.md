# VSUEE — Visayas State University E-Learning Toolkit & Agent Skill

[![CI](https://github.com/M1Vj/vsuee/actions/workflows/ci.yml/badge.svg)](https://github.com/M1Vj/vsuee/actions)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![AI Agent Skill](https://img.shields.io/badge/Agent_Skill-Gemini_%7C_Codex_%7C_Claude-orange.svg)](skills/vsuee/SKILL.md)

High-performance CLI toolkit and AI agent skill for the **Visayas State University E-Learning Environment (VSUEE)** running Moodle at [elearning.vsu.edu.ph](https://elearning.vsu.edu.ph).

Engineered for students, researchers, and autonomous coding agents (Gemini CLI, Codex, Claude Code, Cursor) who need instant access to course syllabi, assignments, lecture slides, submission rubrics, calendar deadlines, and last-minute instructor updates without fighting slow web interfaces.

---

## Highlights

- ⚡ **Direct HTTP/AJAX Engine**: Sub-second queries for courses, assignments, quizzes, and forum threads without heavy browser rendering overhead.
- 🔄 **Intelligent Snapshot Diffing**: Detects newly uploaded lecture notes, unhidden exam topics, and moved deadlines with surgical change reporting (`vsuee sync`, `vsuee diff`).
- 📅 **RFC 5545 iCalendar Export**: Exports all course deadlines and quiz windows into standard `.ics` files with 24-hour `VALARM` notifications for Apple Calendar, Google Calendar, and Microsoft Outlook.
- 🚀 **Parallel Batch Downloads**: High-speed concurrent downloads with bounded worker pools, progress indicators, MIME type detection, and incremental deduplication.
- 🔐 **Machine-Bound AES-256-GCM Session Storage**: Encrypts credentials and sessions with a machine-derived key stored at `~/.config/vsuee/session.json` (`chmod 0600`). Automatically handles background re-authentication on 6-hour sliding window timeouts.
- 📸 **Targeted Visual Proof**: Playwright fallback to capture crisp element screenshots (`--selector`) or full-page captures for quiz timers, submission tables, and grades.
- 🤖 **Agent-Ready Native Skill**: Includes a standardized [`SKILL.md`](skills/vsuee/SKILL.md) specification enabling AI agents to read lecture pages, inspect rubrics, verify submission statuses, and monitor updates autonomously.

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [AI Agent Skill Setup](#ai-agent-skill-setup)
- [Command Reference](#command-reference)
  - [1. Authentication & Session Management](#1-authentication--session-management)
  - [2. Courses & Syllabus Inspection](#2-courses--syllabus-inspection)
  - [3. Deadlines, Assignments & Grades](#3-deadlines-assignments--grades)
  - [4. File & Media Downloads](#4-file--media-downloads)
  - [5. Change Detection & Monitoring](#5-change-detection--monitoring)
  - [6. Visual Inspection & Screenshots](#6-visual-inspection--screenshots)
- [Common Workflows & Runbooks](#common-workflows--runbooks)
- [Security & Privacy](#security--privacy)
- [Academic Integrity](#academic-integrity)
- [Development & Testing](#development--testing)
- [License](#license)

---

## Installation

### Prerequisites
- Node.js >= 18.0.0
- (Optional) `playwright` for browser mode / screenshot capture

### Global Install

```bash
# Clone repository
git clone https://github.com/M1Vj/vsuee.git ~/.local/share/vsuee
cd ~/.local/share/vsuee

# Link executable to your PATH
mkdir -p ~/.local/bin
ln -sf "$(pwd)/bin/vsuee.mjs" ~/.local/bin/vsuee

# Ensure ~/.local/bin is in your PATH (e.g. in ~/.zshrc or ~/.bashrc):
# export PATH="$HOME/.local/bin:$PATH"
```

Or install globally via npm:

```bash
npm install -g .
```

To enable browser-based screenshots and interactive login fallback:

```bash
npm install playwright
```

---

## Quick Start

### 1. Authenticate

```bash
# Standard interactive login (saves encrypted credentials for seamless auto-relogin)
vsuee login

# Or open interactive browser to log in visually:
vsuee login-browser

# Verify connection health
vsuee status
```

### 2. View Courses & Deadlines

```bash
# List enrolled courses with progress
vsuee courses

# View upcoming deadlines and timeline events
vsuee timeline

# Export upcoming deadlines to Apple/Google Calendar (.ics)
vsuee calendar --export
```

### 3. Check for New Updates

```bash
# Sync courses and check if instructors uploaded slides or changed deadlines
vsuee sync

# Or compare remote portal live against local baseline
vsuee diff --live
```

---

## AI Agent Skill Setup

`vsuee` includes a portable agent skill specification following the open agent skill standard.

### For Gemini CLI / Antigravity
```bash
mkdir -p ~/.gemini/config/plugins/vsuee/skills/vsuee
cp skills/vsuee/SKILL.md ~/.gemini/config/plugins/vsuee/skills/vsuee/SKILL.md
```

### For Codex CLI
```bash
mkdir -p ~/.codex/skills/vsuee
cp skills/vsuee/SKILL.md ~/.codex/skills/vsuee/SKILL.md
```

### For Claude Code
```bash
mkdir -p ~/.claude/skills/vsuee
cp skills/vsuee/SKILL.md ~/.claude/skills/vsuee/SKILL.md
```

Once installed, agents will automatically discover `vsuee` commands when asked questions like:
- *"Check my upcoming deadlines on VSU eLearning."*
- *"Did my professor upload any new slides today?"*
- *"Download all lecture PDFs for CSci 144."*
- *"Show me the rubric and submission status for Assignment 3."*
- *"Export my VSU exam and quiz schedule to Apple Calendar."*

---

## Command Reference

### 1. Authentication & Session Management

| Command | Description |
| :--- | :--- |
| `vsuee status` | Inspect connection health, student profile, sesskey, and auto-relogin status |
| `vsuee login` | Log in with student credentials (stores encrypted secret for auto-relogin) |
| `vsuee login --no-save-credentials` | Log in without persisting credentials |
| `vsuee login-browser` | Open interactive Chromium window to log in and capture session cookie |
| `vsuee session get` | Output active session state as formatted JSON |
| `vsuee session set <cookie>` | Manually apply an existing `MoodleSession` cookie |
| `vsuee session auto <on\|off>` | Toggle automatic background re-authentication on session timeout |
| `vsuee credentials set [user] [pass]` | Store encrypted credentials for background auto-relogin |
| `vsuee credentials status` | Inspect saved credential state |
| `vsuee credentials clear` | Remove stored credentials |
| `vsuee touch`, `vsuee keepalive` | Refresh the 6-hour sliding session window |
| `vsuee session clear` | Log out and wipe cached session cookies and credentials |

### 2. Courses & Syllabus Inspection

| Command | Description |
| :--- | :--- |
| `vsuee courses` | List active enrolled courses and completion percentages |
| `vsuee courses --all` | List all enrolled courses including past, future, and hidden shells |
| `vsuee courses --filter <type>` | Filter courses: `inprogress`, `past`, `future`, `hidden`, `all` |
| `vsuee courses --search <query>` | Search courses by title or course code (e.g. `CSci 144`) |
| `vsuee course <course_id>` | View course outline, section topics, activities, quizzes, and files |
| `vsuee course <course_id> --all` | Include empty sections and hidden items |
| `vsuee read <page_id>` | Read full text content of a Moodle Page lecture module |
| `vsuee url <url_id>` | Inspect external links, embedded YouTube videos, or drive targets |
| `vsuee quiz <quiz_id>` | Inspect quiz open/close dates, time limits, attempts, and directions |
| `vsuee forum <forum_id>` | View announcements and discussion threads from a course forum |
| `vsuee export [course_id]` | Export course outline or catalog with assignment tables to Markdown |

### 3. Deadlines, Assignments & Grades

| Command | Description |
| :--- | :--- |
| `vsuee timeline` | View upcoming calendar events, quizzes, and deadlines in chronological order |
| `vsuee calendar` | View comprehensive upcoming schedule across courses |
| `vsuee calendar --export [file.ics]` | Export schedule to standard RFC 5545 `.ics` file (defaults to `~/Downloads/vsuee_calendar.ics`) |
| `vsuee assignments` | List assignments across all courses |
| `vsuee assignments --pending` | Show only pending/unsubmitted assignments |
| `vsuee assignments --course <id>` | Filter assignments to a specific course |
| `vsuee assign <assign_id>` | View assignment prompt, deadline, rubrics, and submission status |
| `vsuee assign <id> --download-rubric` | Download instructor prompt files and save parsed `rubric_criteria.md` |
| `vsuee assign <id> --download-submission` | Download student's previously submitted files |
| `vsuee submission <assign_id>` | Detailed submission status, online text, grades, teacher feedback, and rubrics |
| `vsuee submissions [course_id]` | Summary matrix of submission statuses across assignments |
| `vsuee grades` | View gradebook overview across courses |
| `vsuee grades --course <id>` | View detailed grade report for a specific course |

### 4. File & Media Downloads

| Command | Description |
| :--- | :--- |
| `vsuee download <course_id>` | Batch download all course slides, PDFs, and files |
| `vsuee download <course_id> -c <n>` | Parallel batch download with bounded concurrency (default: 4, limits: 1–16) |
| `vsuee download <course_id> --type <ext>` | Filter by extension: `pdf`, `pptx`, `docx`, `xlsx`, `zip`, `video`, `audio` |
| `vsuee download <course_id> --section <n>` | Download files exclusively from a specific course section |
| `vsuee download <course_id> --include-assign` | Download lecture materials AND assignment prompt attachments |
| `vsuee download <course_id> --force` | Force re-download overwriting existing local files |
| `vsuee download <course_id> --dest <dir>` | Specify target destination directory (default: `~/Downloads/VSUEE`) |
| `vsuee file <mod_id\|url>` | Download an individual file, slide, or module directly |
| `vsuee file <mod_id> --dest <path>` | Download module to a specific filename or folder |
| `vsuee images <target>` | Extract embedded diagrams, infographics, and charts from page/forum/course |
| `vsuee images <course_id> --deep` | Deep scan: iterate through all child lesson pages and download all diagrams |

### 5. Change Detection & Monitoring

| Command | Description |
| :--- | :--- |
| `vsuee sync` | Sync course catalog, detect new lessons, modified files, and deadline changes |
| `vsuee sync --download-new` | Auto-download new, unhidden, or updated lecture materials |
| `vsuee sync --course <id>` | Sync and diff a specific course only |
| `vsuee diff` | Inspect differences between last two local sync snapshots |
| `vsuee diff --live` | Live diff comparing remote portal against local snapshot |
| `vsuee watch` | Continuous foreground monitoring loop (default: checks every 15 mins) |
| `vsuee watch --interval <mins>` | Configure watch interval |
| `vsuee watch --download-new` | Auto-download new slides as soon as uploaded |
| `vsuee daemon install` | Register background macOS LaunchAgent (`edu.vsu.vsuee-watcher`) |
| `vsuee daemon status` | Check daemon running status, PID, and log file sizes |
| `vsuee daemon logs` | View recent stdout and stderr daemon logs |
| `vsuee daemon stop` | Stop daemon |
| `vsuee daemon start` | Start daemon |
| `vsuee daemon uninstall` | Unload and delete daemon LaunchAgent plist |

### 6. Visual Inspection & Screenshots

*(Requires `playwright`)*

| Command | Description |
| :--- | :--- |
| `vsuee screenshot <target>` | Capture full-page screenshot of course, quiz, or assignment |
| `vsuee screenshot <target> --selector <css>` | Capture a focused element screenshot (e.g. `.submissionstatustable`, `.quizinfo`) |
| `vsuee screenshot course <id> --section <n>` | Capture a specific course section |
| `vsuee screenshot <target> --viewport-only` | Capture visible viewport instead of full scrollable page |
| `vsuee screenshot <target> --out <file>` | Specify output image path |
| `vsuee browser [url]` | Launch authenticated Chromium browser session |

---

## Common Workflows & Runbooks

### 1. Catching Last-Minute Instructor Uploads
Instructors frequently upload lecture notes or problem sets right before class:
```bash
# 1. Check for differences
vsuee sync

# 2. If new files were found, download them automatically
vsuee sync --download-new
```

### 2. Exporting Deadlines to Apple or Google Calendar
```bash
# Export all upcoming course deadlines and quiz windows to .ics
vsuee calendar --export ~/Downloads/vsuee_calendar.ics

# Open directly on macOS to import into Apple Calendar
open ~/Downloads/vsuee_calendar.ics
```

### 3. Downloading Course Materials for Offline Study
```bash
# Download all lecture slides (PPTX and PDF) for course 1610 with 4 parallel streams
vsuee download 1610 --type pdf --dest ~/Documents/CSci144 -c 4
vsuee download 1610 --type pptx --dest ~/Documents/CSci144 -c 4
```

### 4. Background Monitoring Daemon
Keep your local course mirror updated 24/7 without terminal windows:
```bash
# Check every 15 minutes, download new files, and trigger macOS desktop notifications
vsuee daemon install --interval 15 --download-new

# Check status anytime
vsuee daemon status
```

---

## Security & Privacy

1. **Local-Only Storage**: All sessions, hashes, and configuration live in `~/.config/vsuee/`. No telemetry, analytics, or third-party servers are used.
2. **Machine-Bound AES-256-GCM Encryption**: Stored credentials are encrypted with a 256-bit key derived deterministically from the local machine's identity and user context. Encrypted payloads cannot be decrypted if copied to another machine.
3. **Strict File Permissions**: The session and snapshot files are written with `0600` permissions (read/write by the owner only).
4. **Credential Masking**: Command logs, diff summaries, and JSON outputs never expose plaintext passwords.

---

## Academic Integrity

- **Read-Only / Inspection Focused**: `vsuee` is built to organize, inspect, sync, and download course materials.
- **No Automated Quiz Submissions**: The tool intentionally does not provide automated quiz-answering or automated assessment submission. Quizzes must be completed interactively by the student.
- **Confirmation Gate**: Before performing grade-impacting actions, always confirm with the user.

---

## Development & Testing

The test suite contains 69 tests covering authentication, session auto-relogin, course parsing, module reading, parallel downloads, calendar .ics generation, snapshot diffing, and browser screenshots.

```bash
# Run unit tests (offline, no network or credentials needed)
npm run test:unit

# Run full test suite (includes live integration tests when authenticated)
npm test

# Run live integration tests against portal
npm run test:live
```

---

## License

[MIT](LICENSE) © 2026 Vj Mabansag
