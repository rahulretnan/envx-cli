---
Status: Accepted
Date: 2026-07-12 (back-filled)
---

# ADR 0001 — Symmetric GPG encryption with a per-stage passphrase

## Context

EnvX needs to encrypt `.env.<stage>` files so they can be committed to a shared
git repo, and decrypted by teammates and CI. Options: bundle a JS crypto library,
use GPG asymmetric (per-recipient public keys), or use GPG symmetric (a shared
passphrase).

## Decision

Shell out to the **system `gpg` binary** using **symmetric** encryption
(`gpg -c`), keyed by a **per-stage passphrase**. EnvX ships no cryptography of its
own and maintains no keyring.

Each stage maps to a passphrase named `<STAGE>_SECRET` in `.envrc`.

## Consequences

**Positive**

- The only thing to share is a passphrase string per stage — no keyrings, no key
  server, no per-recipient re-encryption when the team changes.
- Reuses a battle-tested, ubiquitous crypto implementation.
- Encryption/decryption round-trips are verified before real work
  (`testGpgOperation`).

**Negative / trade-offs**

- Anyone with the passphrase can decrypt — no per-user revocation. Acceptable for
  the target workflow (commit encrypted files, distribute passphrase out of band).
- Hard dependency on `gpg` being installed; EnvX checks `isGpgAvailable()` and
  exits `GPG_ERROR (4)` with install guidance when it's missing.
- Passphrase must be handled carefully → fed to `gpg` via stdin, never argv
  (`--passphrase-fd 0 --pinentry-mode loopback`).

## Alternatives considered

- **GPG asymmetric** — better revocation, but requires key distribution and
  re-encrypt-on-membership-change. Too heavy for the "share a string" model.
- **In-process JS crypto (e.g. libsodium)** — no external dependency, but reinvents
  key management and loses GPG/direnv ecosystem familiarity.
