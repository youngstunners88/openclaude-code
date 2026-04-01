# Security Policy

## Current Security Measures
- Protected paths blocked (/etc, /proc, /sys)
- execFile instead of string interpolation (no shell injection)
- URL validation for web_fetch
- Path validation with path.resolve()
- No API keys in repository (.env gitignored)

## Known Limitations
- run_cmd uses sh -c (opt-in, user should understand risk)
- No sandboxing for file operations
- No rate limiting

## Reporting
Report security issues to the repository maintainer.
