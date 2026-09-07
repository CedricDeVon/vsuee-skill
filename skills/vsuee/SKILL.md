---
name: vsuee
description: >-
  Comprehensive skill and automation toolkit for the Visayas State University E-Learning Environment
  (VSUEE Moodle at elearning.vsu.edu.ph). Use when interacting with VSU eLearning, listing enrolled courses,
  checking upcoming assignments and deadlines, syncing course updates, diffing changes, reading lecture pages/quizzes,
  downloading materials, or monitoring last-minute instructor updates.
---

# VSUEE (Visayas State University E-Learning Environment) Skill

This skill provides an automated toolkit and interface for interacting with the **Visayas State University E-Learning Environment (VSUEE)** running Moodle at [elearning.vsu.edu.ph](https://elearning.vsu.edu.ph/).

## Overview

The `vsuee` CLI engine is installed on the system `$PATH` (e.g. `vsuee` or `~/.local/bin/vsuee`).
It provides high-speed, direct HTTP/AJAX interaction with Moodle, intelligent snapshotting and change-detection diffing, background monitoring automations, and an optional Playwright browser fallback.

Sessions and cookies are cached securely at:
`~/.config/vsuee/session.json` (chmod 600).
Course snapshots and diff baselines live at:
`~/.config/vsuee/snapshots/`.

---

## Command Reference

### 1. Course Discovery & Inspection
| Command | Purpose |
| :--- | :--- |
| `vsuee courses` | List active enrolled courses with progress percentages |
| `vsuee courses --all` | List all enrolled courses including past, future, and hidden shells |
| `vsuee courses --filter <cls>` | Filter by classification: `inprogress`, `past`, `future`, `hidden`, `all` |
| `vsuee courses --search <term>` | Search enrolled courses by code (e.g. `CSci 144`) or title |
| `vsuee course <course_id>` | View course outline, topics, lessons, quizzes, and files |
| `vsuee course <course_id> --all`| View all sections including empty and instructor-hidden topics |
| `vsuee read <mod_id>` | Read full text/content of a Moodle Page or lesson module |
| `vsuee url <url_id>` | Inspect external link, embedded media, or video in a URL module |
| `vsuee quiz <quiz_id>` | View quiz open/close dates, time limits, attempts, instructions |
| `vsuee forum <forum_id>` | View announcements and discussion threads from a course forum |
| `vsuee export [course_id]` | Export course outline or catalog with assignment/deadline tables to Markdown |

### 2. Change Detection & Sync Automations
| Command | Purpose |
| :--- | :--- |
| `vsuee sync` | Sync course catalog, detect new lessons, modified files, deadline changes |
| `vsuee sync --all` | Deep sync across active, past, and hidden courses |
| `vsuee sync --course <id>` | Sync and diff a specific course only (safely merges into baseline) |
| `vsuee sync --download-new` | Auto-download new, unhidden, or updated lecture/resource files |
| `vsuee diff` | Inspect differences between last two local sync snapshots |
| `vsuee diff --live` | Live diff comparing remote portal against local snapshot without overwriting |
| `vsuee watch` | Continuous monitor daemon loop checking for last-minute instructor updates |
| `vsuee watch --interval <m>` | Set watch polling interval in minutes (default: 15) |
| `vsuee watch --download-new` | Auto-download new/updated lecture slides/materials as soon as uploaded |
| `vsuee watch --no-notify` | Disable desktop notifications |
| `vsuee watch --once` | Run a single watch verification check and exit |
| `vsuee daemon <cmd>` | Manage background macOS launchd monitoring daemon (`install`, `status`, `logs`, `stop`, `start`, `uninstall`) |

### 3. Deadlines, Assignments & Grades
| Command | Purpose |
| :--- | :--- |
| `vsuee timeline` | View upcoming calendar deadlines and action events |
| `vsuee calendar` | View upcoming schedule with course deadlines and timeline events |
| `vsuee calendar --export [file.ics]` | Export deadlines to RFC 5545 `.ics` file for Apple/Google Calendar import (default: `~/Downloads/vsuee_calendar.ics`) |
| `vsuee assignments` | View all assignments across enrolled courses |
| `vsuee assignments --pending` | View only unsubmitted/pending assignments |
| `vsuee assignments --course <id>`| Filter assignments by course ID |
| `vsuee assign <assign_id>` | View full assignment prompt, rubric, due date, online text, submission status, grades |
| `vsuee assign <id> --download-rubric` | Download prompt attachments/rubric files and save `rubric_criteria.md` |
| `vsuee assign <id> --download-submission` | Download student's previously submitted files |
| `vsuee submission <assign_id>` | Inspect detailed submission status, online text, grades, student files, teacher feedback, and rubrics |
| `vsuee submission <id> --download-rubric` | Download attached rubric files and save criteria breakdown |
| `vsuee submission <id> --download-submission` | Download student's submitted files |
| `vsuee submissions [course_id]` | Summary matrix of submission statuses across course assignments |
| `vsuee grades` | View gradebook overview across courses |
| `vsuee grades --course <id>` | View itemized gradebook report for a specific course |

### 4. File, Module & Media Downloads
| Command | Purpose |
| :--- | :--- |
| `vsuee download <course_id>` | Batch download all PDFs, slides, and syllabus files (skips identical existing) |
| `vsuee download <course_id> --concurrency <n>` | Parallel batch download with bounded concurrency pool (default: 4, limits 1–16) |
| `vsuee download <course_id> --type <ext>` | Download only specific file types (e.g. `pdf`, `pptx`/`ppt`, `docx`/`doc`, `xlsx`, `zip`, `video`, `audio`) |
| `vsuee download <course_id> --section <n>` | Download files exclusively from a specific course section |
| `vsuee download <course_id> --include-assign` | Batch download all course materials AND instructor assignment prompt/rubric files |
| `vsuee download <course_id> --force` | Force re-download of all materials overwriting local files |
| `vsuee download <course_id> --dest <dir>` | Download to custom destination directory (default: `~/Downloads/VSUEE`) |
| `vsuee file <mod_id|url>` | Download a specific file, lecture slide, or module directly by ID, shortcut, or URL |
| `vsuee file <mod_id> --dest <path>` | Download module to a specific destination path (directory or exact filename `.pdf`) |
| `vsuee download --mod <mod_id>` | Alternative syntax to download an individual module |

### 5. Visual Inspection & Screenshots
| Command | Purpose |
| :--- | :--- |
| `vsuee screenshot <target>` | Capture full-page screenshot of any course, assignment, quiz, or custom URL |
| `vsuee screenshot <target> --selector <css>` | Capture a crisp, focused element screenshot of a specific component |
| `vsuee screenshot course <id> --section <n>` | Capture a focused screenshot of a specific course section |
| `vsuee screenshot <target> --viewport-only` | Capture only above-the-fold viewport instead of full scrollable page |
| `vsuee screenshot <target> --out <file>` | Specify output image filename and destination path |
| `vsuee screenshot <target> --timeout <ms>` | Custom navigation or selector visibility timeout in milliseconds |
| `vsuee images <target>` | Extract and download embedded diagrams, figures, and charts from page/forum/course |
| `vsuee images <course_id> --deep` | Deep scan: iterate through all child lesson pages and download all diagrams |
| `vsuee browser [url]` | Launch authenticated Chromium browser session with saved session cookie |

### 6. Authentication & Session Management
| Command | Purpose |
| :--- | :--- |
| `vsuee status` | Verify connection, check if session is active, and view auto-relogin status |
| `vsuee login` | Log in with student ID and password (automatically encrypts & saves credentials for auto-relogin) |
| `vsuee login --no-save-credentials` | Log in without saving credentials for background auto-relogin |
| `vsuee login-browser` | Open an interactive browser to log in and capture session |
| `vsuee session get` | Inspect cached session cookie, sesskey, and auto-relogin configuration |
| `vsuee session set <cookie>` | Manually set active `MoodleSession` cookie |
| `vsuee session auto <on|off>` | Toggle automatic background re-authentication on session expiry |
| `vsuee session save-credentials [u] [p]` | Save encrypted credentials for background auto-relogin |
| `vsuee credentials set [user] [pass]` | Alternative syntax to set encrypted background credentials |
| `vsuee credentials status` | Inspect saved credential status and auto-relogin toggle |
| `vsuee credentials clear` | Delete stored encrypted credentials |
| `vsuee touch`, `vsuee keepalive` | Ping dashboard to refresh the 6-hour sliding session window |
| `vsuee session clear` | Log out and remove cached session cookie and credentials |

---

## Common Workflows & Runbooks

### 1. Catching Last-Minute Instructor Uploads ("Did the professor post anything?")
VSU instructors frequently update Moodle right before class or during exam week:
1. Run `vsuee sync` or `vsuee diff --live`.
2. Inspect the categorized output:
   - **Deadlines Changed**: Highlights any due date extensions or moved deadlines.
   - **New Lessons Added**: Shows newly uploaded lecture notes, problem sets, or slides.
   - **Unhidden Content**: Flags sections or modules that the instructor previously concealed and just revealed.
3. If new files were added and you want them locally, run `vsuee sync --download-new`.

### 2. Checking Deadlines, Calendar Schedule & Exporting to iCalendar (.ics)
When the user asks "what's due soon?", "do I have any homework?", "check my upcoming deadlines", or wants to export their schedule to Apple/Google Calendar:
1. **View Upcoming Deadlines**:
   ```bash
   vsuee timeline
   vsuee assignments --pending
   vsuee calendar
   ```
2. **Export Deadlines to Apple Calendar / Google Calendar (.ics)**:
   ```bash
   # Export upcoming deadlines to standard RFC 5545 iCalendar format (defaults to ~/Downloads/vsuee_calendar.ics)
   vsuee calendar --export

   # Or specify custom destination path
   vsuee calendar --export ~/Desktop/vsu_deadlines.ics

   # Custom period or event filtering
   vsuee calendar --export ~/Desktop/vsu_deadlines.ics --period all --events courses
   ```
   Users can open the generated `.ics` file directly to import all course deadlines into Apple Calendar, Google Calendar, or Microsoft Outlook with exact due times, course summaries, and direct portal links.
3. For quizzes with specific opening/closing windows, run `vsuee quiz <quiz_id>`.
4. Present a clear, chronological breakdown of course, activity, due date, and time remaining. Highlight items marked `[OVERDUE!]`.

### 3. Inspecting Submissions, Rubric Criteria & Feedback
When checking whether an assignment was turned in, reviewing grades and teacher feedback, or inspecting rubric tables:
1. **Detailed Assignment & Submission Status**:
   ```bash
   # View prompt, deadline, submission status, grade, teacher feedback, and rubric criteria:
   vsuee submission <assign_id>
   ```
2. **Course-Wide Submission Matrix**:
   ```bash
   # Check submission status of every assignment in a specific course:
   vsuee submissions <course_id>

   # Or across all enrolled courses:
   vsuee submissions
   ```
3. **Downloading Rubrics and Previous Submissions**:
   ```bash
   # Download instructor prompt documents, rubric PDFs, and generated rubric_criteria.md:
   vsuee submission <assign_id> --download-rubric --dest ~/Downloads/VSUEE

   # Download student's previously submitted files:
   vsuee submission <assign_id> --download-submission --dest ~/Downloads/VSUEE
   ```

### 4. Reading Lesson Content Without a Browser
When the user asks to review lecture notes published as a Moodle Page:
1. Find module ID via `vsuee course <course_id>`.
2. Run `vsuee read <module_id>`.
3. The plain text content, instructions, and notes render directly in terminal/context.

### 5. Downloading Single Files, Modules, Slides & Rubrics
When the user asks to "download this lecture slide", "download all PPTs", or "save the assignment rubric":
1. **Single File/Module**:
   ```bash
   # Download specific module ID (e.g. syllabus PDF, presentation slide, or lab code)
   vsuee file <module_id> --dest ~/Downloads/VSUEE

   # Or save directly as a specific filename:
   vsuee file <module_id> --dest ~/Downloads/Lesson_Slides.pdf

   # Or download assignment attachments directly:
   vsuee file assign <assign_id>

   # Or by direct URL:
   vsuee file https://elearning.vsu.edu.ph/mod/resource/view.php?id=<module_id>
   ```
2. **Whole Course Materials with Parallel Concurrency & Progress Bars**:
   ```bash
   # Download all resources and folders in course with 4 parallel worker streams
   vsuee download <course_id> --dest ~/Downloads/VSUEE --concurrency 4
   ```
3. **Filtering by Extension (PDFs only, PPTs only, Videos only)**:
   ```bash
   vsuee download <course_id> --type pdf
   vsuee download <course_id> --type pptx
   vsuee download <course_id> --type video
   ```
4. **Filtering by Course Section**:
   ```bash
   # Download only materials posted in Section 2
   vsuee download <course_id> --section 2
   ```
5. **Including Assignment Attachments & Rubrics**:
   ```bash
   # Downloads lecture slides AND all instructor attachments in assignments
   vsuee download <course_id> --include-assign
   ```

### 6. Capturing Visual Proof: Full-Page and Element Screenshots
When the user or agent needs visual proof of quiz time limits, assignment submission status, or course outlines:
1. **Full-Page Screenshot**:
   ```bash
   # Full-page screenshot of a course
   vsuee screenshot course <course_id> --out ~/Desktop/course.png

   # Full-page screenshot of an assignment, quiz, or forum discussion
   vsuee screenshot assign <assign_id> --out ~/Desktop/assign_status.png
   vsuee screenshot quiz <quiz_id> --out ~/Desktop/quiz_details.png
   vsuee screenshot discuss <discussion_id> --out ~/Desktop/discussion.png
   ```
2. **Element Screenshot (Targeted Inspection)**:
   Capture only the specific UI element to save space, avoid clutter, and focus on relevant data:
   ```bash
   # Screenshot only the assignment submission table (rubric, grading status, submission time)
   vsuee screenshot assign <assign_id> --selector ".submissionstatustable" --out submission.png

   # Screenshot only the quiz date/timer info box
   vsuee screenshot quiz <quiz_id> --selector ".quizinfo" --out quiz_timer.png

   # Screenshot only the course main content region (excluding navigation chrome)
   vsuee screenshot course <course_id> --selector "#region-main" --out course_body.png

   # Screenshot only a specific course section directly
   vsuee screenshot course <course_id> --section 1 --out section1.png
   ```

### 7. Extracting and Downloading Embedded Diagrams & Content Images
Instructors often embed architecture diagrams, algorithm flowcharts, and lecture slides directly into Moodle Page modules, forum posts, or course sections:
1. **From a Specific Lecture Page Module**:
   ```bash
   # Download diagrams embedded in Lesson page
   vsuee images page <page_id> --dest ~/Downloads/VSUEE
   ```
2. **From a Specific Course Section**:
   ```bash
   # Download all diagrams and charts posted in Section 1
   vsuee images course <course_id> --section 1
   ```
3. **From an Assignment Prompt**:
   ```bash
   # Download sample outputs or wireframes embedded in the assignment description
   vsuee images assign <assign_id>
   ```
4. **From Forum Announcements / Discussion Threads**:
   ```bash
   # Download schedule matrices or infographic announcements from a forum
   vsuee images forum <forum_id>
   # Or directly from a specific discussion thread
   vsuee images discuss <discussion_id>
   ```
5. **Deep Course Scan (All Child Lessons in Course)**:
   ```bash
   # Crawls the entire course syllabus, reads every Page module, and downloads all diagrams in parallel
   vsuee images <course_id> --deep --dest ~/Downloads/VSUEE --concurrency 4
   ```
   *(Theme chrome, default icons, and spacers are automatically filtered out, saving only real educational content).*

### 8. Continuous Watcher Loop
To monitor courses in the foreground terminal (e.g. during study sessions or while waiting for an exam link):
```bash
vsuee watch --interval 10 --download-new --notify
```
- Emits timestamped alerts whenever course contents change.
- Sends desktop notifications (macOS / Linux).
- Automatically saves newly uploaded files to `~/Downloads/VSUEE`.

### 9. Persistent Background Monitoring Daemon (macOS launchd)
For headless 24/7 background monitoring across reboots without keeping an interactive terminal open:
```bash
# Install and register LaunchAgent (runs sync every 15 mins and sends desktop notifications)
vsuee daemon install --interval 15 --download-new

# Check daemon health, running PID, and log sizes
vsuee daemon status

# Inspect recent daemon execution logs
vsuee daemon logs --limit 30

# Temporarily stop, restart, or permanently remove the daemon
vsuee daemon stop
vsuee daemon start
vsuee daemon uninstall
```

### 10. Seamless Background Auto-Relogin & Sliding Window Keep-Alive
Moodle sessions expire after idle timeouts or overnight. The toolkit automatically encrypts login details with a machine-bound AES-256-GCM key and transparently recovers expired sessions without human intervention:
1. **Configuring Saved Credentials**:
   ```bash
   # Saved automatically on standard login:
   vsuee login --user <student_id> --pass <password>

   # Or explicitly store encrypted credentials:
   vsuee credentials set <student_id> <password>
   ```
2. **Seamless Background Recovery**:
   When any command (`vsuee courses`, `vsuee assignments`, `vsuee sync`, `vsuee watch`, `vsuee download`, etc.) receives an expiry 302 redirect or login form, it automatically decrypts the credentials, logs in, refreshes the session cookie, and retries the original request seamlessly.
3. **Keeping Sliding Window Active**:
   ```bash
   # Pings Moodle /my/ dashboard to keep the 6-hour sliding session active
   vsuee touch
   ```
4. **Toggling Auto-Relogin**:
   ```bash
   # Disable automatic re-login:
   vsuee session auto off

   # Re-enable automatic re-login:
   vsuee session auto on
   ```

---

## Safety & Operating Rules

- **Academic Integrity**: Never blindly auto-submit answers to quizzes or tests. Quizzes should be inspected for deadlines and reviewed with the user.
- **Confirmation Gate**: Before performing destructive or grading-impacting actions (e.g. finalizing an assignment submission), always confirm with the user.
- **Privacy & Security**: Credentials and session cookies are stored in local `~/.config/vsuee/session.json` (chmod 600). Never log or commit session cookies or passwords.
