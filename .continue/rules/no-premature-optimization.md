---
globs: "**/*"
description: Prevents premature optimization and ensures performance
  improvements are validated
---

Avoid complex edge case optimizations or micro-optimizations unless there's a demonstrated performance need. If implementing performance optimizations, always include tests or benchmarks that verify the optimization actually improves performance. Prioritize code clarity and maintainability over theoretical performance gains.