# Security Policy

## Current Security Measures

### Input Validation
- All tool parameters validated for type and presence
- Path resolution with `path.resolve()` prevents directory traversal
- URL format validation with `new URL()` constructor
- Command parameter must be string type

### Command Execution Security
- **Denylist Protection**: Dangerous commands blocked via regex patterns:
  - `rm` on root (`/`), home (`~`, `$HOME`) directories
  - `dd` (disk dump utility)
  - `mkfs` (filesystem creation)
  - `chmod 777` (dangerous permission setting)
  - `curl | sh` and `wget | sh` (remote code execution patterns)
  - Chained `rm` via `;`, `&&`, `||` operators
- **Timeout Protection**: 30-second timeout on command execution
- **Buffer Limits**: 1MB max buffer prevents memory exhaustion
- **Logging**: Blocked commands logged to console for audit

### File System Security
- **Protected Paths Blocked**: `/etc`, `/proc`, `/sys`, `/dev`
- **Hidden Directory Protection**: Cannot write to `.*` directories in home
- **Existence Checks**: Files/directories verified before operations
- **Type Verification**: Ensures paths are correct type (file vs directory)

### Network Security
- **Localhost Blocking**: Cannot fetch `localhost`, `127.0.0.1`, `::1`
- **Private Network Blocking**: RFC 1918 addresses blocked (10.x, 172.16-31.x, 192.168.x)
- **URL Format Validation**: Strict URL parsing required
- **Timeout Protection**: 15-second max fetch time
- **User Agent**: Identifiable user agent for transparency

### Configuration Security
- **Environment Variable Validation**: Required variables checked at startup
- **No Hardcoded Secrets**: API keys only from environment
- **Lazy Initialization**: OpenAI client created on-demand, not at module load
- **Backend URL Validation**: LOCAL_BACKEND must be valid HTTP URL

## Known Limitations

### Current Risks
1. **Shell Execution**: `run_cmd` uses `sh -c` which is inherently risky
   - Mitigation: Comprehensive denylist, timeouts, buffer limits
   - Future: Consider allowlist mode or containerized execution

2. **No Sandboxing**: File operations run with user's permissions
   - Mitigation: Path validation and protected path blocking
   - Future: Implement chroot or container isolation

3. **No Rate Limiting**: No built-in request throttling
   - Mitigation: Implement at API gateway or reverse proxy level
   - Future: Add token bucket rate limiter

4. **Heuristic Brain Scoring**: Without HF_TOKEN, uses simple keyword matching
   - Mitigation: Clearly documented as fallback behavior
   - Future: Integrate actual ML model scoring

## Security Best Practices for Users

1. **Run with Minimal Permissions**: Don't run as root
2. **Use Environment Variables**: Never commit `.env` files
3. **Monitor Logs**: Review console output for blocked commands
4. **Network Isolation**: Run in isolated network for sensitive work
5. **Regular Updates**: Keep dependencies updated

## Reporting Security Issues

Report security vulnerabilities privately to the repository maintainer. Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

## Security Checklist for Production

- [ ] Set strong OPENROUTER_API_KEY
- [ ] Configure firewall rules
- [ ] Enable logging/monitoring
- [ ] Set up alerting for blocked commands
- [ ] Review and customize denylist for your use case
- [ ] Consider implementing allowlist mode
- [ ] Add rate limiting at infrastructure level
- [ ] Regular security audits
