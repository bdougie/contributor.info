# Triager Guide

## How do I Join the Triage Team?
1. Sign up for [contributor.info](https://contributor.info)
2. Leave a comment in the [discord](https://discord.com/channels/714698561081704529/928693344358514698) channel `🌱contributor-chat`.

## Issue Triage Process

When a new issue or pull request is opened the issue will be labeled with `needs triage`. If a triage team member is available they can help make sure all the required information is provided. Depending on the issue or PR there are several next labels they can add for further classification:

- `needs triage`: This can be kept if the triager is unsure which next steps to take
- `awaiting more info`: If more info has been requested from the author, apply this label.
- `question`: User questions that do not appear to be bugs or enhancements.
- `discuss`: Topics for discussion. Might end in an `enhancement` or `question` label.
- `bug`: Issues that present a reasonable conviction there is a reproducible bug.
- `enhancement`: Issues that are found to be a reasonable candidate feature additions.
- `style`: small css or visual changes.

In all cases, issues may be closed by maintainers if they don't receive a timely response when further information is sought, or when additional questions are asked.

## Approaches and Best Practices for getting into triage contributions

Review the project's contribution guideline if present. In a nutshell, commit to the community's standards and values. Review the documentation, for most of the projects it is just the README.md, and make sure you understand the key APIs, semantics, configurations, and use cases.

It might be helpful to write your own test apps to re-affirm your understanding of the key functions. This may identify some gaps in documentation, record those as they might be good PR's to open. Skim through the issue backlog; identify low hanging issues and mostly new ones. From those, attempt to recreate issues based on the OP description and ask questions if required. No question is a bad question!

## Removal of Triage Role

There are a few cases where members can be removed as triagers:

- Breaking the [CoC](/CODE_OF_CONDUCT.md) or [project contributor guidelines](/CONTRIBUTING.md)
- Abuse or misuse of the role as deemed by the TC
- Lack of participation for more than 6 months

If any of these happen we will discuss as a part of the triage portion of the regular TC meetings. If you have questions feel free to reach out to any of the TC members.

## Reviewing Pull Requests
- Checkout out preview or staging URLs on your device. If there are visual changes, check on multiple browsers
- If reviewing code, avoid linting. Instead request the contributor run `npm run format`
- Avoid condescending questions, i.e "Why didn't you did this?" Instead "Can you explain how does this works?"
- Always leave positive feedback and celebrate work completed. 
 
## Other Helpful Hints:

- When reviewing the list of open issues there are some common types and suggested actions:
  - New/unattended issues or simple questions: A good place to start
  - Hard bugs & ongoing discussions: always feel free to chime in and help
  - Issues that imply gaps in documentation: open PRs with changes or help the user to do so
- For recurring issues, it is helpful to create functional examples to demonstrate (publish as gists or a repo)
- Review and identify the maintainers. If necessary, at-mention one or more of them if you are unsure what to do
- Make sure all your interactions are professional, welcoming and respectful to the parties involved.
