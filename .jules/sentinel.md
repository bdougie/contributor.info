## 2024-05-23 - Critical Inngest Authentication Bypass
**Vulnerability:** The Inngest webhook handler was initialized with `signingKey: undefined`, explicitly disabling signature verification.
**Learning:** Security controls can be accidentally disabled during debugging and left in that state if not properly reviewed.
**Prevention:** Never commit code that disables security controls. Use environment variables for configuration. Add automated checks for security configuration in critical files.
