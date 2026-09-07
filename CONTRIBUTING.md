# Contributing to VSUEE

Thank you for your interest in improving `vsuee`! This project is designed as an open-source, high-efficiency toolkit and AI agent skill for the Visayas State University (VSU) academic community.

---

## 1. Academic Integrity & Ethics

`vsuee` is created to help students and researchers organize, inspect, sync, and download course materials efficiently. When contributing, please uphold the following ethical boundaries:

- **No Automated Quiz Answering**: Contributions that attempt to auto-solve quizzes, scrape question answer keys, or bypass timed assessment controls will be rejected.
- **Server Respect & Bounded Concurrency**: Never remove or relax concurrency limits. Moodle servers are university shared infrastructure; aggressive hammering is prohibited.
- **Privacy by Default**: Never add code that sends student telemetry, credentials, or session cookies to external servers. All operations must remain local-only (`~/.config/vsuee`).

---

## 2. Development Setup

### Prerequisites
- Node.js >= 18.0.0
- Git

### Getting Started

```bash
# Clone the repository
git clone https://github.com/M1Vj/vsuee.git
cd vsuee

# Run the unit test suite (hermetic, offline, no credentials required)
npm run test:unit
```

### Optional Playwright Support
For browser-based screenshots and interactive login fallback:
```bash
npm install playwright
```

---

## 3. Architecture & Principles

- **Zero Core Runtime Dependencies**: The core HTTP/AJAX engine, sync manager, and CLI use standard Node.js built-in modules (`node:test`, `node:assert`, `node:fs`, `node:crypto`, `node:path`, `node:os`). Do not add heavy npm dependencies without explicit justification.
- **Cross-Platform Compatibility**: Code should run reliably across macOS and Linux (and Windows where feasible). Avoid OS-specific assumptions; provide clean fallbacks (e.g. `osascript` on macOS, `notify-send` on Linux).
- **Graceful Error Handling**: Network failures or session expirations must be reported with clear, actionable error messages rather than raw unhandled stack traces.
- **Agent Skill Parity**: If you add or modify a CLI command, ensure the command reference in `skills/vsuee/SKILL.md` is updated accordingly.

---

## 4. Testing Guidelines

We enforce a comprehensive test suite using Node.js's native `node:test` runner.

```bash
# Run unit tests (offline, fast)
npm test

# Run live integration tests (requires active ~/.config/vsuee/session.json)
npm run test:live
```

### Test Standards
1. **Never commit personal credentials, student IDs, or passwords** to test fixtures.
2. Mock network requests using `globalThis.fetch` overrides in unit tests.
3. Test edge cases: empty strings, missing fields, malformed HTML, redirect loops, and server error responses.

---

## 5. Submitting a Pull Request

1. Fork the repository and create your feature branch: `git checkout -b feat/my-new-feature`.
2. Ensure all unit tests pass: `npm test`.
3. Verify the CLI entry point runs without syntax errors: `./bin/vsuee.mjs --help`.
4. Commit your changes with clear, descriptive commit messages (Conventional Commits preferred).
5. Push to your fork and submit a Pull Request against `main`.
