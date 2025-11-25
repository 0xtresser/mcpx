# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.x.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT** open a public issue
2. Email the maintainers directly or use GitHub's private vulnerability reporting feature
3. Include as much detail as possible:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will acknowledge receipt within 48 hours and provide a detailed response within 7 days.

## Security Best Practices for Users

### Private Keys

- **NEVER** commit private keys to version control
- Use environment variables for sensitive data
- See `.env.example` for required variables
- Consider using a secrets manager in production

### Payment Security

- Always verify payment settlements in production
- Implement proper error handling for `payThenService` mode
- Monitor for failed settlements and implement retry/reconciliation logic
- Use testnet for development (`base-sepolia`, `solana-devnet`)

### Network Security

- Use HTTPS in production
- Validate all input from clients
- Implement rate limiting for payment endpoints
- Keep dependencies updated

## Disclosure Policy

We follow responsible disclosure:

1. Reporter submits vulnerability privately
2. We confirm and assess the issue
3. We develop and test a fix
4. We release the fix and publish an advisory
5. Reporter may be credited (with permission)

