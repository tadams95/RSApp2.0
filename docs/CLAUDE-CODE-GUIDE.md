# Claude Code Workflow Guide

> Best practices for using Claude Code effectively in RAGESTATE development.

---

## Quick Reference

| Action | How |
|--------|-----|
| Start Claude Code | `claude` in terminal |
| New conversation | `/clear` |
| Save context | `/compact` |
| Get help | `/help` |
| Create commits | Ask or `/commit` |
| See token usage | `/cost` |
| Initialize project | `/init` (creates CLAUDE.md) |

---

## Key Differences from Copilot

| Aspect | GitHub Copilot | Claude Code |
|--------|----------------|-------------|
| **Interface** | IDE inline suggestions | Terminal conversation |
| **Context** | Current file + neighbors | Entire codebase on demand |
| **Capabilities** | Code completion | Full engineering tasks |
| **Execution** | Suggests code | Runs commands, edits files |
| **Multi-file** | Limited | Native support |
| **Planning** | None | Built-in plan mode |

**Bottom line**: Copilot autocompletes code. Claude Code is a collaborator that can research, plan, implement, test, and commit.

---

## Effective Prompting

### Be Specific About Scope

```
# Too vague
"Fix the auth"

# Better
"Fix the login flow - users are getting logged out after 5 minutes.
Check the token refresh logic in authService.ts"

# Best
"The JWT refresh token isn't being used to get a new access token before
expiry. Look at src/services/authService.ts and the useAuth hook.
The refresh should happen automatically when the access token has < 5 min left."
```

### State Your Intent

```
# Unclear intent
"Look at the chat implementation spec"

# Clear intent
"Read the chat implementation spec and start implementing Phase 1 -
create the TypeScript types and chat service"
```

### Provide Context When Needed

```
# If Claude doesn't know your patterns
"We use useThemedStyles for all component styling - check
src/components/feed/CommentInput.tsx for the pattern, then create
the ChatInput component following the same approach"
```

---

## Task Patterns

### 1. Research/Exploration

When you need to understand code before changing it:

```
"How does the notification system work? I need to understand
the flow from Cloud Function to the app displaying the notification."

"Find all places where we handle ticket purchases - I need to add
event chat auto-join logic."
```

Claude will use the Explore agent to search your codebase and explain.

### 2. Implementation

For building features:

```
"Implement the chat service from the spec in docs/CHAT-IMPLEMENTATION-SPEC.md.
Start with Phase 1 - types and service layer. Follow our existing patterns
in feedService.ts."
```

For complex tasks, Claude may enter **Plan Mode** to design the approach first.

### 3. Bug Fixing

```
"The feed isn't loading for new users. Error in console:
'Cannot read property map of undefined'. Debug and fix."
```

Claude will:
1. Search for the error
2. Read relevant files
3. Identify the issue
4. Propose and implement a fix

### 4. Refactoring

```
"Refactor the event detail screen to use our new useThemedStyles pattern
instead of inline styles. Keep the same visual appearance."
```

### 5. Code Review

```
"Review my changes to the auth flow. Check for security issues,
edge cases, and alignment with our patterns."
```

---

## Plan Mode

For complex tasks, Claude enters Plan Mode to design before implementing.

### When It Activates
- Multi-file changes
- Architectural decisions
- Features with multiple approaches
- Unclear requirements

### How It Works
1. Claude explores the codebase
2. Writes a plan to a file
3. Asks for your approval
4. Implements after approval

### Interacting with Plans
```
# Approve the plan
"Looks good, proceed"

# Request changes
"Use React Query instead of local state for caching"

# Ask questions
"Why did you choose approach A over B?"
```

---

## Multi-Turn Workflows

Claude maintains context across messages. Use this for iterative work:

```
You: "Create the ChatListItem component"
Claude: [creates component]

You: "Add pull-to-refresh"
Claude: [adds to same component]

You: "Now add a loading skeleton"
Claude: [adds skeleton, knows the context]

You: "Great, now create the chat list screen that uses this component"
Claude: [creates screen, imports the component it just made]
```

---

## Git Workflows

### Commits

```
# Let Claude handle it
"Commit these changes"

# Or be specific
"Commit with a message about adding the chat service layer"
```

Claude will:
1. Run `git status` and `git diff`
2. Check recent commit style
3. Create an appropriate commit message
4. Never push unless you ask

### Pull Requests

```
"Create a PR for the chat feature"
```

Claude will:
1. Analyze all commits on the branch
2. Generate a summary with test plan
3. Create the PR via `gh` CLI
4. Return the PR URL

---

## Slash Commands

| Command | Use Case |
|---------|----------|
| `/clear` | Start fresh conversation |
| `/compact` | Summarize and reduce context when running long |
| `/commit` | Quick commit workflow |
| `/help` | See all commands |
| `/cost` | Check token usage |
| `/init` | Create CLAUDE.md project context file |

---

## CLAUDE.md Project File

Create a `CLAUDE.md` in your project root with:

```markdown
# CLAUDE.md

## Project Overview
RAGESTATE - React Native event/ticketing app with social features.

## Tech Stack
- Expo / React Native
- Firebase (Auth, Firestore, Functions, Storage)
- Redux Toolkit
- React Query
- Shopify for commerce

## Key Patterns
- useThemedStyles() for component styling
- Services return Unsubscribe for real-time listeners
- Cloud Functions use v2 syntax (onDocumentCreated)
- User data spans customers + profiles collections

## File Structure
- src/services/ - Firebase operations
- src/hooks/ - React hooks
- src/components/ - Reusable components
- src/app/(app)/ - Expo Router screens
- functions/ - Cloud Functions

## Commands
- npm start - Start Expo
- npm run ios - iOS simulator
- npm run android - Android emulator
- cd functions && npm run deploy - Deploy Cloud Functions
```

Claude reads this automatically for project context.

---

## Parallel Operations

Claude can run multiple operations simultaneously:

```
"Run the TypeScript check, ESLint, and tests in parallel"
```

For research:
```
"Search for all uses of 'expoPushToken' and 'notificationService'
at the same time"
```

---

## Background Tasks

For long-running operations:

```
"Run the full test suite in the background while I continue working"
```

Claude will notify you when complete.

---

## When to Use What

| Task | Approach |
|------|----------|
| Quick file read | Ask Claude directly |
| Find a specific function | Ask Claude to search |
| Understand a system | "Explore how X works" |
| Implement a feature | Provide spec or describe clearly |
| Multi-file refactor | Let Claude use Plan Mode |
| Debug an error | Paste the error, let Claude investigate |
| Code review | "Review my changes to X" |
| Git operations | Ask for commit/PR or use slash commands |

---

## Tips for Max Plan

With Max, you have higher limits. Take advantage of:

1. **Longer sessions** - Work through entire features without context limits
2. **More exploration** - Let Claude thoroughly understand before implementing
3. **Parallel agents** - Run multiple search/exploration tasks simultaneously
4. **Comprehensive reviews** - Ask for thorough code reviews

---

## Common Mistakes to Avoid

### 1. Being Too Vague
```
# Bad
"Make it better"

# Good
"Improve the error handling in authService - add specific error
messages for token expiry vs network failures"
```

### 2. Not Providing Error Context
```
# Bad
"It's broken"

# Good
"Getting 'TypeError: Cannot read property 'uid' of null' when
opening the profile screen. Here's the stack trace: ..."
```

### 3. Asking Without Reading First
```
# Bad
"Change the function in that file"

# Good
"Change the getUserProfile function in src/services/userService.ts
to also fetch the user's event history"
```

### 4. Not Reviewing Changes
Always review what Claude produces. It's a collaborator, not a replacement for your judgment.

---

## Example Session

```
You: "I need to add a dark mode toggle to settings"

Claude: [Enters plan mode, explores theme system, proposes approach]

You: "Use AsyncStorage for persistence, not Redux"

Claude: [Updates plan]

You: "Approved, implement it"

Claude: [Creates toggle component, updates theme context, adds persistence]

You: "Test it - toggle should persist across app restarts"

Claude: [Describes how to test, or runs automated tests if available]

You: "Looks good, commit it"

Claude: [Creates commit with appropriate message]
```

---

## Quick Wins

Things Claude Code excels at:

- **"Find all TODOs in the codebase"** - Quick search across all files
- **"What does this regex do?"** - Explain complex code
- **"Convert this to TypeScript"** - Language/syntax transformations
- **"Add error handling to this function"** - Targeted improvements
- **"Create a hook that does X like our other hooks"** - Pattern replication
- **"Write tests for this service"** - Test generation
- **"Update all imports after I moved this file"** - Tedious refactors

---

## Getting Help

- `/help` - In-app command reference
- `claude --help` - CLI options
- Issues: https://github.com/anthropics/claude-code/issues

---

*Last updated: January 2026*
