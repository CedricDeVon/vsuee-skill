import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { MoodleClient, expandHome } from '../lib/moodle-client.mjs';

test('MoodleClient session management and headers', async () => {
  const client = new MoodleClient();
  client.sessionCookie = 'testcookie123';
  const headers = client.getHeaders();
  assert.equal(headers['Cookie'], 'MoodleSession=testcookie123');
  assert.equal(typeof headers['User-Agent'], 'string');
});

test('MoodleClient extractCookieFromResponse handles various headers', () => {
  const client = new MoodleClient();

  const mockRes1 = {
    headers: {
      getSetCookie: () => ['MoodleSession=abc456def; path=/; secure; HttpOnly'],
    },
  };
  assert.equal(client.extractCookieFromResponse(mockRes1), 'abc456def');

  const mockRes2 = {
    headers: {
      get: (h) => (h === 'set-cookie' ? 'MoodleSession=xyz789; path=/' : null),
    },
  };
  assert.equal(client.extractCookieFromResponse(mockRes2), 'xyz789');

  const mockResEmpty = { headers: null };
  assert.equal(client.extractCookieFromResponse(mockResEmpty), null);
});

test('MoodleClient extractSesskey parses sesskey patterns', () => {
  const client = new MoodleClient();

  const html1 = '<script>var M = {"sesskey":"AbCdEf1234"};</script>';
  assert.equal(client.extractSesskey(html1), 'AbCdEf1234');

  const html2 = '<a href="https://elearning.vsu.edu.ph/login/logout.php?sesskey=XyZ987">Logout</a>';
  assert.equal(client.extractSesskey(html2), 'XyZ987');

  const html3 = '<input type="hidden" name="sesskey" value="Tok12345" />';
  assert.equal(client.extractSesskey(html3), 'Tok12345');

  assert.equal(client.extractSesskey(''), null);
  assert.equal(client.extractSesskey(null), null);
});

test('MoodleClient extractUserInfo extracts fullname and userid', () => {
  const client = new MoodleClient();

  const html = `
    <div class="usermenu">
      <span class="usertext mr-1">Student User</span>
      <a href="https://elearning.vsu.edu.ph/user/profile.php?id=12345" title="View profile">Profile</a>
    </div>
  `;
  const info = client.extractUserInfo(html);
  assert.equal(info.fullname, 'Student User');
  assert.equal(info.id, '12345');

  const emptyInfo = client.extractUserInfo('');
  assert.equal(emptyInfo, null);
});

test('MoodleClient checkStatus identifies network error cleanly', async () => {
  const client = new MoodleClient({ baseUrl: 'http://127.0.0.1:59999' });
  client.sessionCookie = 'anycookie';
  const status = await client.checkStatus();
  assert.equal(status.authenticated, false);
  assert.equal(status.isNetworkError, true);
  assert.match(status.reason, /Network error/);
});

test('MoodleClient downloadResource handles HTML responses without crashing streams', async () => {
  const client = new MoodleClient();
  const origFetch = globalThis.fetch;
  try {
    // Mock fetch returning HTML page with no embedded files
    globalThis.fetch = async () => ({
      ok: true,
      headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
      text: async () => '<html><body><h1>No files here</h1></body></html>',
    });

    await assert.rejects(
      async () => {
        await client.downloadResource('https://elearning.vsu.edu.ph/mod/resource/view.php?id=999', '/tmp/test_download.pdf');
      },
      /Resource URL returned an HTML page with no downloadable file/
    );
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('expandHome expands ~, ~/path, and safely returns non-string or absolute paths', () => {
  assert.equal(expandHome('~'), os.homedir());
  assert.equal(expandHome('~/Downloads/VSUEE'), path.join(os.homedir(), 'Downloads', 'VSUEE'));
  assert.equal(expandHome('/tmp/file.txt'), '/tmp/file.txt');
  assert.equal(expandHome('relative/path.txt'), 'relative/path.txt');
  assert.equal(expandHome(null), null);
  assert.equal(expandHome(undefined), undefined);
  assert.equal(expandHome(12345), 12345);
});

test('MoodleClient getCourseContents parses persistent section IDs, cleans accesshide, and extracts details', async () => {
  const client = new MoodleClient();
  const mockHtml = `
    <html>
      <head><title>Course: CSci 144</title></head>
      <body>
        <h1>CSci 144 - Parallel Computing</h1>
        <ul class="topics">
          <li id="section-0" class="section main clearfix" aria-labelledby="sectionid-45678-title">
            <h3 class="sectionname" id="sectionid-45678-title"><span>General Syllabus</span></h3>
            <div class="summary"><p>General course notes and overview</p></div>
            <ul class="section img-text">
              <li class="activity forum modtype_forum" id="module-1001">
                <div class="activityinstance">
                  <a class="aalink" href="https://elearning.vsu.edu.ph/mod/forum/view.php?id=1001">
                    <span class="instancename">Announcements<span class="accesshide "> Forum</span></span>
                  </a>
                </div>
              </li>
              <li class="activity resource modtype_resource" id="module-1002">
                <div class="activityinstance">
                  <a class="aalink" href="https://elearning.vsu.edu.ph/mod/resource/view.php?id=1002">
                    <span class="instancename">Lecture 1 Slides<span class="accesshide"> File</span></span>
                  </a>
                  <span class="resourcedetails">1.4 MB PDF document uploaded 01/09/26, 10:00</span>
                </div>
              </li>
            </ul>
          </li>
        </ul>
      </body>
    </html>
  `;

  const origFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => ({
      ok: true,
      text: async () => mockHtml,
    });

    const course = await client.getCourseContents(1610);
    assert.equal(course.id, 1610);
    assert.equal(course.title, 'CSci 144 - Parallel Computing');
    assert.equal(course.sections.length, 1);

    const sec0 = course.sections[0];
    assert.equal(sec0.id, 45678); // parsed from aria-labelledby sectionid-45678-title
    assert.equal(sec0.number, 0);
    assert.equal(sec0.name, 'General Syllabus');
    assert.match(sec0.summary, /General course notes/);
    assert.equal(sec0.activities.length, 2);

    // Verify screen reader text is stripped
    const act0 = sec0.activities[0];
    assert.equal(act0.name, 'Announcements'); // Not 'Announcements Forum'
    assert.equal(act0.type, 'forum');

    const act1 = sec0.activities[1];
    assert.equal(act1.name, 'Lecture 1 Slides'); // Not 'Lecture 1 Slides File'
    assert.equal(act1.fileType, 'pdf');
    assert.equal(act1.details, '1.4 MB PDF document uploaded 01/09/26, 10:00');
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('MoodleClient getUrlDetails extracts embedded video and target link', async () => {
  const client = new MoodleClient();
  const mockHtml = `
    <html>
      <body>
        <h2>OpenCL Architecture Video</h2>
        <div class="urlworkaround">
          <a href="https://www.youtube.com/watch?v=sample123">Click here to view video</a>
        </div>
      </body>
    </html>
  `;

  const origFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => ({
      ok: true,
      text: async () => mockHtml,
    });

    const details = await client.getUrlDetails(262927);
    assert.equal(details.id, 262927);
    assert.equal(details.title, 'OpenCL Architecture Video');
    assert.equal(details.targetUrl, 'https://www.youtube.com/watch?v=sample123');
  } finally {
    globalThis.fetch = origFetch;
  }
});


