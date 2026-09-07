#!/usr/bin/env node

import path from 'node:path';
import readline from 'node:readline';
import { Writable } from 'node:stream';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { MoodleClient, expandHome, ProgressIndicator } from '../lib/moodle-client.mjs';
import { BrowserRunner } from '../lib/browser-runner.mjs';
import { SyncManager } from '../lib/sync-manager.mjs';

const execFileAsync = promisify(execFile);

const USAGE = `
VSUEE CLI — Visayas State University E-Learning Environment Toolkit
Portal: https://elearning.vsu.edu.ph

Usage:
  vsuee <command> [options]

Session & Connectivity:
  status                     Check session health, user profile, connectivity, and auto-relogin
  login                      Log in with username and password (saves credentials for auto-relogin)
  login-browser              Open interactive browser window to log in and save session
  session <action>           Inspect (get), set, toggle auto-relogin (auto <on|off>), save-credentials, or clear
  credentials <action>       Manage saved credentials (set [user] [pass], status, clear)
  touch, keepalive           Ping dashboard to keep 6-hour sliding session window fresh

Courses & Academic Content:
  courses                    List enrolled courses and progress (--all, --filter, --search)
  course <id>                View course syllabus, sections, modules, and completion (--all)
  read, page <id>            Read full text and instructions of a Moodle Page module
  url, link <id>             Inspect external link or video target of a Moodle URL module
  quiz <id>                  Inspect quiz details, time limits, deadlines, and attempts
  forum <id>                 View announcements and discussions from a course forum
  timeline, upcoming         View upcoming deadlines, calendar events, and action items
  calendar, ical             View calendar events or export to RFC 5545 .ics (--export <file.ics>)
  assignments                List assignments across all courses (or specify --course <id>)
  assign <id>                View full assignment description, rubric, files, and status
  submission <id>            Inspect submission status, grades, rubrics, and files (--download-rubric)
  submissions [course_id]    View submission matrix across course or all courses
  grades                     View gradebook summary or course breakdown (--course <id>)
  download <course_id>       Parallel download course materials/slides (--concurrency, --dest, --type)
  file, get-file <id|url>    Download single module, lecture slide, or file directly (--dest, --force)
  export [course_id]         Export course syllabus or catalog to Markdown (--out <file>)

Change Detection & Sync Automations:
  sync                       Sync courses, detect new lessons, modified files, or deadline changes
  diff                       Compare changes against latest snapshot or live portal (--live)
  watch, monitor             Continuous watcher loop for last-minute instructor updates
  daemon <cmd>               Manage background monitoring daemon (install, status, logs, stop, start, uninstall)

Visual Inspection & Media Tools:
  screenshot <target>        Capture full-page or element screenshot (--selector, --out, --viewport-only)
  images <target>            Extract and download embedded content images/diagrams (--dest, --deep, -c)
  browser [url]              Launch browser session with saved session cookie

Target Shortcuts (for screenshot, images, file):
  course <id> | assign <id> | quiz <id> | page <id> | forum <id> | discuss <id> | <url>

Options:
  --all, -a                  Include all courses (including past and hidden courses)
  --filter <status>          Filter courses: inprogress, past, future, hidden, all
  --search <term>            Search courses by code or title
  --export, -e <file>        Export calendar schedule to .ics file (for Apple/Google Calendar)
  --period <period>          Calendar period: recentupcoming (default), monthnow, weeknext, custom
  --events <type>            Calendar events scope: all (default), courses, user
  --concurrency, -c <num>    Bounded parallel download streams (default: 4, max: 16)
  --download-rubric          Download attached rubric and guideline files for an assignment
  --download-submission      Download student's own submitted files for an assignment
  --download-new             Auto-download newly detected files during sync or watch
  --dest <dir>               Target download directory or file path (default: ~/Downloads/VSUEE)
  --type <ext>               Filter downloads by file type (e.g. pdf, pptx, docx, xlsx, zip, video)
  --section <num>            Filter downloads, screenshots, or images to a specific course section
  --include-assign           Include assignment prompt and rubric attachments in downloads
  --mod, --module <id>       Specify module ID for download
  --selector <css>           CSS selector to capture screenshot of specific element
  --viewport-only            Capture only visible viewport instead of full scrollable page
  --width <px>, --height <px> Custom viewport dimensions for screenshot
  --timeout <ms>             Navigation and element search timeout in ms
  --deep                     Deep scan all child lesson pages/discussions for embedded images
  --include-theme            Include theme icons/logos (excluded by default)
  --out <file>               Custom output file path (screenshot, markdown export, or ics)
  --interval <mins>          Watch interval in minutes (default: 15)
  --notify                   Send desktop notifications on updates (macOS)
  --no-notify                Disable desktop notifications
  --live                     Live diff against remote portal without overwriting snapshot
  --force                    Force re-download or force snapshot save
  --pending                  Show only pending/unsubmitted assignments
  --course <id>              Filter or target by course ID
  --assign <id>              Target assignment by ID
  --quiz <id>                Target quiz by ID
  --page <id>                Target page by ID
  --forum <id>               Target forum by ID
  --discuss <id>             Target forum discussion by ID
  --json                     Output raw JSON instead of formatted text
  --quiet, -q                Minimal output (ideal for cron/scripts)
  --user <username>          Specify username/student ID
  --pass <password>          Specify password directly
  --show-password            Echo characters in plain text while typing password
  --no-save-credentials      Do not store encrypted credentials during login
  --help, -h                 Show this help message
`;

async function promptText(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function promptPassword(query, showPlain = false) {
  if (showPlain) {
    return promptText(query);
  }

  let muted = false;
  const mutableStdout = new Writable({
    write(chunk, encoding, callback) {
      if (!muted) {
        process.stdout.write(chunk, encoding);
      }
      callback();
    },
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: mutableStdout,
    terminal: true,
  });

  return new Promise((resolve) => {
    rl.question(query, (password) => {
      process.stdout.write('\n');
      rl.close();
      resolve(password.trim());
    });
    muted = true;
  });
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h') || (args.length > 0 && args[0] === 'help')) {
    console.log(USAGE);
    process.exit(0);
  }

  const FLAGS_WITH_VALUE = new Set([
    '--filter', '-f',
    '--search', '-s',
    '--export', '-e',
    '--concurrency', '-c',
    '--period',
    '--events',
    '--dest',
    '--type',
    '--mod', '--module',
    '--file',
    '--selector', '--element',
    '--section',
    '--width',
    '--height',
    '--timeout',
    '--selector-timeout',
    '--out',
    '--interval',
    '--course',
    '--assign',
    '--quiz',
    '--page',
    '--forum',
    '--discuss',
    '--limit',
    '--id',
    '--user',
    '--pass',
  ]);

  const positionalArgs = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('-')) {
      if (a.includes('=')) {
        continue;
      }
      if (FLAGS_WITH_VALUE.has(a)) {
        if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
          i++;
        }
      }
      continue;
    }
    positionalArgs.push(a);
  }

  const command = positionalArgs[0] || 'status';

  const isJson = args.includes('--json');
  const client = new MoodleClient();
  await client.init();

  const getArg = (flag, alias = null) => {
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === flag || (alias && a === alias)) {
        if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
          return args[i + 1];
        }
      }
      if (a.startsWith(`${flag}=`)) {
        return a.slice(flag.length + 1);
      }
      if (alias && a.startsWith(`${alias}=`)) {
        return a.slice(alias.length + 1);
      }
    }
    return null;
  };

  const getPositionalArg = (index = 1) => {
    return positionalArgs[index] || null;
  };

  try {
    switch (command) {
      case 'status': {
        const status = await client.checkStatus();
        if (isJson) {
          console.log(JSON.stringify({
            ...status,
            autoRelogin: client.canAutoRelogin(),
          }, null, 2));
        } else {
          console.log('\n--- VSUEE Session Status ---');
          if (status.authenticated) {
            console.log(` Status:       CONNECTED & AUTHENTICATED`);
            console.log(` User:         ${status.user?.fullname || 'Student'} (ID: ${status.user?.id || 'N/A'})`);
            console.log(` Sesskey:      ${status.sesskey || 'N/A'}`);
            console.log(` Server:       ${status.serverUrl}`);
            const autoReloginStr = client.canAutoRelogin()
              ? 'ENABLED (Background re-auth on session timeout)'
              : 'DISABLED';
            console.log(` Auto-Relogin: ${autoReloginStr}`);
            if (status.autoRelogged) {
              console.log(` Notice:       Session was automatically restored via saved credentials.`);
            }
          } else {
            console.log(` Status:       NOT AUTHENTICATED`);
            console.log(` Reason:       ${status.reason}`);
            const autoReloginStr = client.canAutoRelogin()
              ? 'ENABLED (Background re-auth on session timeout)'
              : 'DISABLED';
            console.log(` Auto-Relogin: ${autoReloginStr}`);
            console.log(` Next step:    Run \`vsuee login\` or \`vsuee login-browser\` to authenticate.`);
          }
          console.log('----------------------------\n');
        }
        break;
      }

      case 'login': {
        let username = getArg('--user') || process.env.VSUEE_USERNAME;
        let password = getArg('--pass') || process.env.VSUEE_PASSWORD;
        const showPlain = args.includes('--show-password');
        const saveCreds = !args.includes('--no-save-credentials');

        if (!username) {
          username = await promptText('VSU eLearning Username/Student ID: ');
        }
        if (!password) {
          password = await promptPassword('VSU eLearning Password (silent input): ', showPlain);
        }

        if (!username || !password) {
          console.error('Error: Username and password are required.');
          process.exit(1);
        }

        console.log(`Authenticating as "${username}" with https://elearning.vsu.edu.ph ...`);
        const res = await client.login(username, password, { saveCredentials: saveCreds });
        console.log(`\nLogin successful! Welcome, ${res.user?.fullname || username}.`);
        console.log(`Session saved securely to ~/.config/vsuee/session.json`);
        if (saveCreds) {
          console.log('Credentials encrypted and stored for background auto-relogin.\n');
        } else {
          console.log('Credentials not saved for auto-relogin (--no-save-credentials).\n');
        }
        break;
      }

      case 'login-browser': {
        console.log('Launching browser window for interactive login...');
        const runner = new BrowserRunner();
        const cookie = await runner.interactiveLogin();
        client.sessionCookie = cookie;
        await client.saveSession();
        const status = await client.checkStatus();
        console.log(`\nBrowser login succeeded! Logged in as: ${status.user?.fullname || 'Student'}\n`);
        break;
      }

      case 'session': {
        const sub = args[1] || 'get';
        if (sub === 'get') {
          console.log(JSON.stringify({
            sessionCookie: client.sessionCookie,
            sesskey: client.sesskey,
            user: client.user,
            autoRelogin: client.autoRelogin,
            hasSavedCredentials: Boolean(client.auth?.username && client.auth?.secret),
            savedUsername: client.auth?.username || null,
          }, null, 2));
        } else if (sub === 'set') {
          const cookieVal = args[2];
          if (!cookieVal) {
            console.error('Usage: vsuee session set <MoodleSessionCookieValue>');
            process.exit(1);
          }
          client.sessionCookie = cookieVal;
          await client.saveSession();
          const status = await client.checkStatus();
          console.log(`Session cookie saved. Verified status: ${status.authenticated ? 'Active (' + status.user?.fullname + ')' : 'Invalid / Expired'}`);
        } else if (sub === 'auto') {
          const state = (args[2] || '').toLowerCase();
          if (state !== 'on' && state !== 'off') {
            console.error('Usage: vsuee session auto <on|off>');
            process.exit(1);
          }
          client.autoRelogin = state === 'on';
          await client.saveSession();
          console.log(`Auto-relogin is now ${client.autoRelogin ? 'ENABLED' : 'DISABLED'}.`);
        } else if (sub === 'save-credentials') {
          let username = args[2] || getArg('--user') || process.env.VSUEE_USERNAME;
          let password = args[3] || getArg('--pass') || process.env.VSUEE_PASSWORD;
          if (!username) {
            username = await promptText('VSU eLearning Username/Student ID: ');
          }
          if (!password) {
            password = await promptPassword('VSU eLearning Password (silent input): ');
          }
          if (!username || !password) {
            console.error('Error: Username and password are required.');
            process.exit(1);
          }
          await client.saveCredentials(username, password);
          console.log(`Encrypted credentials saved for user "${username}". Auto-relogin is ENABLED.`);
        } else if (sub === 'clear') {
          await client.clearSession();
          console.log('Cleared saved VSUEE session.');
        } else {
          console.error('Unknown session action. Use: get, set <cookie>, auto <on|off>, save-credentials [username] [password], clear');
        }
        break;
      }

      case 'credentials': {
        const sub = args[1] || 'status';
        if (sub === 'set' || sub === 'save') {
          let username = args[2] || getArg('--user') || process.env.VSUEE_USERNAME;
          let password = args[3] || getArg('--pass') || process.env.VSUEE_PASSWORD;
          if (!username) {
            username = await promptText('VSU eLearning Username/Student ID: ');
          }
          if (!password) {
            password = await promptPassword('VSU eLearning Password (silent input): ');
          }
          if (!username || !password) {
            console.error('Error: Username and password are required.');
            process.exit(1);
          }
          await client.saveCredentials(username, password);
          console.log(`Encrypted credentials saved for user "${username}". Auto-relogin is ENABLED.`);
        } else if (sub === 'status') {
          const hasCreds = Boolean(client.auth?.username && client.auth?.secret);
          console.log(`Saved credentials: ${hasCreds ? `Present for "${client.auth.username}"` : 'None'}`);
          console.log(`Auto-relogin:      ${client.autoRelogin ? 'ENABLED' : 'DISABLED'}`);
        } else if (sub === 'clear' || sub === 'remove') {
          client.auth = null;
          client.autoRelogin = false;
          await client.saveSession();
          console.log('Saved credentials removed.');
        } else {
          console.error('Usage: vsuee credentials set [username] [password] | status | clear');
        }
        break;
      }

      case 'touch':
      case 'keepalive': {
        try {
          const result = await client.touch();
          if (isJson) {
            console.log(JSON.stringify(result, null, 2));
          } else {
            console.log(`\nSession refreshed at ${result.sessionRefreshedAt}. Logged in as ${result.user?.fullname || 'Student'}.\n`);
          }
        } catch (err) {
          if (isJson) {
            console.log(JSON.stringify({ success: false, error: err.message }, null, 2));
          } else {
            console.error(`\nFailed to refresh session: ${err.message}\n`);
          }
          process.exit(1);
        }
        break;
      }

      case 'courses': {
        const all = args.includes('--all') || args.includes('-a');
        const filter = getArg('--filter') || getArg('-f');
        const search = getArg('--search') || getArg('-s');
        const courses = await client.getCourses({ all, filter, search });

        if (isJson) {
          console.log(JSON.stringify(courses, null, 2));
        } else {
          const filterLabel = filter ? ` [filter: ${filter}]` : (all ? ' [all including hidden]' : '');
          console.log(`\n--- Enrolled Courses (${courses.length})${filterLabel} ---`);
          if (courses.length === 0) {
            console.log('No courses found matching criteria.');
          }
          for (const c of courses) {
            const prog = c.hasprogress && c.progress !== null ? ` [${Math.round(c.progress)}% completed]` : '';
            const hiddenBadge = c.hidden ? ' [HIDDEN]' : '';
            const favBadge = c.isFavourite ? ' [STARRED]' : '';
            console.log(`• [ID: ${c.id}] ${c.fullname}${prog}${hiddenBadge}${favBadge}`);
            console.log(`  URL: ${c.viewurl}`);
          }
          console.log('------------------------------------\n');
        }
        break;
      }

      case 'course': {
        const courseId = getArg('--course') || getPositionalArg(1);
        if (!courseId) {
          console.error('Error: Please specify course ID. Example: vsuee course 1234');
          process.exit(1);
        }
        const showAll = args.includes('--all') || args.includes('-a');
        const data = await client.getCourseContents(courseId);
        if (isJson) {
          console.log(JSON.stringify(data, null, 2));
        } else {
          console.log(`\n======================================================`);
          console.log(` Course: ${data.title} (ID: ${data.id})`);
          console.log(` URL:    ${data.url}`);
          console.log(`======================================================\n`);

          for (const sec of data.sections) {
            if (!showAll && sec.activities.length === 0 && sec.number !== 0) continue;
            const hiddenSec = sec.hidden ? ' [HIDDEN FROM STUDENTS]' : '';
            console.log(`\n[Section ${sec.number}: ${sec.name}]${hiddenSec}`);
            if (sec.summary) {
              console.log(`  Summary: ${sec.summary}`);
            }
            if (sec.activities.length === 0) {
              console.log('  (No activities)');
            }
            for (const act of sec.activities) {
              const check = act.completed ? ' [✓]' : ' [ ]';
              const type = `[${act.type.toUpperCase()}]`.padEnd(11);
              const hiddenAct = act.hidden ? ' [HIDDEN]' : '';
              const fileType = act.fileType ? ` (${act.fileType.toUpperCase()})` : '';
              console.log(`  ${check} ${type} ${act.name}${fileType}${hiddenAct} (Mod ID: ${act.id})`);
              if (act.availability) console.log(`      Restriction: ${act.availability}`);
              if (act.description) console.log(`      Note: ${act.description}`);
              if (act.link) console.log(`      Link: ${act.link}`);
            }
          }
          console.log('\n');
        }
        break;
      }

      case 'read':
      case 'page': {
        const pageId = getArg('--id') || getPositionalArg(1);
        if (!pageId) {
          console.error('Error: Please specify page or module ID. Example: vsuee read 107176');
          process.exit(1);
        }
        const page = await client.getPageContent(pageId);
        if (isJson) {
          console.log(JSON.stringify(page, null, 2));
        } else {
          console.log(`\n======================================================`);
          console.log(` ${page.title} (Module ID: ${page.id})`);
          console.log(` URL: ${page.url}`);
          if (page.lastModified) console.log(` Last Modified: ${page.lastModified}`);
          console.log(`======================================================\n`);
          console.log(page.content);
          console.log('\n');
        }
        break;
      }

      case 'url':
      case 'link': {
        const urlId = getArg('--id') || getPositionalArg(1);
        if (!urlId) {
          console.error('Error: Please specify URL module ID. Example: vsuee url 262927');
          process.exit(1);
        }
        const urlDetails = await client.getUrlDetails(urlId);
        if (isJson) {
          console.log(JSON.stringify(urlDetails, null, 2));
        } else {
          console.log(`\n======================================================`);
          console.log(` URL Module: ${urlDetails.title} (ID: ${urlDetails.id})`);
          console.log(` Module URL: ${urlDetails.url}`);
          if (urlDetails.targetUrl) console.log(` Target URL: ${urlDetails.targetUrl}`);
          console.log(`======================================================\n`);
        }
        break;
      }

      case 'quiz': {
        const quizId = getArg('--id') || getPositionalArg(1);
        if (!quizId) {
          console.error('Error: Please specify quiz ID. Example: vsuee quiz 262926');
          process.exit(1);
        }
        const quiz = await client.getQuizDetails(quizId);
        if (isJson) {
          console.log(JSON.stringify(quiz, null, 2));
        } else {
          console.log(`\n======================================================`);
          console.log(` Quiz: ${quiz.title} (ID: ${quiz.id})`);
          console.log(` URL:  ${quiz.url}`);
          if (quiz.opened) console.log(` Opened:           ${quiz.opened}`);
          if (quiz.closed) console.log(` Closes:           ${quiz.closed}`);
          if (quiz.timeLimit) console.log(` Time Limit:       ${quiz.timeLimit}`);
          if (quiz.attemptsAllowed) console.log(` Attempts Allowed: ${quiz.attemptsAllowed}`);
          if (quiz.gradingMethod) console.log(` Grading Method:   ${quiz.gradingMethod}`);
          console.log(`======================================================\n`);
          if (quiz.instructions) {
            console.log(`Instructions / Description:\n${quiz.instructions}\n`);
          }
          if (quiz.attempts && quiz.attempts.length > 0) {
            console.log('Attempts History:');
            for (const row of quiz.attempts) {
              console.log(`  ${row.join(' | ')}`);
            }
            console.log('');
          }
        }
        break;
      }

      case 'forum': {
        const forumId = getArg('--id') || getPositionalArg(1);
        if (!forumId) {
          console.error('Error: Please specify forum ID. Example: vsuee forum 19515');
          process.exit(1);
        }
        const forum = await client.getForumDiscussions(forumId);
        if (isJson) {
          console.log(JSON.stringify(forum, null, 2));
        } else {
          console.log(`\n======================================================`);
          console.log(` Forum: ${forum.title} (ID: ${forum.id})`);
          console.log(` URL:   ${forum.url}`);
          console.log(`======================================================\n`);
          if (forum.intro) console.log(`${forum.intro}\n`);
          if (forum.discussions.length === 0) {
            console.log('No discussion topics or announcements posted yet.');
          } else {
            console.log(`Discussions (${forum.discussions.length}):`);
            for (const d of forum.discussions) {
              console.log(`• ${d.topic}`);
              console.log(`  Author:   ${d.author}`);
              console.log(`  Replies:  ${d.replies}`);
              if (d.lastPost) console.log(`  Last:     ${d.lastPost}`);
              console.log(`  Link:     ${d.link}\n`);
            }
          }
          console.log('');
        }
        break;
      }

      case 'timeline':
      case 'upcoming': {
        const limit = parseInt(getArg('--limit') || '20', 10);
        const events = await client.getTimeline(limit);
        if (isJson) {
          console.log(JSON.stringify(events, null, 2));
        } else {
          console.log(`\n--- Upcoming Timeline & Deadlines (${events.length}) ---`);
          if (events.length === 0) {
            console.log('No upcoming events or deadlines found.');
          }
          for (const ev of events) {
            const overdue = ev.overdue ? ' [OVERDUE!]' : '';
            const rawTime = ev.formattedtime || ev.timestart || 'N/A';
            const cleanTime = String(rawTime).replace(/<[^>]+>/g, '').trim();
            console.log(`• ${ev.name}${overdue}`);
            if (ev.coursename) console.log(`  Course:    ${ev.coursename}`);
            console.log(`  Due/Time:  ${cleanTime}`);
            if (ev.actionurl) console.log(`  Action:    ${ev.actionurl}`);
            console.log('');
          }
          console.log('--------------------------------------------------\n');
        }
        break;
      }

      case 'calendar':
      case 'schedule':
      case 'ical': {
        let courseId = getArg('--course');
        const pos1 = getPositionalArg(1);
        let exportPath = getArg('--export', '-e') || getArg('--out');

        if (pos1 && pos1.toLowerCase().endsWith('.ics')) {
          exportPath = exportPath || pos1;
        } else if (pos1 && pos1.toLowerCase() === 'export') {
          const pos2 = getPositionalArg(2);
          exportPath = exportPath || (pos2 && !pos2.startsWith('-') ? pos2 : path.join(os.homedir(), 'Downloads', 'vsuee_calendar.ics'));
        } else if (!courseId && pos1 && /^\d+$/.test(pos1)) {
          courseId = pos1;
        }

        if (!exportPath && (args.includes('--export') || args.includes('-e'))) {
          exportPath = path.join(os.homedir(), 'Downloads', 'vsuee_calendar.ics');
        }

        const period = getArg('--period') || 'recentupcoming';
        const events = getArg('--events') || 'all';
        const includeAssignments = !args.includes('--no-assignments');

        if (exportPath) {
          console.log(`Exporting calendar schedule to ${exportPath}...`);
          const res = await client.exportCalendarIcs(exportPath, {
            period,
            events,
            courseId,
            includeAssignments,
          });
          if (isJson) {
            console.log(JSON.stringify(res, null, 2));
          } else {
            console.log(`\n======================================================`);
            console.log(` [✔] Calendar Export Succeeded`);
            console.log(` Saved File:   ${res.savedPath}`);
            console.log(` Total Events: ${res.eventCount} deadlines & quizzes`);
            console.log(` File Size:    ${(res.bytes / 1024).toFixed(1)} KB`);
            console.log(` Source:       ${res.fetchedFromMoodle ? 'Moodle iCal Export + Synthesized Schedule' : 'VSUEE Synthesized Schedule'}`);
            console.log(`======================================================\n`);
            console.log(`How to import into your calendar:`);
            console.log(` • Apple Calendar: Double-click "${res.savedPath}" or run:`);
            console.log(`   open "${res.savedPath}"`);
            console.log(` • Google Calendar: Open calendar.google.com -> Settings -> Import & Export -> Select file\n`);
          }
          break;
        }

        const limit = parseInt(getArg('--limit') || '30', 10);
        const timeline = await client.getTimeline(limit).catch(() => []);
        let filtered = timeline;
        if (courseId) {
          filtered = filtered.filter(e => String(e.courseid) === String(courseId));
        }

        let pendingAssigns = [];
        if (includeAssignments) {
          try {
            const allAssigns = await client.getAssignments(courseId);
            pendingAssigns = allAssigns.filter(a =>
              a.duedate && a.duedate !== '-' && !a.duedate.toLowerCase().includes('no due')
            );
          } catch {}
        }

        if (isJson) {
          console.log(JSON.stringify({ timeline: filtered, assignments: pendingAssigns }, null, 2));
        } else {
          console.log(`\n--- VSU eLearning Calendar & Deadlines ---`);
          if (filtered.length === 0 && pendingAssigns.length === 0) {
            console.log('No upcoming calendar events or assignment deadlines found.');
          } else {
            if (filtered.length > 0) {
              console.log(`\n[Timeline Quizzes & Activities] (${filtered.length}):`);
              for (const ev of filtered) {
                const overdueTag = ev.overdue ? ' [OVERDUE!]' : '';
                const rawTime = ev.formattedtime || ev.timestart || 'N/A';
                const cleanTime = String(rawTime).replace(/<[^>]+>/g, '').trim();
                console.log(`• ${ev.name}${overdueTag}`);
                if (ev.coursename) console.log(`  Course:    ${ev.coursename}`);
                console.log(`  Date/Time: ${cleanTime}`);
                if (ev.actionurl) console.log(`  Action:    ${ev.actionurl}`);
                console.log('');
              }
            }
            if (pendingAssigns.length > 0) {
              console.log(`[Course Assignment Deadlines] (${pendingAssigns.length}):`);
              for (const a of pendingAssigns) {
                const isSub = a.submissionStatus && a.submissionStatus.toLowerCase().includes('submitted');
                const badge = isSub ? '[SUBMITTED]' : '[PENDING]';
                console.log(`• ${badge} ${a.name} (ID: ${a.id})`);
                if (a.coursename) console.log(`  Course:    ${a.coursename}`);
                console.log(`  Due Date:  ${a.duedate}`);
                console.log(`  Status:    ${a.submissionStatus} | Grade: ${a.grade}`);
                console.log(`  Action:    ${a.link}`);
                console.log('');
              }
            }
          }
          console.log('--------------------------------------------------');
          console.log('💡 Tip: Export to Apple Calendar or Google Calendar:');
          console.log('   vsuee calendar --export ~/Downloads/vsuee_deadlines.ics\n');
        }
        break;
      }

      case 'assignments': {
        const courseId = getArg('--course');
        const pendingOnly = args.includes('--pending');
        let assigns = await client.getAssignments(courseId);

        if (pendingOnly) {
          assigns = assigns.filter(a =>
            !a.submissionStatus.toLowerCase().includes('submitted') &&
            !a.submissionStatus.toLowerCase().includes('graded')
          );
        }

        if (isJson) {
          console.log(JSON.stringify(assigns, null, 2));
        } else {
          console.log(`\n--- Assignments (${assigns.length}${pendingOnly ? ' pending' : ''}) ---`);
          for (const a of assigns) {
            console.log(`• [ID: ${a.id}] ${a.name}`);
            if (a.coursename) console.log(`  Course:   ${a.coursename}`);
            console.log(`  Due Date: ${a.duedate}`);
            console.log(`  Status:   ${a.submissionStatus} | Grade: ${a.grade}`);
            console.log(`  Link:     ${a.link}\n`);
          }
          console.log('----------------------------------\n');
        }
        break;
      }

      case 'assign': {
        const assignId = getArg('--id') || getPositionalArg(1);
        if (!assignId) {
          console.error('Error: Please specify assignment ID. Example: vsuee assign 5678');
          process.exit(1);
        }

        const downloadRubric = args.includes('--download-rubric') || args.includes('--rubric');
        const downloadSub = args.includes('--download-submission') || args.includes('--files');
        const dest = getArg('--dest');
        const concurrency = parseInt(getArg('--concurrency', '-c') || '4', 10);

        if (downloadRubric) {
          console.log(`Downloading attached rubric files for assignment ${assignId}...`);
          let progress = null;
          const rubricRes = await client.downloadAssignmentRubrics(assignId, dest, {
            concurrency,
            onStart: (ev) => {
              if (!progress && !isJson && !args.includes('--quiet') && !args.includes('-q')) {
                progress = new ProgressIndicator(ev.total, { label: 'Rubric', quiet: args.includes('--quiet') || args.includes('-q'), json: isJson });
              }
              if (progress) progress.onStart(ev);
            },
            onProgress: (ev) => {
              if (progress) progress.onProgress(ev);
            },
          });
          if (progress) progress.finish();
          if (isJson) {
            console.log(JSON.stringify(rubricRes, null, 2));
          } else if (rubricRes.downloadedFiles.length === 0 && !rubricRes.rubricMarkdownPath) {
            console.log(`\n[i] No rubric attachments or grading criteria found for assignment ${assignId}.\n`);
          } else {
            console.log(`\n======================================================`);
            console.log(` [✔] Rubric Files & Criteria Saved`);
            console.log(` Saved to:  ${rubricRes.destination}`);
            console.log(` Files:     ${rubricRes.downloadedFiles.length} file(s)`);
            for (const f of rubricRes.downloadedFiles) {
              console.log(`  - ${f.name} (${f.savedPath || f.path})`);
            }
            if (rubricRes.rubricMarkdownPath) {
              console.log(`  - Rubric Criteria Document: ${rubricRes.rubricMarkdownPath}`);
            }
            console.log(`======================================================\n`);
          }
          break;
        }

        if (downloadSub) {
          console.log(`Downloading student submitted files for assignment ${assignId}...`);
          let progress = null;
          const subRes = await client.downloadSubmissionFiles(assignId, dest, {
            concurrency,
            onStart: (ev) => {
              if (!progress && !isJson && !args.includes('--quiet') && !args.includes('-q')) {
                progress = new ProgressIndicator(ev.total, { label: 'Submission', quiet: args.includes('--quiet') || args.includes('-q'), json: isJson });
              }
              if (progress) progress.onStart(ev);
            },
            onProgress: (ev) => {
              if (progress) progress.onProgress(ev);
            },
          });
          if (progress) progress.finish();
          if (isJson) {
            console.log(JSON.stringify(subRes, null, 2));
          } else if (subRes.count === 0 && subRes.files.length === 0) {
            console.log(`\n[i] No student submitted files found for assignment ${assignId}.\n`);
          } else {
            console.log(`\n======================================================`);
            console.log(` [✔] Submitted Files Downloaded: ${subRes.count} file(s)`);
            console.log(` Saved to:  ${subRes.destination}`);
            for (const f of subRes.files) {
              console.log(`  - ${f.name} (${f.savedPath || f.path})`);
            }
            console.log(`======================================================\n`);
          }
          break;
        }

        const details = await client.getAssignmentDetails(assignId);
        if (isJson) {
          console.log(JSON.stringify(details, null, 2));
        } else {
          console.log(`\n======================================================`);
          console.log(` Assignment: ${details.title} (ID: ${details.id})`);
          if (details.course) console.log(` Course:     ${details.course}`);
          console.log(` URL:        ${details.url}`);
          console.log(` Due Date:   ${details.dueDate} (${details.timeRemaining})`);
          console.log(` Status:     ${details.status} | ${details.gradingStatus}`);
          if (details.grade) console.log(` Grade:      ${details.grade}`);
          if (details.gradedBy) console.log(` Graded by:  ${details.gradedBy}`);
          if (details.gradedOn) console.log(` Graded on:  ${details.gradedOn}`);
          if (details.group) console.log(` Group:      ${details.group}`);
          console.log(`======================================================\n`);
          if (details.description) {
            console.log(`Instructions / Description:\n${details.description}\n`);
          }
          if (details.submittedFiles && details.submittedFiles.length > 0) {
            console.log(`Submitted Files (${details.submittedFiles.length}):`);
            for (const f of details.submittedFiles) {
              console.log(`  - ${f.name}${f.uploadedAt ? ` (Uploaded: ${f.uploadedAt})` : ''}`);
              console.log(`    URL: ${f.url}`);
            }
            console.log('');
          } else if (details.fileSubmissions) {
            console.log(`Submitted Files: ${details.fileSubmissions}\n`);
          }
          if (details.onlineText) {
            console.log(`Online Text Submission:\n${details.onlineText}\n`);
          }
          if (details.lastModified) {
            console.log(`Last Modified:   ${details.lastModified}`);
          }
          if (details.rubric && details.rubric.criteria) {
            console.log(`Grading Rubric Criteria (${details.rubric.criteria.length} criteria):`);
            for (const c of details.rubric.criteria) {
              console.log(`  • ${c.description}`);
              if (c.remark) console.log(`    Feedback: ${c.remark}`);
              for (const l of c.levels) {
                const mark = l.checked ? '✔ [SELECTED]' : ' ';
                console.log(`    [${mark}] ${l.score} pts: ${l.definition}`);
              }
            }
            console.log('');
          }
          if (details.submissionComments) {
            console.log(`Comments:        ${details.submissionComments}`);
          }
          if (details.rubricAttachments && details.rubricAttachments.length > 0) {
            console.log(`Attached Rubrics & Guidelines (${details.rubricAttachments.length}):`);
            for (const att of details.rubricAttachments) {
              console.log(`  - ${att.name}: ${att.url}`);
            }
            console.log('');
          }
          if (details.attachments && details.attachments.length > 0) {
            const generalAtts = details.attachments.filter(a => !details.rubricAttachments.includes(a));
            if (generalAtts.length > 0) {
              console.log(`Instructor Attachments (${generalAtts.length}):`);
              for (const att of generalAtts) {
                console.log(`  - ${att.name}: ${att.url}`);
              }
              console.log('');
            }
          }
          if (details.feedbackFiles && details.feedbackFiles.length > 0) {
            console.log(`Feedback Files (${details.feedbackFiles.length}):`);
            for (const fb of details.feedbackFiles) {
              console.log(`  - ${fb.name}: ${fb.url}`);
            }
            console.log('');
          }
          if (details.feedbackComments) {
            console.log(`Teacher Feedback Comments:\n${details.feedbackComments}\n`);
          }
          console.log(`Quick Actions:`);
          console.log(`  Download Rubric:     vsuee assign ${details.id} --download-rubric`);
          if (details.submittedFiles && details.submittedFiles.length > 0) {
            console.log(`  Download Submission: vsuee assign ${details.id} --download-submission`);
          }
          console.log('');
        }
        break;
      }

      case 'submission':
      case 'submissions': {
        const isMulti = command === 'submissions';
        const courseId = getArg('--course') || (isMulti ? getPositionalArg(1) : null);
        const assignId = isMulti ? (getArg('--id') || getArg('--assign')) : (getArg('--id') || getArg('--assign') || getPositionalArg(1));
        const downloadRubric = args.includes('--download-rubric') || args.includes('--rubric');
        const downloadSub = args.includes('--download-submission') || args.includes('--files');
        const dest = getArg('--dest');
        const concurrency = parseInt(getArg('--concurrency', '-c') || '4', 10);

        // If submissions command or no assignId, show course/all submissions
        if (isMulti || !assignId) {
          const targetCourse = courseId;
          if (!targetCourse) {
            console.log('Fetching assignment submissions across enrolled courses...');
          } else {
            console.log(`Fetching submissions for course ${targetCourse}...`);
          }

          let progress = null;
          const report = await client.getCourseSubmissions(targetCourse, {
            concurrency,
            onStart: (ev) => {
              if (!progress && !isJson && !args.includes('--quiet') && !args.includes('-q')) {
                progress = new ProgressIndicator(ev.total, { label: 'Submissions', quiet: args.includes('--quiet') || args.includes('-q'), json: isJson });
              }
              if (progress) progress.onStart(ev);
            },
            onProgress: (ev) => {
              if (progress) progress.onProgress(ev);
            },
          });
          if (progress) progress.finish();

          if (isJson) {
            console.log(JSON.stringify(report, null, 2));
          } else {
            console.log(`\n--- Assignment Submissions Report ---`);
            console.log(` Total:     ${report.total}`);
            console.log(` Submitted: ${report.submitted}`);
            console.log(` Graded:    ${report.graded}`);
            if (report.overdue > 0) {
              console.log(` Overdue:   ${report.overdue} [!]`);
            }
            console.log('-------------------------------------\n');

            for (const sub of report.submissions) {
              const subBadge = sub.isSubmitted ? '[SUBMITTED]' : (sub.isOverdue ? '[OVERDUE]' : '[PENDING]');
              const gradeBadge = sub.isGraded ? `[GRADE: ${sub.grade || 'Graded'}]` : `[${sub.gradingStatus}]`;
              console.log(`• ${subBadge} ${gradeBadge} ${sub.name} (ID: ${sub.id})`);
              if (sub.course) console.log(`  Course:    ${sub.course}`);
              console.log(`  Due Date:  ${sub.dueDate} (${sub.timeRemaining})`);
              if (sub.submittedFileCount > 0) console.log(`  Files:     ${sub.submittedFileCount} submitted file(s)`);
              if (sub.hasOnlineText) console.log(`  Online:    Online text submitted`);
              if (sub.feedbackComments) console.log(`  Feedback:  ${sub.feedbackComments.slice(0, 80)}`);
              if (sub.rubricCount > 0) console.log(`  Rubrics:   ${sub.rubricCount} rubric/prompt attachment(s)`);
              console.log(`  Inspect:   vsuee submission ${sub.id}\n`);
            }
          }
          break;
        }

        // Single assignment inspection
        console.log(`Inspecting submission status for assignment ${assignId}...`);
        const details = await client.getSubmissionStatus(assignId);

        if (downloadRubric) {
          console.log(`Downloading attached rubric files for "${details.title}"...`);
          let progress = null;
          const rubricRes = await client.downloadAssignmentRubrics(assignId, dest, {
            concurrency,
            onStart: (ev) => {
              if (!progress && !isJson && !args.includes('--quiet') && !args.includes('-q')) {
                progress = new ProgressIndicator(ev.total, { label: 'Rubric', quiet: args.includes('--quiet') || args.includes('-q'), json: isJson });
              }
              if (progress) progress.onStart(ev);
            },
            onProgress: (ev) => {
              if (progress) progress.onProgress(ev);
            },
          });
          if (progress) progress.finish();

          if (isJson) {
            console.log(JSON.stringify(rubricRes, null, 2));
          } else if (rubricRes.downloadedFiles.length === 0 && !rubricRes.rubricMarkdownPath) {
            console.log(`\n[i] No rubric attachments or grading criteria found for assignment ${assignId}.\n`);
          } else {
            console.log(`\n======================================================`);
            console.log(` [✔] Rubric Files & Criteria Saved`);
            console.log(` Saved to:  ${rubricRes.destination}`);
            console.log(` Files:     ${rubricRes.downloadedFiles.length} file(s)`);
            for (const f of rubricRes.downloadedFiles) {
              console.log(`  - ${f.name} (${f.savedPath || f.path})`);
            }
            if (rubricRes.rubricMarkdownPath) {
              console.log(`  - Rubric Criteria Document: ${rubricRes.rubricMarkdownPath}`);
            }
            console.log(`======================================================\n`);
          }
          break;
        }

        if (downloadSub) {
          console.log(`Downloading student submission files for "${details.title}"...`);
          let progress = null;
          const subRes = await client.downloadSubmissionFiles(assignId, dest, {
            concurrency,
            onStart: (ev) => {
              if (!progress && !isJson && !args.includes('--quiet') && !args.includes('-q')) {
                progress = new ProgressIndicator(ev.total, { label: 'Submission', quiet: args.includes('--quiet') || args.includes('-q'), json: isJson });
              }
              if (progress) progress.onStart(ev);
            },
            onProgress: (ev) => {
              if (progress) progress.onProgress(ev);
            },
          });
          if (progress) progress.finish();

          if (isJson) {
            console.log(JSON.stringify(subRes, null, 2));
          } else if (subRes.count === 0 && subRes.files.length === 0) {
            console.log(`\n[i] No student submitted files found for assignment ${assignId}.\n`);
          } else {
            console.log(`\n======================================================`);
            console.log(` [✔] Submitted Files Downloaded: ${subRes.count} file(s)`);
            console.log(` Saved to:  ${subRes.destination}`);
            for (const f of subRes.files) {
              console.log(`  - ${f.name} (${f.savedPath || f.path})`);
            }
            console.log(`======================================================\n`);
          }
          break;
        }

        if (isJson) {
          console.log(JSON.stringify(details, null, 2));
        } else {
          const statusBadge = details.isSubmitted ? '✔ SUBMITTED' : (details.isOverdue ? '✖ OVERDUE' : '⏳ PENDING');
          const gradeBadge = details.isGraded ? `✔ GRADED (${details.grade})` : `⏳ NOT GRADED`;

          console.log(`\n======================================================`);
          console.log(` Assignment: ${details.title} (ID: ${details.id})`);
          if (details.course) console.log(` Course:     ${details.course}`);
          console.log(` URL:        ${details.url}`);
          console.log(` Status:     [${statusBadge}] | [${gradeBadge}]`);
          console.log(` Due Date:   ${details.dueDate} (${details.timeRemaining})`);
          if (details.lastModified) console.log(` Modified:   ${details.lastModified}`);
          if (details.gradedBy)     console.log(` Graded by:  ${details.gradedBy} (${details.gradedOn || 'N/A'})`);
          if (details.group)        console.log(` Group:      ${details.group}`);
          console.log(`======================================================\n`);

          if (details.description) {
            console.log(`Instructions / Description:\n${details.description}\n`);
          }

          if (details.submittedFiles && details.submittedFiles.length > 0) {
            console.log(`Submitted Files (${details.submittedFiles.length}):`);
            for (const f of details.submittedFiles) {
              console.log(`  - ${f.name}${f.uploadedAt ? ` (Uploaded: ${f.uploadedAt})` : ''}`);
              console.log(`    URL: ${f.url}`);
            }
            console.log('');
          } else if (details.fileSubmissions) {
            console.log(`Submitted Files: ${details.fileSubmissions}\n`);
          }

          if (details.onlineText) {
            console.log(`Online Text Submission:\n${details.onlineText}\n`);
          }

          if (details.rubric && details.rubric.criteria) {
            console.log(`Grading Rubric Criteria (${details.rubric.criteria.length} criteria):`);
            for (const c of details.rubric.criteria) {
              console.log(`  • ${c.description}`);
              if (c.remark) console.log(`    Feedback: ${c.remark}`);
              for (const l of c.levels) {
                const mark = l.checked ? '✔ [SELECTED]' : ' ';
                console.log(`    [${mark}] ${l.score} pts: ${l.definition}`);
              }
            }
            console.log('');
          }

          if (details.rubricAttachments && details.rubricAttachments.length > 0) {
            console.log(`Attached Rubrics & Guidelines (${details.rubricAttachments.length}):`);
            for (const att of details.rubricAttachments) {
              console.log(`  - ${att.name}: ${att.url}`);
            }
            console.log('');
          }

          if (details.attachments && details.attachments.length > 0) {
            const generalAtts = details.attachments.filter(a => !details.rubricAttachments.includes(a));
            if (generalAtts.length > 0) {
              console.log(`Instructor Prompt Attachments (${generalAtts.length}):`);
              for (const att of generalAtts) {
                console.log(`  - ${att.name}: ${att.url}`);
              }
              console.log('');
            }
          }

          if (details.feedbackFiles && details.feedbackFiles.length > 0) {
            console.log(`Feedback Files (${details.feedbackFiles.length}):`);
            for (const fb of details.feedbackFiles) {
              console.log(`  - ${fb.name}: ${fb.url}`);
            }
            console.log('');
          }

          if (details.feedbackComments) {
            console.log(`Teacher Feedback Comments:\n${details.feedbackComments}\n`);
          }

          if (details.submissionComments) {
            console.log(`Submission Comments:\n${details.submissionComments}\n`);
          }

          console.log(`Quick Actions:`);
          console.log(`  Download Rubric:     vsuee submission ${details.id} --download-rubric`);
          if (details.submittedFiles.length > 0) {
            console.log(`  Download Submission: vsuee submission ${details.id} --download-submission`);
          }
          console.log('');
        }
        break;
      }

      case 'grades': {
        const courseId = getArg('--course') || getPositionalArg(1);
        const report = await client.getGrades(courseId);
        if (isJson) {
          console.log(JSON.stringify(report, null, 2));
        } else {
          console.log(`\n--- Grades Report (${report.courseId ? 'Course ' + report.courseId : 'Overview'}) ---`);
          for (const row of report.table) {
            console.log(row.join(' | '));
          }
          console.log('----------------------------------------------------\n');
        }
        break;
      }

      case 'file':
      case 'get-file':
      case 'download-file': {
        let target = getPositionalArg(1);
        const subTarget = getPositionalArg(2);
        if (target && subTarget && ['mod', 'module', 'resource', 'folder', 'file', 'assign', 'assignment', 'page'].includes(target.toLowerCase())) {
          target = `${target} ${subTarget}`;
        } else if (!target) {
          target = getArg('--mod') || getArg('--module') || getArg('--id') || getArg('--file');
        }

        if (!target) {
          console.error('Error: Please specify module ID or URL. Example: vsuee file 229320, vsuee file assign 248286');
          process.exit(1);
        }
        const dest = getArg('--dest') || undefined;
        const force = args.includes('--force');
        const type = getArg('--type') || undefined;
        console.log(`Downloading file/module from ${target}...`);
        const result = await client.downloadModule(target, dest, { force, typeFilter: type });
        if (isJson) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(`\nDownload completed: ${result.name || result.title || target}`);
          console.log(`Saved to:     ${result.savedPath || result.destination}`);
          if (result.size) console.log(`Size:         ${(result.size / 1024).toFixed(1)} KB`);
          if (result.skipped) console.log(`Status:       Skipped (identical file exists, use --force to overwrite)`);
          if (result.files && result.files.length > 0) {
            console.log(`Downloaded:   ${result.downloadCount} file(s)`);
            for (const f of result.files) {
              console.log(`  - ${f.name} (${f.path})`);
            }
          }
          console.log('');
        }
        break;
      }

      case 'download': {
        const modId = getArg('--mod') || getArg('--module');
        const courseId = getArg('--course') || (!modId ? getPositionalArg(1) : null);
        const dest = getArg('--dest') || undefined;
        const force = args.includes('--force');
        const type = getArg('--type') || undefined;
        const section = getArg('--section') || undefined;
        const includeAssign = args.includes('--include-assign');

        if (modId) {
          console.log(`Downloading module ${modId}...`);
          const result = await client.downloadModule(modId, dest, { force, typeFilter: type });
          if (isJson) {
            console.log(JSON.stringify(result, null, 2));
          } else {
            console.log(`\nDownload completed: ${result.name || result.title || modId}`);
            console.log(`Saved to:     ${result.savedPath || result.destination}`);
            if (result.size) console.log(`Size:         ${(result.size / 1024).toFixed(1)} KB`);
            if (result.skipped) console.log(`Status:       Skipped (identical file exists, use --force to overwrite)`);
            if (result.files && result.files.length > 0) {
              console.log(`Downloaded:   ${result.downloadCount} file(s)`);
              for (const f of result.files) {
                console.log(`  - ${f.name} (${f.path})`);
              }
            }
            console.log('');
          }
          break;
        }

        if (!courseId) {
          console.error('Error: Please specify course ID or --mod <id>. Example: vsuee download 1234, vsuee download --mod 5678');
          process.exit(1);
        }

        const concurrency = parseInt(getArg('--concurrency', '-c') || '4', 10);
        console.log(`Fetching course materials for course ${courseId}${section ? ` (section: ${section})` : ''} [parallel streams: ${concurrency}]...`);
        let progress = null;
        const result = await client.downloadCourseMaterials(courseId, dest, {
          force,
          typeFilter: type,
          section,
          includeAssignments: includeAssign,
          concurrency,
          onStart: (ev) => {
            if (!progress && !isJson && !args.includes('--quiet') && !args.includes('-q')) {
              progress = new ProgressIndicator(ev.total, { label: 'Downloading', quiet: args.includes('--quiet') || args.includes('-q'), json: isJson });
            }
            if (progress) progress.onStart(ev);
          },
          onProgress: (ev) => {
            if (progress) progress.onProgress(ev);
          },
        });
        if (progress) progress.finish();
        if (isJson) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(`\nDownload completed for "${result.course}"`);
          console.log(`Saved to:     ${result.destination}`);
          console.log(`Downloaded:   ${result.downloadCount} files`);
          if (result.skippedCount > 0) {
            console.log(`Skipped:      ${result.skippedCount} identical files (use --force to overwrite)`);
          }
          if (result.errors.length > 0) {
            console.log(`Failed items: ${result.errors.length}`);
            for (const err of result.errors) {
              console.log(`  - ${err.module}: ${err.error}`);
            }
          }
          console.log('');
        }
        break;
      }

      case 'sync': {
        const sm = new SyncManager();
        const all = args.includes('--all') || args.includes('-a');
        const courseId = getArg('--course') || getPositionalArg(1);
        const downloadNew = args.includes('--download-new');
        const dest = getArg('--dest') || undefined;
        const force = args.includes('--force');
        const quiet = args.includes('--quiet') || args.includes('-q');

        if (!quiet && !isJson) {
          console.log(`Synchronizing VSUEE course data (${all ? 'all including hidden' : 'active ongoing courses'})...`);
        }

        const oldSnapshot = await sm.getLatestSnapshot();
        const newSnapshot = await sm.buildSnapshot({
          client,
          classification: 'all',
          includeHidden: all,
          courseId,
          onProgress: (p) => {
            if (!quiet && !isJson && p.phase === 'course_contents') {
              process.stdout.write(`\r[Syncing] Course ${p.current}/${p.total}: ${(p.course || '').slice(0, 35).padEnd(35)}`);
            }
          },
        });

        if (!quiet && !isJson) {
          process.stdout.write('\r'.padEnd(60) + '\r');
        }

        const diffResult = sm.diffSnapshots(oldSnapshot, newSnapshot, { courseId });

        // Save new snapshot if changes or initial or force
        if (diffResult.hasChanges || diffResult.isInitial || force) {
          await sm.saveSnapshot(newSnapshot);
        }

        // Auto-download new materials if requested
        let downloadSummary = null;
        if (downloadNew && diffResult.hasChanges) {
          downloadSummary = await sm.autoDownloadNewMaterials(client, diffResult, dest);
        }

        if (isJson) {
          console.log(JSON.stringify({ ...diffResult, autoDownload: downloadSummary }, null, 2));
        } else {
          console.log(sm.formatDiffReport(diffResult, { context: 'sync' }));
          if (downloadSummary && downloadSummary.downloaded > 0) {
            console.log(`📥 Auto-downloaded ${downloadSummary.downloaded} new file(s) to ${dest || '~/Downloads/VSUEE'}:`);
            for (const f of downloadSummary.files) {
              if (!f.error && !f.skipped) {
                console.log(`   - ${f.module} (${f.course})`);
              }
            }
            console.log('');
          }
        }
        break;
      }

      case 'diff': {
        const sm = new SyncManager();
        const live = args.includes('--live');
        const all = args.includes('--all') || args.includes('-a');
        const courseId = getArg('--course') || getPositionalArg(1);

        let oldSnapshot;
        let newSnapshot;

        if (live) {
          oldSnapshot = await sm.getLatestSnapshot();
          if (!isJson) console.log('Fetching live course state for comparison...');
          newSnapshot = await sm.buildSnapshot({ client, courseId, includeHidden: all });
        } else {
          oldSnapshot = await sm.getPreviousSnapshot();
          newSnapshot = await sm.getLatestSnapshot();
          if (!newSnapshot) {
            throw new Error('No local snapshot found. Run `vsuee sync` first to establish a baseline.');
          }
        }

        const diffResult = sm.diffSnapshots(oldSnapshot, newSnapshot, { courseId });

        if (isJson) {
          console.log(JSON.stringify(diffResult, null, 2));
        } else {
          console.log(sm.formatDiffReport(diffResult, { context: 'diff' }));
        }
        break;
      }

      case 'watch':
      case 'monitor': {
        const sm = new SyncManager();
        const intervalMins = parseFloat(getArg('--interval') || '15');
        const intervalMs = Math.max(1, intervalMins) * 60 * 1000;
        const all = args.includes('--all') || args.includes('-a');
        const courseId = getArg('--course') || getPositionalArg(1);
        const downloadNew = args.includes('--download-new');
        const notify = !args.includes('--no-notify') && (args.includes('--notify') || process.platform === 'darwin');
        const dest = getArg('--dest') || undefined;
        const once = args.includes('--once');

        console.log('\n======================================================');
        console.log(` VSUEE Course Watcher — Monitoring for Changes`);
        console.log(` Interval:              Every ${intervalMins} minute(s)`);
        console.log(` Auto-download:         ${downloadNew ? 'ENABLED' : 'DISABLED'}`);
        console.log(` Desktop Notifications: ${notify ? 'ENABLED' : 'DISABLED'}`);
        console.log(` Target:                ${courseId ? 'Course ' + courseId : (all ? 'All courses (including hidden)' : 'Active courses')}`);
        console.log(' Press Ctrl-C to stop.');
        console.log('======================================================\n');

        let running = true;
        process.on('SIGINT', () => {
          console.log('\n\nVSUEE Watcher stopped by user. Exiting.\n');
          process.exit(0);
        });

        const runCheck = async () => {
          const nowStr = new Date().toLocaleTimeString();
          try {
            await client.ensureAuthenticated();
            const oldSnapshot = await sm.getLatestSnapshot();
            const newSnapshot = await sm.buildSnapshot({ client, includeHidden: all, courseId });
            const diffResult = sm.diffSnapshots(oldSnapshot, newSnapshot, { courseId });

            if (diffResult.hasChanges) {
              console.log(`\n[ALERT ${nowStr}] Change detected in course contents!`);
              console.log(sm.formatDiffReport(diffResult, { context: 'watch' }));

              if (notify) {
                sm.notifySystem('VSUEE Course Update', `${diffResult.totalChangeCount} new update(s) detected in your courses!`);
              }

              if (downloadNew) {
                const dl = await sm.autoDownloadNewMaterials(client, diffResult, dest);
                if (dl.downloaded > 0) {
                  console.log(`📥 Auto-downloaded ${dl.downloaded} new file(s).\n`);
                }
              }

              await sm.saveSnapshot(newSnapshot);
            } else if (diffResult.isInitial) {
              console.log(`[${nowStr}] Initial baseline snapshot saved (${newSnapshot.courseCount} courses, ${newSnapshot.totalModules} modules).`);
              await sm.saveSnapshot(newSnapshot);
            } else {
              console.log(`[${nowStr}] Checked ${newSnapshot.courseCount} courses (${newSnapshot.totalModules} modules). No new updates. Next check in ${intervalMins}m.`);
            }
          } catch (err) {
            console.error(`[${nowStr}] Check warning (${err.message}). Retrying in ${intervalMins}m...`);
          }
        };

        await runCheck();
        if (once) break;

        while (running) {
          await new Promise(r => setTimeout(r, intervalMs));
          await runCheck();
        }
        break;
      }

      case 'export': {
        const courseId = getArg('--course') || getPositionalArg(1);
        const outFile = getArg('--out') || getArg('--dest') || getArg('--file') || getArg('-o');
        const all = args.includes('--all') || args.includes('-a');

        let md = '';
        if (courseId) {
          const c = await client.getCourseContents(courseId);
          md += `# ${c.title} (ID: ${c.id})\n\n`;
          md += `Portal Link: [${c.title}](${c.url})\n\n`;

          try {
            const assigns = await client.getAssignments(courseId);
            if (assigns && assigns.length > 0) {
              md += `## Assignments & Deadlines (${assigns.length})\n\n`;
              md += `| ID | Assignment | Due Date | Status | Grade | Link |\n`;
              md += `|---|---|---|---|---|---|\n`;
              for (const a of assigns) {
                const link = a.link ? `[View Assignment](${a.link})` : 'N/A';
                md += `| ${a.id} | ${(a.name || 'Untitled').replace(/\|/g, '-')} | ${a.duedate || 'No due date'} | ${a.submissionStatus || 'Pending'} | ${a.grade || 'No grade'} | ${link} |\n`;
              }
              md += '\n';
            }
          } catch {
            // continue if assignments unavailable
          }

          for (const s of c.sections) {
            md += `## Section ${s.number}: ${s.name}${s.hidden ? ' *(Hidden)*' : ''}\n\n`;
            if (s.summary) md += `> ${s.summary}\n\n`;
            if (s.activities.length === 0) {
              md += `*(No activities)*\n\n`;
            }
            for (const a of s.activities) {
              const check = a.completed ? 'x' : ' ';
              const type = a.fileType ? `${a.type.toUpperCase()}:${a.fileType.toUpperCase()}` : a.type.toUpperCase();
              const link = a.link ? `([Link](${a.link}))` : '';
              md += `- [${check}] **[${type}]** ${a.name} ${link}\n`;
              if (a.description) md += `  - *Note:* ${a.description}\n`;
              if (a.availability) md += `  - *Restriction:* ${a.availability}\n`;
            }
            md += '\n';
          }
        } else {
          const courses = await client.getCourses({ all });
          md += `# Enrolled Courses Catalog (${courses.length} courses)\n\n`;

          try {
            const assigns = await client.getAssignments();
            if (assigns && assigns.length > 0) {
              md += `## Upcoming Deadlines & Action Items (${assigns.length})\n\n`;
              md += `| Course | Assignment | Due Date | Status | Grade | Link |\n`;
              md += `|---|---|---|---|---|---|\n`;
              for (const a of assigns) {
                const cName = a.coursename || (a.courseid ? `Course ${a.courseid}` : 'General');
                const link = a.link ? `[View Assignment](${a.link})` : 'N/A';
                md += `| ${cName.replace(/\|/g, '-')} | ${(a.name || 'Untitled').replace(/\|/g, '-')} | ${a.duedate || 'No due date'} | ${a.submissionStatus || 'Pending'} | ${a.grade || 'No grade'} | ${link} |\n`;
              }
              md += '\n';
            }
          } catch {
            // continue if assignments unavailable
          }

          for (const c of courses) {
            const prog = c.hasprogress && c.progress !== null ? ` — Progress: ${Math.round(c.progress)}%` : '';
            md += `### [${c.fullname}](${c.viewurl})${prog}\n`;
            md += `- **ID:** ${c.id}\n`;
            if (c.shortname) md += `- **Code:** ${c.shortname}\n`;
            if (c.hidden) md += `- **Status:** Hidden from view\n`;
            md += '\n';
          }
        }

        if (outFile) {
          const resolvedOut = path.resolve(process.cwd(), expandHome(outFile));
          await fs.writeFile(resolvedOut, md, 'utf8');
          console.log(`Exported markdown to: ${resolvedOut}`);
        } else {
          console.log(md);
        }
        break;
      }

      case 'daemon': {
        const subAction = (getPositionalArg(1) || 'status').toLowerCase();
        if (process.platform !== 'darwin') {
          console.error('\n[VSUEE Daemon] The daemon command manages macOS LaunchAgents via launchd.');
          console.error('On Linux, you can schedule background syncs using cron or systemd:');
          console.error('  crontab -e:');
          console.error('  */15 * * * * vsuee sync --download-new --notify >/dev/null 2>&1\n');
          process.exit(1);
        }

        const plistLabel = 'edu.vsu.vsuee-watcher';
        const plistDir = path.join(os.homedir(), 'Library', 'LaunchAgents');
        const plistPath = path.join(plistDir, `${plistLabel}.plist`);
        const logDir = path.join(os.homedir(), '.config', 'vsuee', 'logs');
        const stdoutPath = path.join(logDir, 'daemon.stdout.log');
        const stderrPath = path.join(logDir, 'daemon.stderr.log');

        switch (subAction) {
          case 'install': {
            await fs.mkdir(plistDir, { recursive: true });
            await fs.mkdir(logDir, { recursive: true });

            const intervalMins = parseFloat(getArg('--interval') || '15');
            const intervalSec = Math.max(60, Math.round(intervalMins * 60));
            const nodeBin = process.execPath;
            const scriptPath = path.resolve(process.argv[1]);
            const all = args.includes('--all') || args.includes('-a');
            const downloadNew = args.includes('--download-new');
            const dest = getArg('--dest');
            const course = getArg('--course');

            const progArgs = [nodeBin, scriptPath, 'sync', '--notify'];
            if (all) progArgs.push('--all');
            if (downloadNew) progArgs.push('--download-new');
            if (dest) progArgs.push('--dest', expandHome(dest));
            if (course) progArgs.push('--course', course);

            const progArgsXml = progArgs.map(arg => `        <string>${arg}</string>`).join('\n');

            const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${plistLabel}</string>
    <key>ProgramArguments</key>
    <array>
${progArgsXml}
    </array>
    <key>StartInterval</key>
    <integer>${intervalSec}</integer>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${stdoutPath}</string>
    <key>StandardErrorPath</key>
    <string>${stderrPath}</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>${process.env.PATH || '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin'}</string>
        <key>HOME</key>
        <string>${os.homedir()}</string>
    </dict>
</dict>
</plist>
`;

            try {
              await execFileAsync('launchctl', ['unload', plistPath]);
            } catch {
              // ignore error if not currently loaded
            }

            await fs.writeFile(plistPath, plistContent, 'utf8');

            try {
              await execFileAsync('launchctl', ['load', plistPath]);
            } catch (loadErr) {
              throw new Error(`Failed to load launchd agent: ${loadErr.message}`);
            }

            if (isJson) {
              console.log(JSON.stringify({
                status: 'installed',
                label: plistLabel,
                plistPath,
                intervalMinutes: intervalMins,
                intervalSeconds: intervalSec,
                stdoutPath,
                stderrPath,
                programArguments: progArgs,
              }, null, 2));
            } else {
              console.log('\n======================================================');
              console.log(' VSUEE Background Daemon Installed & Loaded');
              console.log(` Label:         ${plistLabel}`);
              console.log(` Schedule:      Every ${intervalMins} minute(s) (${intervalSec}s)`);
              console.log(` Plist:         ${plistPath}`);
              console.log(` Stdout Log:    ${stdoutPath}`);
              console.log(` Stderr Log:    ${stderrPath}`);
              console.log(` Command:       ${progArgs.join(' ')}`);
              console.log('======================================================\n');
              console.log('To check status:   vsuee daemon status');
              console.log('To view logs:      vsuee daemon logs');
              console.log('To stop:           vsuee daemon stop');
              console.log('To uninstall:      vsuee daemon uninstall\n');
            }
            break;
          }

          case 'status': {
            const installed = existsSync(plistPath);
            let loaded = false;
            let pid = null;
            let lastExitCode = null;

            if (installed) {
              try {
                const { stdout } = await execFileAsync('launchctl', ['list']);
                const lines = stdout.split('\n');
                for (const line of lines) {
                  if (line.includes(plistLabel)) {
                    loaded = true;
                    const parts = line.trim().split(/\s+/);
                    if (parts[0] && parts[0] !== '-') pid = parseInt(parts[0], 10);
                    if (parts[1] && parts[1] !== '-') lastExitCode = parseInt(parts[1], 10);
                    break;
                  }
                }
              } catch {
                // ignore launchctl error
              }
            }

            let stdoutSize = 0;
            let stderrSize = 0;
            try { stdoutSize = (await fs.stat(stdoutPath)).size; } catch {}
            try { stderrSize = (await fs.stat(stderrPath)).size; } catch {}

            if (isJson) {
              console.log(JSON.stringify({
                installed,
                loaded,
                pid,
                lastExitCode,
                plistPath,
                stdoutPath,
                stderrPath,
                stdoutSize,
                stderrSize,
              }, null, 2));
            } else {
              console.log('\n--- VSUEE Daemon Status ---');
              console.log(` Installed:     ${installed ? 'YES (' + plistPath + ')' : 'NO'}`);
              console.log(` Loaded/Active: ${loaded ? 'YES' : 'NO'}`);
              if (pid !== null) console.log(` Running PID:   ${pid}`);
              if (lastExitCode !== null) console.log(` Last Exit:     ${lastExitCode}`);
              console.log(` Stdout Log:    ${stdoutPath} (${(stdoutSize / 1024).toFixed(1)} KB)`);
              console.log(` Stderr Log:    ${stderrPath} (${(stderrSize / 1024).toFixed(1)} KB)`);
              console.log('---------------------------\n');
            }
            break;
          }

          case 'logs': {
            const linesCount = parseInt(getArg('--limit') || '30', 10);
            let stdoutContent = '';
            let stderrContent = '';

            try {
              const rawOut = await fs.readFile(stdoutPath, 'utf8');
              stdoutContent = rawOut.split('\n').slice(-linesCount).join('\n');
            } catch {
              stdoutContent = '(No stdout logs found)';
            }

            try {
              const rawErr = await fs.readFile(stderrPath, 'utf8');
              stderrContent = rawErr.split('\n').slice(-linesCount).join('\n');
            } catch {
              stderrContent = '(No stderr logs found)';
            }

            if (isJson) {
              console.log(JSON.stringify({ stdout: stdoutContent, stderr: stderrContent }, null, 2));
            } else {
              console.log('\n=== Daemon Stdout (last lines) ===');
              console.log(stdoutContent.trim() || '(Empty)');
              if (stderrContent && stderrContent !== '(No stderr logs found)' && stderrContent.trim()) {
                console.log('\n=== Daemon Stderr ===');
                console.log(stderrContent.trim());
              }
              console.log('\n');
            }
            break;
          }

          case 'stop': {
            if (existsSync(plistPath)) {
              try {
                await execFileAsync('launchctl', ['unload', plistPath]);
                console.log('Daemon stopped and unloaded successfully.');
              } catch (err) {
                console.error(`Warning: could not unload daemon (${err.message}).`);
              }
            } else {
              console.log('Daemon is not installed.');
            }
            break;
          }

          case 'start': {
            if (existsSync(plistPath)) {
              try {
                await execFileAsync('launchctl', ['load', plistPath]);
                console.log('Daemon loaded and started successfully.');
              } catch (err) {
                console.error(`Error loading daemon: ${err.message}`);
                process.exit(1);
              }
            } else {
              console.error('Daemon plist not found. Run `vsuee daemon install` first.');
              process.exit(1);
            }
            break;
          }

          case 'restart': {
            if (existsSync(plistPath)) {
              try { await execFileAsync('launchctl', ['unload', plistPath]); } catch {}
              await execFileAsync('launchctl', ['load', plistPath]);
              console.log('Daemon restarted successfully.');
            } else {
              console.error('Daemon is not installed.');
              process.exit(1);
            }
            break;
          }

          case 'uninstall': {
            let removedAny = false;
            for (const p of [plistPath, legacyPlistPath]) {
              if (existsSync(p)) {
                try { await execFileAsync('launchctl', ['unload', p]); } catch {}
                try { await fs.unlink(p); removedAny = true; } catch {}
              }
            }
            if (removedAny) {
              console.log('Daemon plist removed and unloaded successfully.');
            } else {
              console.log('Daemon was not installed.');
            }
            break;
          }

          default: {
            console.error(`Unknown daemon action: "${subAction}". Valid actions: install, status, logs, start, stop, restart, uninstall.`);
            process.exit(1);
          }
        }
        break;
      }

      case 'browser': {
        const targetUrl = getPositionalArg(1) || `${client.baseUrl}/my/`;
        const runner = new BrowserRunner({ sessionCookie: client.sessionCookie });
        console.log(`Opening browser at ${targetUrl}...`);
        await runner.openInteractiveSession({ url: targetUrl, headed: true });
        console.log('Browser window opened. Press Ctrl-C when finished.');
        break;
      }

      case 'img':
      case 'download-images':
      case 'images': {
        let target = getPositionalArg(1);
        const subTarget = getPositionalArg(2);

        if (target && subTarget && ['course', 'assign', 'assignment', 'quiz', 'page', 'forum', 'discuss', 'discussion'].includes(target.toLowerCase())) {
          target = `${target} ${subTarget}`;
        } else if (!target) {
          if (getArg('--course')) target = `course ${getArg('--course')}`;
          else if (getArg('--page')) target = `page ${getArg('--page')}`;
          else if (getArg('--assign')) target = `assign ${getArg('--assign')}`;
          else if (getArg('--quiz')) target = `quiz ${getArg('--quiz')}`;
          else if (getArg('--forum')) target = `forum ${getArg('--forum')}`;
          else if (getArg('--discuss')) target = `discuss ${getArg('--discuss')}`;
        }

        if (!target) {
          console.error('Error: Please specify target (course, page, assign, forum, discuss, or URL). Example: vsuee images 1607, vsuee images page 107176');
          process.exit(1);
        }

        const dest = getArg('--dest') || undefined;
        const deep = args.includes('--deep');
        const includeTheme = args.includes('--include-theme');
        const section = getArg('--section') || undefined;
        const concurrency = parseInt(getArg('--concurrency', '-c') || '4', 10);

        console.log(`Extracting content images from ${target}${deep ? ' (deep scan enabled)' : ''}${section ? ` (section: ${section})` : ''} [parallel streams: ${concurrency}]...`);
        let progress = null;
        const result = await client.downloadImagesFromTarget(target, dest, {
          deep,
          includeTheme,
          section,
          concurrency,
          onStart: (ev) => {
            if (!progress && !isJson && !args.includes('--quiet') && !args.includes('-q')) {
              progress = new ProgressIndicator(ev.total, { label: 'Images', quiet: args.includes('--quiet') || args.includes('-q'), json: isJson });
            }
            if (progress) progress.onStart(ev);
          },
          onProgress: (ev) => {
            if (progress) progress.onProgress(ev);
          },
          type: args.includes('--page') ? 'page' : args.includes('--assign') ? 'assign' : args.includes('--quiz') ? 'quiz' : args.includes('--forum') ? 'forum' : args.includes('--discuss') ? 'discuss' : undefined,
          course: getArg('--course'),
          page: getArg('--page'),
          assign: getArg('--assign'),
          quiz: getArg('--quiz'),
          forum: getArg('--forum'),
          discuss: getArg('--discuss'),
        });
        if (progress) progress.finish();

        if (isJson) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(`\nImage extraction completed for "${result.title}"`);
          console.log(`Target URL:    ${result.target}`);
          console.log(`Saved to:      ${result.destination}`);
          console.log(`Found:         ${result.totalFound} image(s)`);
          console.log(`Downloaded:    ${result.downloadCount} new, ${result.skippedCount} existing`);
          if (result.errors.length > 0) {
            console.log(`Failed items:  ${result.errors.length}`);
            for (const err of result.errors) {
              console.log(`  - ${err.url}: ${err.error}`);
            }
          }
          if (result.images && result.images.length > 0) {
            console.log('\nDownloaded Images:');
            for (const img of result.images.slice(0, 15)) {
              const mod = img.module ? ` [${img.module}]` : '';
              const skip = img.skipped ? ' (cached)' : '';
              console.log(`  • ${path.basename(img.path || img.url)}${mod}${skip}`);
            }
            if (result.images.length > 15) {
              console.log(`  ... and ${result.images.length - 15} more`);
            }
          }
          console.log('');
        }
        break;
      }

      case 'screenshot': {
        let target = getPositionalArg(1);
        const subTarget = getPositionalArg(2);

        if (target && subTarget && ['course', 'assign', 'assignment', 'quiz', 'page', 'forum', 'discuss', 'discussion'].includes(target.toLowerCase())) {
          target = `${target} ${subTarget}`;
        } else if (!target) {
          if (getArg('--course')) target = `course ${getArg('--course')}`;
          else if (getArg('--assign')) target = `assign ${getArg('--assign')}`;
          else if (getArg('--quiz')) target = `quiz ${getArg('--quiz')}`;
          else if (getArg('--page')) target = `page ${getArg('--page')}`;
          else if (getArg('--forum')) target = `forum ${getArg('--forum')}`;
          else if (getArg('--discuss')) target = `discuss ${getArg('--discuss')}`;
          else target = `${client.baseUrl}/my/`;
        }

        const out = getArg('--out') || path.join(process.cwd(), `vsuee_screenshot_${Date.now()}.png`);
        const selector = getArg('--selector') || getArg('--element');
        const section = getArg('--section') || undefined;
        const fullPage = !args.includes('--viewport-only') && !args.includes('--no-full-page');
        const width = getArg('--width');
        const height = getArg('--height');
        const timeout = getArg('--timeout') ? parseInt(getArg('--timeout'), 10) : undefined;
        const selectorTimeout = getArg('--selector-timeout') ? parseInt(getArg('--selector-timeout'), 10) : undefined;

        const runner = new BrowserRunner({ sessionCookie: client.sessionCookie });
        console.log(`Capturing screenshot of ${target}${selector ? ` (element: "${selector}")` : section ? ` (section: ${section})` : ''}...`);
        const shot = await runner.captureScreenshot(target, out, {
          selector,
          section,
          fullPage,
          width,
          height,
          timeout,
          selectorTimeout,
          type: args.includes('--page') ? 'page' : args.includes('--assign') ? 'assign' : args.includes('--quiz') ? 'quiz' : args.includes('--forum') ? 'forum' : args.includes('--discuss') ? 'discuss' : undefined,
          course: getArg('--course'),
          assign: getArg('--assign'),
          quiz: getArg('--quiz'),
          page: getArg('--page'),
          forum: getArg('--forum'),
          discuss: getArg('--discuss'),
        });

        if (isJson) {
          console.log(JSON.stringify(shot, null, 2));
        } else {
          console.log(`\nScreenshot captured successfully!`);
          console.log(`Target URL:   ${shot.url}`);
          console.log(`Saved file:   ${shot.outputPath}`);
          console.log(`File size:    ${(shot.size / 1024).toFixed(1)} KB`);
          if (shot.isElement) {
            console.log(`Element:      ${shot.selector}`);
          } else {
            console.log(`Mode:         ${shot.fullPage ? 'Full scrollable page' : 'Viewport only'}`);
          }
          console.log('');
        }
        break;
      }

      default: {
        console.error(`Unknown command: ${command}`);
        console.log(USAGE);
        process.exit(1);
      }
    }
  } catch (err) {
    if (isJson) {
      console.error(JSON.stringify({ error: true, message: err.message }, null, 2));
    } else {
      console.error(`\n[VSUEE Error] ${err.message}\n`);
    }
    process.exit(1);
  }
}

main();
