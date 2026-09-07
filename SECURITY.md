# Security Policy

## Supported Versions

| Version | Supported          |
| :------ | :----------------- |
| 1.x.x   | :white_check_mark: |

---

## Security Architecture & Threat Model

`vsuee` is designed with a defense-in-depth approach for handling student authentication:

1. **Local-Only Storage**: All configuration, session cookies, and encrypted secrets are stored locally at `~/.config/vsuee/`. The tool does not use any third-party backend, cloud database, or analytics service.
2. **Machine-Bound AES-256-GCM Encryption**: When credentials are saved for background auto-relogin, the password is encrypted using AES-256-GCM with a key derived deterministically from the local machine ID and user environment. Even if the session file is copied to another computer, it cannot be decrypted.
3. **Strict File Permissions**: The configuration directory (`0700`) and session/snapshot files (`0600`) are created with restricted file permissions, accessible only by the current OS user account.
4. **Credential Masking**: Plaintext passwords are never printed to terminal logs, diff reports, stdout, or JSON dumps.
5. **No Password Storage Requirement**: Users who prefer not to store credentials can use `vsuee login --no-save-credentials` or supply session cookies directly via `vsuee session set <cookie>`.

---

## Reporting a Vulnerability

If you discover a security vulnerability or sensitive information exposure in `vsuee`, please report it responsibly:

1. **Do not create a public GitHub issue.**
2. Send an email to the maintainer with:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
3. You will receive an acknowledgment within 48 hours. A fix will be developed and released promptly.
