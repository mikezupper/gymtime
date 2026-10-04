# Security policy

Gymtime is pre-1.0. Security fixes target the current `main` branch; older snapshots have no separate support guarantee. Maintainers handle reports on a best-effort basis.

## Report a vulnerability privately

Use [GitHub private vulnerability reporting](https://github.com/mikezupper/gymtime/security/advisories/new). Include the affected commit, a description of the impact, and steps to reproduce with fictional accounts and a disposable database. Do not post exploit details in a public issue or pull request before maintainers have reviewed the report.

Never include API keys, authentication codes, session cookies, database backups, real parent-calendar tokens, or information about children. If a reproduction needs sensitive details, first describe what is needed and agree on a private way to share it.

The scheduling permission boundary, invitation and sign-in flows, proxy trust, email delivery, and parent-calendar projections are especially relevant. A shareable parent link grants access to a team's calendar to anyone who has it. Search exclusion does not make that link private.

Maintainers will assess the report, work on a fix where appropriate, and coordinate disclosure with the reporter. This project offers no bug bounty or guaranteed response deadline.

## Operate an instance safely

Follow [deployment guidance](docs/deployment.md), use HTTPS and strong secrets, restrict trusted proxy networks, and protect the database and backups. Keep configuration and real data out of Git. Review dependency updates and verify recovery before upgrading an active gym.
