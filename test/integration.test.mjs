import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { MoodleClient } from '../lib/moodle-client.mjs';
import { BrowserRunner } from '../lib/browser-runner.mjs';

let hasLiveAuth = false;
try {
  const checkClient = new MoodleClient();
  await checkClient.init();
  const st = await checkClient.checkStatus({ allowAutoRelogin: false });
  hasLiveAuth = Boolean(st.authenticated);
} catch {
  hasLiveAuth = false;
}

// Live portal integration tests only run when explicitly requested via VSUEE_LIVE_TEST=1
const skipLive = !hasLiveAuth || !process.env.VSUEE_LIVE_TEST || Boolean(process.env.VSUEE_SKIP_LIVE);

let discoveredCourses = [];

test('Live portal authentication & status', { skip: skipLive }, async () => {
  const client = new MoodleClient();
  await client.init();
  const status = await client.checkStatus();
  assert.equal(status.authenticated, true);
  assert.equal(typeof status.sesskey, 'string');
  assert.ok(status.user && status.user.id, 'Should have authenticated user ID');
});

test('Live portal course classification discovery', { skip: skipLive }, async () => {
  const client = new MoodleClient();
  await client.init();

  const activeCourses = await client.getCourses({ classification: 'all' });
  assert.ok(Array.isArray(activeCourses) && activeCourses.length >= 1, 'Should discover at least 1 enrolled course');
  discoveredCourses = activeCourses;

  const allCourses = await client.getCourses({ all: true });
  assert.ok(allCourses.length >= activeCourses.length);
});

test('Live portal deep course parsing', { skip: skipLive }, async (t) => {
  const client = new MoodleClient();
  await client.init();

  if (discoveredCourses.length === 0) {
    discoveredCourses = await client.getCourses();
  }
  if (discoveredCourses.length === 0) {
    t.skip('No enrolled courses found for active student session');
    return;
  }

  const testCourse = discoveredCourses[0];
  const course = await client.getCourseContents(testCourse.id);
  assert.equal(String(course.id), String(testCourse.id));
  assert.ok(Array.isArray(course.sections), 'Course should have sections array');
  assert.ok(course.title, 'Course should have a title');
});

test('Live portal module content reading (Page and Quiz)', { skip: skipLive }, async (t) => {
  const client = new MoodleClient();
  await client.init();

  if (discoveredCourses.length === 0) {
    discoveredCourses = await client.getCourses();
  }
  if (discoveredCourses.length === 0) {
    t.skip('No enrolled courses found');
    return;
  }

  const testCourse = discoveredCourses[0];
  const course = await client.getCourseContents(testCourse.id);
  const activities = (course.sections || []).flatMap(s => s.activities || []);

  const pageMod = activities.find(a => a.type === 'page');
  if (pageMod) {
    const page = await client.getPageContent(pageMod.id);
    assert.equal(String(page.id), String(pageMod.id));
    assert.ok(page.title || page.content);
  }

  const quizMod = activities.find(a => a.type === 'quiz');
  if (quizMod) {
    const quiz = await client.getQuizDetails(quizMod.id);
    assert.equal(String(quiz.id), String(quizMod.id));
    assert.ok(quiz.title || quiz.id);
  }

  if (!pageMod && !quizMod) {
    t.skip('No Page or Quiz module found in sample course');
  }
});

test('Live portal single module download', { skip: skipLive }, async (t) => {
  const client = new MoodleClient();
  await client.init();

  if (discoveredCourses.length === 0) {
    discoveredCourses = await client.getCourses();
  }
  if (discoveredCourses.length === 0) {
    t.skip('No enrolled courses found');
    return;
  }

  const testCourse = discoveredCourses[0];
  const course = await client.getCourseContents(testCourse.id);
  const activities = (course.sections || []).flatMap(s => s.activities || []);
  const resourceMod = activities.find(a => a.type === 'resource' && a.link);

  if (!resourceMod) {
    t.skip('No downloadable resource module found in sample course');
    return;
  }

  const tmpDir = path.join(os.tmpdir(), `test_live_dl_${Date.now()}`);
  await fs.mkdir(tmpDir, { recursive: true });

  try {
    const res = await client.downloadModule(resourceMod.id, tmpDir);
    assert.equal(String(res.id), String(resourceMod.id));
    assert.ok(res.savedPath, 'Should have savedPath');
    assert.ok(res.size > 0, 'Downloaded file size should be > 0');
    const stat = await fs.stat(res.savedPath);
    assert.equal(stat.size, res.size);
  } finally {
    try { await fs.rm(tmpDir, { recursive: true, force: true }); } catch {}
  }
});

test('Live portal element screenshot capture', { skip: skipLive }, async (t) => {
  const client = new MoodleClient();
  await client.init();

  const runner = new BrowserRunner({ sessionCookie: client.sessionCookie });
  try {
    await runner.getPlaywright();
  } catch {
    t.skip('Playwright not available for browser screenshot test');
    return;
  }

  if (discoveredCourses.length === 0) {
    discoveredCourses = await client.getCourses();
  }
  if (discoveredCourses.length === 0) {
    t.skip('No enrolled courses found');
    return;
  }

  const testCourse = discoveredCourses[0];
  const tmpOut = path.join(os.tmpdir(), `test_live_elem_${Date.now()}.png`);

  try {
    const res = await runner.captureScreenshot(`course ${testCourse.id}`, tmpOut, {
      selector: '#region-main',
    });
    assert.equal(res.isElement, true);
    assert.equal(res.selector, '#region-main');
    assert.ok(res.size > 0);
    const stat = await fs.stat(tmpOut);
    assert.ok(stat.size > 100);
  } finally {
    try { await fs.unlink(tmpOut); } catch {}
  }
});

test('Live portal calendar .ics export with assignment deadlines and alarms', { skip: skipLive }, async () => {
  const client = new MoodleClient();
  await client.init();

  const tmpFile = path.join(os.tmpdir(), `test_live_cal_${Date.now()}.ics`);

  try {
    const res = await client.exportCalendarIcs(tmpFile);
    assert.equal(res.savedPath, tmpFile);
    assert.ok(typeof res.eventCount === 'number');
    assert.ok(res.bytes > 0, 'ICS content should be > 0 bytes');

    const icsContent = await fs.readFile(tmpFile, 'utf8');
    assert.ok(icsContent.includes('BEGIN:VCALENDAR'));
    assert.ok(icsContent.includes('END:VCALENDAR'));
  } finally {
    try { await fs.unlink(tmpFile); } catch {}
  }
});

test('Live portal assignment submission inspection', { skip: skipLive }, async (t) => {
  const client = new MoodleClient();
  await client.init();

  const assigns = await client.getAssignments();
  if (!assigns || assigns.length === 0) {
    t.skip('No assignments found across courses');
    return;
  }

  const sampleAssign = assigns[0];
  const details = await client.getSubmissionStatus(sampleAssign.id);
  assert.equal(details.id, sampleAssign.id);
  assert.ok(details.title, 'Assignment should have a title');
  assert.ok('isSubmitted' in details, 'Should have isSubmitted boolean');
  assert.ok('isGraded' in details, 'Should have isGraded boolean');
  assert.ok(Array.isArray(details.submittedFiles), 'Should have submittedFiles array');
});

test('Live portal parallel batch download with bounded concurrency', { skip: skipLive }, async (t) => {
  const client = new MoodleClient();
  await client.init();

  if (discoveredCourses.length === 0) {
    discoveredCourses = await client.getCourses();
  }
  if (discoveredCourses.length === 0) {
    t.skip('No enrolled courses found');
    return;
  }

  const testCourse = discoveredCourses[0];
  const tmpDir = path.join(os.tmpdir(), `test_live_par_${Date.now()}`);

  try {
    const res = await client.downloadCourseMaterials(testCourse.id, tmpDir, {
      concurrency: 2,
    });
    assert.ok(res.course);
    assert.ok(typeof res.downloadCount === 'number');
    assert.ok(typeof res.skippedCount === 'number');
  } finally {
    try { await fs.rm(tmpDir, { recursive: true, force: true }); } catch {}
  }
});
