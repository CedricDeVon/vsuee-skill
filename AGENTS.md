# AGENTS.md — Agent Operating Guide for VSUEE

Welcome to **`vsuee`**, the autonomous CLI toolkit and AI agent skill for the **Visayas State University E-Learning Environment** ([elearning.vsu.edu.ph](https://elearning.vsu.edu.ph)).

If you are an AI coding assistant (Antigravity, Codex, Claude Code, Cursor, GitHub Copilot) working in or extending this repository, you **must** adhere to the operational invariants and safety boundaries defined here.

---

## 1. Non-Negotiable Invariants

### A. Strict Credential & Secret Sanitization
- **NEVER hardcode, log, or commit user passwords, student IDs, session cookies, or CSRF tokens.**
- User credentials must **only** reside in the machine-bound, encrypted configuration file at `~/.config/vsuee/session.json` with POSIX permissions `0600`.
- All password persistence uses machine-bound AES-256-GCM encryption via `getMachineKey()` in `lib/moodle-client.mjs`.
- Test fixtures in `test/` must **only** use sanitized mock strings (e.g. `'test-secret-password-123'`). Never use live portal passwords or actual student IDs in unit tests.

### B. Academic Integrity & Safety Gates
- **Read-Only / Inspection by Default**: The primary role of `vsuee` is reading syllabi, monitoring deadlines, downloading lecture slides, and checking submission statuses.
- **NEVER blindly auto-submit assignments or quizzes**: Submitting student work or quiz answers requires explicit human consent and verification.

### C. Rate Limiting & Bounded Concurrency
- Never flood the university portal. When performing batch operations (e.g. downloading course materials or lesson images), always use `asyncPool` with bounded concurrency (default: 4, maximum: 16).
- Use HTTP headers that accurately mirror browser navigation (`DEFAULT_HEADERS`).

---

## 2. Architecture & File Layout

```text
vsuee/
├── bin/
│   └── vsuee.mjs                 # Unified CLI executable entrypoint
├── lib/
│   ├── moodle-client.mjs         # Core HTTP/AJAX client, auto-relogin, RFC 5545 iCalendar
│   ├── sync-manager.mjs          # State diffing, snapshot Merkle trees, notifications
│   └── browser-runner.mjs        # Optional Playwright headless/headed runner & screenshots
├── skills/
│   └── vsuee/
│       └── SKILL.md              # Agent Skills open standard specification
├── test/
│   ├── session-auth.test.mjs     # Crypto, AES-256-GCM round-trip, auto-relogin unit tests
│   ├── moodle-client.test.mjs    # Moodle DOM scrapers, regex, and session helpers
│   ├── moodle-client-downloads.test.mjs # Concurrency pool, MIME mapping, downloads
│   ├── sync-manager.test.mjs     # Snapshot diffs, deadline change detection
│   ├── browser-runner.test.mjs   # URL shortcuts, conditional Playwright runner
│   └── integration.test.mjs      # Dynamic live portal integration tests (opt-in)
├── .github/                      # CI workflows, issue templates, PR template
├── CONTRIBUTING.md               # Community guidelines and developer setup
├── SECURITY.md                   # Security model and vulnerability disclosure
├── README.md                     # Documentation, runbooks, CLI reference
└── package.json                  # Package manifest, export map, scripts
```

---

## 3. Development & Testing Workflow

### Running Unit Tests (Hermetic / Offline)
Always verify changes locally with the hermetic offline test suite:
```bash
npm run test:unit
```
This runs 59 offline unit tests in <5 seconds without touching external networks.

### Running Live Integration Tests (Opt-in)
To run live end-to-end integration tests against the live portal:
```bash
VSUEE_LIVE_TEST=1 npm run test:live
```
These tests dynamically discover the student's enrolled courses, activities, and timeline without hardcoding course or module IDs.

### Syntax & Lint Checks
```bash
node --check bin/vsuee.mjs lib/*.mjs test/*.test.mjs
```

---

## 4. Coding Conventions
- **Module System**: Pure ECMAScript Modules (`import` / `export`). Use `.mjs` extensions.
- **Node.js Built-ins**: Prefix all Node core modules with `node:` (e.g. `node:fs/promises`, `node:crypto`, `node:path`).
- **Error Handling**: Graceful degradation over unhandled crashes. For optional dependencies (such as `playwright`), catch resolution errors and provide actionable install guidance.
- **Path Resolution**: Use `expandHome()` to safely resolve `~` paths across macOS, Linux, and Windows.
