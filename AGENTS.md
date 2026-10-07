# Codex Security Reviews

For every requested code review, run a read-only Codex Security review of the change set before reporting approval. In Codex, use `$codex-security:security-diff-scan` when that plugin is installed. On agents without that skill, use the standalone CLI:

```powershell
$env:CODEX_SECURITY_STATE_DIR = '<private directory outside the repository>'
npx @openai/codex-security scan . --diff <base> --head <head> --output-dir '<private directory outside the repository>' --format json
```

- Review authentication, authorization, input handling, filesystem access, network requests, and secrets; report the exact base/head and any paths excluded from coverage.
- Treat findings as review findings: do not invoke `codex-security patch` or modify the checkout unless the user explicitly asks for a fix.
- Keep state and reports outside the repository because they can include source excerpts and vulnerability details.
