---
globs: "**/*.{ts,tsx,js,jsx}"
description: Prevent security vulnerabilities in console.log statements
---

# Console.log Security

Never use template literals with console.log as they can create security vulnerabilities through log injection attacks. Always use printf-style formatting with `%s` placeholders.

## Security Issue

Template literals in console.log can allow attackers to inject malicious content into logs, potentially leading to log forging or command injection in log processing systems.

## Examples

❌ **VULNERABLE - Never do this:**
```javascript
console.log(`User ${username} logged in`);
console.log(`Processing request for ${owner}/${repo}`);
```

✅ **SECURE - Always use this pattern:**
```javascript
console.log('User %s logged in', username);
console.log('Processing request for %s/%s', owner, repo);
```

## Why This Matters

If `username` contains special characters or ANSI escape sequences, it could:
- Forge log entries that appear legitimate
- Hide malicious activity in logs
- Potentially execute commands if logs are processed by vulnerable systems

Always use the printf-style formatting to ensure user input is properly escaped and sanitized.