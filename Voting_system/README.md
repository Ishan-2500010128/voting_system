# Online Voting System (Node.js, no Python, no npm packages)

## Run in VS Code
1. Install Node.js (version 18 or newer) from https://nodejs.org
2. In VS Code: File > Open Folder, choose this folder.
3. Open the terminal (Ctrl+`) and run:  `node server.js`
4. Open http://localhost:3000

Demo logins: voter `V001` / `vote123` (also V002, V003); admin `admin` / `admin123`.
Delete `data.json` to reset everything.

## Typical flow
Admin: set candidates > Open voting. Voter: sign in > vote > save receipt.
Admin: Close voting > Publish results > Verify log integrity.

## Files
- server.js        backend: API, sessions, security, hash-chained audit log, data.json storage
- public/index.html, app.js, style.css   front end

## Security features
- scrypt password hashing, HttpOnly session cookies, CSRF token on every state-changing call
- Login lockout after 5 failed attempts, security headers, strict Content-Security-Policy
- One vote per voter: check, ballot insert and "has voted" flag run as one uninterrupted step
- Ballots store no voter identity (ballot secrecy); receipts let voters confirm inclusion
- Hash-chained audit log with an integrity check; live turnout monitor

## Before real-world use
Set the ADMIN_PASSWORD environment variable, serve over HTTPS (reverse proxy), replace data.json
with a real database (PostgreSQL/MongoDB), and add OTP/2FA for voters.
