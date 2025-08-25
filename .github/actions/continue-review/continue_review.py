#!/usr/bin/env python3
"""
Continue Review Agent - AI-powered code review for GitHub Pull Requests
This script is called by the Continue review GitHub Action.
"""

import os
import json
import sys
import subprocess
import tempfile
import re
import glob
from datetime import datetime
from pathlib import Path
from github import Github

print("=== Continue Review Agent Starting ===")

# Get environment variables
github_token = os.environ.get('GITHUB_TOKEN')
continue_api_key = os.environ.get('CONTINUE_API_KEY')
continue_org = os.environ.get('CONTINUE_ORG')
continue_config = os.environ.get('CONTINUE_CONFIG')

print("Continue Org: %s" % continue_org)
print("Continue Config: %s" % continue_config)
print("API Key present: %s" % bool(continue_api_key))

# Validate required parameters
if not continue_api_key:
    print("ERROR: CONTINUE_API_KEY is required but not set")
    sys.exit(1)
if not continue_org:
    print("ERROR: continue-org parameter is required but not set")
    sys.exit(1)
if not continue_config:
    print("ERROR: continue-config parameter is required but not set")
    sys.exit(1)
if not github_token:
    print("ERROR: GITHUB_TOKEN is required but not set")
    sys.exit(1)

# Get GitHub context (handles base64 encoding to avoid shell escaping issues)
import base64

github_context = {}
context_b64 = os.environ.get('GITHUB_CONTEXT_B64')
if context_b64:
    try:
        context_json = base64.b64decode(context_b64).decode('utf-8')
        github_context = json.loads(context_json)
    except Exception as e:
        print("Warning: Could not decode base64 GitHub context: %s" % str(e))
        github_context = json.loads(os.environ.get('GITHUB_CONTEXT', '{}'))
else:
    github_context = json.loads(os.environ.get('GITHUB_CONTEXT', '{}'))

repo_name = github_context.get('repository', '')
event_name = github_context.get('event_name', '')

print("Repository: %s" % repo_name)
print("Event type: %s" % event_name)

# Get PR number and check for command
pr_number = None
command = None

try:
    if event_name == 'pull_request':
        pr_number = github_context.get('event', {}).get('pull_request', {}).get('number')
    elif event_name == 'issue_comment':
        pr_number = github_context.get('event', {}).get('issue', {}).get('number')
        # Extract command if present
        comment_body = github_context.get('event', {}).get('comment', {}).get('body', '')
        if '@continue-agent' in comment_body:
            # Extract everything after @continue-agent as the command
            parts = comment_body.split('@continue-agent', 1)
            if len(parts) > 1:
                command = parts[1].strip()
                print("Command detected: %s" % command)
    elif event_name == 'workflow_dispatch':
        pr_number = github_context.get('event', {}).get('inputs', {}).get('pr_number')
        if pr_number:
            pr_number = int(pr_number)  # Ensure it's an integer
except (ValueError, TypeError) as e:
    print("Error parsing PR number: %s" % str(e))
    sys.exit(1)

if not pr_number:
    print("ERROR: No valid PR number found in context")
    print("Event name: %s" % event_name)
    print("Context keys: %s" % str(github_context.keys()))
    sys.exit(0)

# Validate PR number
if not isinstance(pr_number, int) or pr_number <= 0:
    print("ERROR: Invalid PR number: %s" % pr_number)
    sys.exit(1)

print("PR Number: %s" % pr_number)

# Constants for comment management
COMMENT_MARKER = "<!-- continue-agent-review -->"
PROGRESS_MARKER = "<!-- continue-agent-in-progress -->"

# Function to find existing comment
def find_existing_comment(pr, marker):
    for comment in pr.get_issue_comments():
        if marker in comment.body:
            return comment
    return None

# Function to load Continue rules
def load_continue_rules():
    rules = []
    rules_dir = Path('.continue/rules')
    if not rules_dir.exists():
        print("INFO: No .continue/rules directory found")
        return rules
    
    print("INFO: Loading rules from %s" % rules_dir)
    rule_files = list(rules_dir.glob('*.md'))
    print("INFO: Found %d rule files" % len(rule_files))
    
    for rule_file in rule_files:
        try:
            print("DEBUG: Processing rule file: %s" % rule_file.name)
            with open(rule_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            if not content.strip():
                print("WARNING: Empty rule file: %s" % rule_file.name)
                continue
                
            # Parse frontmatter
            frontmatter = {}
            rule_content = content
            
            if content.startswith('---'):
                parts = content.split('---', 2)
                if len(parts) >= 3:
                    frontmatter_text = parts[1].strip()
                    rule_content = parts[2].strip()
                    
                    # Parse YAML-like frontmatter more robustly
                    for line in frontmatter_text.split('\n'):
                        if ':' in line and not line.strip().startswith('#'):
                            key, value = line.split(':', 1)
                            key = key.strip()
                            value = value.strip().strip('"').strip("'")
                            frontmatter[key] = value
                            if len(value) > 50:
                                print("DEBUG: Parsed %s: %s..." % (key, value[:50]))
                            else:
                                print("DEBUG: Parsed %s: %s" % (key, value))
            
            rule_data = {
                'file': rule_file.name,
                'globs': frontmatter.get('globs', ''),
                'description': frontmatter.get('description', rule_file.stem.replace('-', ' ').title()),
                'alwaysApply': frontmatter.get('alwaysApply', 'true').lower() != 'false',
                'content': rule_content  # Keep full content for accurate reviews
            }
            rules.append(rule_data)
            if rule_data['globs']:
                print("SUCCESS: Loaded rule: %s (alwaysApply=%s, globs=%s...)" % (rule_file.name, rule_data['alwaysApply'], rule_data['globs'][:30]))
            else:
                print("SUCCESS: Loaded rule: %s (alwaysApply=%s)" % (rule_file.name, rule_data['alwaysApply']))
            
        except Exception as e:
            print("ERROR: Failed to load rule %s: %s" % (rule_file.name, str(e)))
            import traceback
            print("DEBUG: Traceback: %s" % traceback.format_exc())
    
    print("INFO: Successfully loaded %d rules" % len(rules))
    return rules

# Function to match file patterns
def matches_pattern(filename, pattern):
    if not pattern or not filename:
        return False
    
    try:
        # Use fnmatch for simpler patterns
        import fnmatch
        
        # Handle brace expansion patterns like {tsx,jsx}
        if '{' in pattern and '}' in pattern:
            # Extract the brace content
            import re as regex
            brace_match = regex.search(r'\{([^}]+)\}', pattern)
            if brace_match:
                options = brace_match.group(1).split(',')
                base_pattern = pattern[:brace_match.start()] + '{}' + pattern[brace_match.end():]
                for option in options:
                    test_pattern = base_pattern.format(option.strip())
                    if fnmatch.fnmatch(filename, test_pattern):
                        return True
                return False
        
        # Standard glob matching
        return fnmatch.fnmatch(filename, pattern)
        
    except Exception as e:
        print("Warning: Pattern matching error for '%s': %s" % (pattern, str(e)))
        # Fallback to simple string matching
        return pattern in filename

try:
    # Initialize GitHub client with retry
    print("INFO: Connecting to GitHub API for %s" % repo_name)
    try:
        g = Github(github_token, retry=3, timeout=30)
        repo = g.get_repo(repo_name)
        pr = repo.get_pull(pr_number)
    except Exception as api_error:
        print("ERROR: Failed to connect to GitHub API: %s" % str(api_error))
        print("DEBUG: Repository: %s, PR: %s" % (repo_name, pr_number))
        raise
    
    print("SUCCESS: Connected to PR #%s" % pr_number)
    print("INFO: PR Title: %s" % pr.title)
    print("INFO: PR State: %s" % pr.state)
    
    # Validate PR state
    if pr.state == 'closed':
        print("WARNING: PR #%s is closed, but continuing review..." % pr_number)
    
    # Check for existing review comment
    existing_comment = find_existing_comment(pr, COMMENT_MARKER)
    
    # Find previous reviews to track progress
    previous_reviews = []
    review_history = ""
    if existing_comment:
        # Extract previous review points from existing comment
        if "### Previous Feedback" in existing_comment.body:
            # Parse previous feedback section
            lines = existing_comment.body.split('\n')
            in_feedback = False
            for line in lines:
                if line.startswith("### Previous Feedback"):
                    in_feedback = True
                    review_history = "### Previous Feedback\n"
                elif in_feedback and line.startswith("###"):
                    break
                elif in_feedback and (line.startswith("- ✅") or line.startswith("- ⚠️") or line.startswith("- ❌")):
                    previous_reviews.append(line)
    
    # Post initial progress comment
    progress_body = COMMENT_MARKER + "\n"
    progress_body += "## 🤖 Continue Agent Review\n\n"
    progress_body += "🔄 **Review in progress...** \n\n"
    progress_body += "I'm analyzing the changes in this pull request. This may take a moment.\n\n"
    progress_body += "### What I'm checking:\n"
    progress_body += "- 📝 Code quality and best practices\n"
    progress_body += "- 🐛 Potential bugs or logic errors\n"
    progress_body += "- 🔒 Security vulnerabilities\n"
    progress_body += "- ⚡ Performance implications\n"
    progress_body += "- 📚 Compliance with project rules\n\n"
    if review_history:
        progress_body += review_history + "\n\n"
    progress_body += "---\n"
    progress_body += "*This comment will be updated with the review results shortly...*"
    
    if existing_comment:
        existing_comment.edit(progress_body)
        print("Updated existing comment with progress indicator")
    else:
        existing_comment = pr.create_issue_comment(progress_body)
        print("Created progress comment ID: %s" % existing_comment.id)
    
    # Load Continue rules
    rules = load_continue_rules()
    print("Loaded %d rules" % len(rules))
    
    # Get PR diff and track filenames
    files = pr.get_files()
    diff_content = []
    file_count = 0
    changed_files = []
    
    for file in files:
        file_count += 1
        changed_files.append(file.filename)
        if file.patch:
            diff_content.append("=== File: %s ===\n%s" % (file.filename, file.patch))
    
    print("Files changed: %d" % file_count)
    
    # Find applicable rules
    applicable_rules = []
    for rule in rules:
        # Check if rule always applies
        if rule['alwaysApply']:
            # Skip rules that are marked as alwaysApply: false
            if rule['description'] not in ['Generate the PRD spec', 'Generate tasks for the agent to complete.', 'Instructions on how to complete tasks']:
                applicable_rules.append(rule)
                print("Rule '%s' always applies" % rule['file'])
        # Check if rule matches any changed files
        elif rule['globs']:
            for filename in changed_files:
                if matches_pattern(filename, rule['globs']):
                    if rule not in applicable_rules:
                        applicable_rules.append(rule)
                        print("Rule '%s' applies to %s" % (rule['file'], filename))
                    break
    
    print("Found %d applicable rules" % len(applicable_rules))
    
    if not diff_content:
        print("No changes to review")
        sys.exit(0)
    
    full_diff = "\n\n".join(diff_content)
    diff_size = len(full_diff)
    print("Diff size: %d characters" % diff_size)
    
    # Truncate if too large
    max_diff_size = 12000
    if diff_size > max_diff_size:
        full_diff = full_diff[:max_diff_size] + "\n\n... (diff truncated)"
    
    # Build rules section for the prompt
    rules_section = ""
    if applicable_rules:
        rules_section = "\n\n## Project-Specific Rules to Apply\n\n"
        rules_section += "The following project-specific rules should be considered in this review:\n\n"
        for rule in applicable_rules:
            rules_section += "### %s\n" % (rule['description'] or rule['file'])
            rules_section += "%s\n\n" % rule['content']
    
    # Create review prompt with optional command
    if command:
        review_prompt = """You are reviewing a pull request. The user has provided a specific request: "%s""" % command

Pull Request Information
- Title: {pr.title}
- Description: {pr.body or 'No description provided'}
- Files changed: {file_count}
- Repository: {repo_name}

User Request
{command}

Please address the user's specific request while reviewing the code changes below.
{rules_section}
Code Changes
{full_diff}

Your Review
Please provide a review that addresses the user's request: {command}"""
    else:
        review_prompt = """You are reviewing a pull request. Please provide constructive feedback.

Pull Request Information
- Title: {pr.title}
- Description: {pr.body or 'No description provided'}
- Files changed: {file_count}
- Repository: {repo_name}

Review Guidelines
Please focus on:
1. Code quality and best practices
2. Potential bugs or logic errors
3. Security vulnerabilities
4. Performance implications
5. Code clarity and maintainability
6. Missing edge cases or error handling

If the code looks good, acknowledge that as well. Be specific and actionable in your feedback.
{rules_section}
Code Changes
{full_diff}

Your Review
Please provide a comprehensive code review for this pull request."""

    # Write prompt to file for Continue CLI
    with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
        f.write(review_prompt)
        prompt_file = f.name
    
    print("Prompt written to: %s" % prompt_file)
    
    # Call Continue CLI
    print("Calling Continue CLI for review...")
    print("Using Continue config: %s" % continue_config)
    
    # Read the prompt content for direct passing
    with open(prompt_file, 'r') as f:
        prompt_content = f.read()
    
    # Set up environment for Continue CLI
    env = os.environ.copy()
    env['CONTINUE_API_KEY'] = continue_api_key
    
    # Build the command - try the simplest format first
    cmd = ['cn', '--config', continue_config]
    
    try:
        print("INFO: Starting Continue CLI subprocess...")
        print("INFO: Prompt length: %d characters" % len(prompt_content))
        print("INFO: Command: %s" % ' '.join(cmd))
        
        # Pass the prompt via stdin
        result = subprocess.run(
            cmd,
            input=prompt_content,
            capture_output=True,
            text=True,
            env=env,
            timeout=120  # Increased timeout for larger reviews
        )
        
        print("INFO: Continue CLI exit code: %d" % result.returncode)
        
        if result.stdout:
            print("DEBUG: CLI stdout length: %d chars" % len(result.stdout))
        if result.stderr:
            print("WARNING: CLI stderr: %s" % result.stderr[:500])
        
        if result.returncode == 0:
            # Get the plain text response
            review_text = result.stdout.strip()
            
            # Try to parse as JSON and extract content if it's JSON
            try:
                response = json.loads(review_text)
                # Extract the actual review content from JSON structure
                if isinstance(response, dict):
                    review_text = response.get('response', response.get('content', response.get('message', str(response))))
            except (json.JSONDecodeError, ValueError):
                # It's already plain text, use as-is
                pass
            
            # Clean up any remaining JSON artifacts
            if review_text.startswith('{') and review_text.endswith('}'):
                try:
                    parsed = json.loads(review_text)
                    if isinstance(parsed, dict) and len(parsed) == 1:
                        review_text = str(list(parsed.values())[0])
                except:
                    pass
            
            if not review_text or review_text.strip() == '':
                review_text = "The Continue service returned an empty response. Please check the configuration."
            
            print("Review generated successfully")
        else:
            print("ERROR: Continue CLI failed with exit code %d" % result.returncode)
            error_msg = result.stderr or result.stdout or 'Unknown error'
            print("Error output: %s" % error_msg[:1000])
            
            # Try to provide more helpful error messages
            if "not found" in error_msg.lower() or result.returncode == 127:
                review_text = "Continue CLI is not properly installed. Please ensure @continuedev/cli is installed globally."
            elif "config" in error_msg.lower() or "assistant" in error_msg.lower():
                review_text = "Continue configuration error. Please verify that the assistant '%s' exists in Continue Hub." % continue_config
            elif "api" in error_msg.lower() or "auth" in error_msg.lower():
                review_text = "Continue API authentication failed. Please check your CONTINUE_API_KEY."
            else:
                review_text = "Failed to generate review. Continue CLI error:\n```\n%s\n```" % error_msg
            
    except subprocess.TimeoutExpired:
        print("Continue CLI timed out")
        review_text = "Review generation timed out. The diff may be too large or the service may be slow."
    except FileNotFoundError:
        print("Continue CLI not found")
        review_text = "Continue CLI is not installed or not in PATH. Please ensure @continuedev/cli is installed."
    except Exception as e:
        print("Error calling Continue CLI: %s" % str(e))
        review_text = "Error calling Continue service: %s" % str(e)
    
    finally:
        # Clean up temp file
        try:
            os.unlink(prompt_file)
        except:
            pass
    
    # Analyze review for tracking points
    review_points = []
    if "✅" in review_text or "looks good" in review_text.lower() or "well done" in review_text.lower():
        has_positive = True
    else:
        has_positive = False
    
    # Check if previous issues were addressed
    progress_summary = ""
    if previous_reviews and len(previous_reviews) > 0:
        resolved_count = 0
        pending_count = 0
        for prev_item in previous_reviews:
            # More sophisticated heuristic for tracking progress
            if "❌" in prev_item:
                # Check if the issue keywords are still present in new review
                issue_keywords = ["error", "issue", "problem", "fail", "incorrect", "wrong"]
                if has_positive or not any(kw in review_text.lower() for kw in issue_keywords):
                    resolved_count += 1
                else:
                    pending_count += 1
            elif "⚠️" in prev_item:
                # Warnings might still be relevant
                if "warning" not in review_text.lower() and "consider" not in review_text.lower():
                    resolved_count += 1
                else:
                    pending_count += 1
        
        if resolved_count > 0 or pending_count > 0:
            progress_summary = "### Progress Update\n"
            if resolved_count > 0:
                progress_summary += "✅ **%d previous issue(s) appear to be resolved!**\n" % resolved_count
            if pending_count > 0:
                progress_summary += "⚠️ %d item(s) may still need attention\n" % pending_count
    
    # Extract key points from current review for future tracking
    current_feedback = []
    if "error" in review_text.lower() or "issue" in review_text.lower() or "problem" in review_text.lower():
        current_feedback.append("- ❌ Issues identified that need addressing")
    if "warning" in review_text.lower() or "consider" in review_text.lower() or "suggest" in review_text.lower():
        current_feedback.append("- ⚠️ Suggestions for improvement")
    if "good" in review_text.lower() or "excellent" in review_text.lower() or "well" in review_text.lower():
        current_feedback.append("- ✅ Good practices identified")
    
    # Build final comment with proper markdown formatting
    comment_body = COMMENT_MARKER + "\n"
    comment_body += "## 🤖 Continue Agent Review\n\n"
    
    if command:
        comment_body += "**Responding to:** `@continue-agent %s`\n\n" % command
    else:
        comment_body += "**✅ Review Complete**\n\n"
    
    if progress_summary:
        comment_body += progress_summary + "\n\n"
    
    comment_body += "### Current Review\n\n"
    comment_body += review_text + "\n\n"
    
    if previous_reviews:
        comment_body += "### Previous Feedback\n"
        comment_body += "\n".join(previous_reviews) + "\n\n"
    
    if current_feedback:
        comment_body += "### Current Feedback Summary\n"
        comment_body += "\n".join(current_feedback) + "\n\n"
    
    comment_body += "---\n"
    comment_body += "*Last updated: %s | Powered by [Continue](https://continue.dev)*" % datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')
    
    # Update the existing comment
    print("Updating comment with review...")
    if existing_comment:
        existing_comment.edit(comment_body)
        print("Updated comment ID: %s" % existing_comment.id)
    else:
        # Fallback if somehow the comment was deleted
        comment = pr.create_issue_comment(comment_body)
        print("Created new comment ID: %s" % comment.id)
    
except Exception as e:
    print("Error during review: %s" % str(e))
    import traceback
    print("Traceback: %s" % traceback.format_exc())
    
    # Try to update comment with error
    try:
        error_body = COMMENT_MARKER + "\n"
        error_body += "## ❌ Continue Review Error\n\n"
        error_body += "Failed to complete review:\n"
        error_body += "```\n"
        error_body += str(e) + "\n"
        error_body += "```\n\n"
        error_body += "### Please check:\n"
        error_body += "1. CONTINUE_API_KEY is set correctly\n"
        error_body += "2. Continue CLI is installed\n"
        error_body += "3. Workflow logs for details\n\n"
        error_body += "---\n"
        error_body += "*Error occurred at: %s*" % datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')
        
        if 'existing_comment' in locals() and existing_comment:
            existing_comment.edit(error_body)
            print("Updated comment with error")
        else:
            g = Github(github_token)
            repo = g.get_repo(repo_name)
            pr = repo.get_pull(pr_number)
            pr.create_issue_comment(error_body)
            print("Error comment posted")
    except:
        print("Failed to post error comment")
    
    sys.exit(1)

print("=== Continue Review Agent Completed ===")