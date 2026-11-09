<<<<<<< HEAD
# Online Voting System

React (Vite) front end + Node/Express + MongoDB back end.

- **Voters** sign in, vote in open elections (candidates or proposals), get a receipt code, and can later check their ballot was counted.
- **Admins** register voters, schedule elections, watch turnout live, publish results, and verify the audit trail.
- **Integrity**: ballots are AES-256-GCM encrypted and stored with no link to the voter; one vote per voter is enforced by a unique database index; every action is written to a hash-chained audit log that can be verified from the admin panel.

## Run it

You need Node 18+ and MongoDB running locally (or an Atlas connection string).

```bash
# 1. back end
cd server
npm install
cp .env.example .env      # then edit JWT_SECRET and BALLOT_KEY
npm run seed              # creates an admin, sample voters, a sample election
npm run dev               # http://localhost:5000

# 2. front end (new terminal)
cd client
npm install
npm run dev               # http://localhost:5173
```

Generate the ballot key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Seeded logins (change in `.env` / `seed.js`):

| Role  | Voter ID | Password     |
|-------|----------|--------------|
| Admin | admin    | Admin@12345  |
| Voter | voter1   | Voter@12345  |
| Voter | voter2   | Voter@12345  |

## How secrecy and integrity work

| Concern | Approach |
|---|---|
| One person, one vote | `Participation` collection has a unique index on (election, user) |
| Ballot secrecy | `Ballot` documents hold only encrypted choice + receipt hash; random IDs, no timestamps, no user reference |
| Encryption | AES-256-GCM, key from `BALLOT_KEY`; ballots are decrypted only when an admin publishes results after close |
| Passwords | bcrypt |
| Sessions | JWT, 2 hour expiry |
| Audit trail | Each entry stores the hash of the previous one; `Verify chain` recomputes all hashes |
| Real-time monitoring | Server-Sent Events stream of audit entries to the admin Monitor tab |
| Receipts | Voter gets a code; only its SHA-256 is stored, so the code proves inclusion without revealing the choice |

## Before real-world use

This is a solid project foundation, not a certified election system. For production you would add: rate limiting and account lockout on login, HTTPS, key management (KMS/HSM instead of an env var), MongoDB transactions on a replica set, threshold or split-key decryption so no single admin can decrypt, and an independent security review.
=======
# voting_system
>>>>>>> c8cc668800a482d3bef1aa81f84fa7a2f7c6b1ba
