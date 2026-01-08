# GitHub Copilot Workflow Guide

> **Purpose**: Maximize efficiency and effectiveness when working with GitHub Copilot on the RS App project  
> **Last Updated**: January 7, 2026  
> **Owner**: You (reference guide for ongoing development)

---

## Table of Contents

1. [Prompting Best Practices](#prompting-best-practices)
2. [VSCode Configuration](#vscode-configuration)
3. [Context & Attachments](#context--attachments)
4. [Workflow Patterns](#workflow-patterns)
5. [File Operation Strategies](#file-operation-strategies)
6. [Project-Specific Context](#project-specific-context)
7. [Common Request Types](#common-request-types)

---

## Prompting Best Practices

### Structure: The 3-Part Framework

Use this mental model when formulating requests:

```
1. WHAT: What needs to be done? (Clear, specific outcome)
2. CONTEXT: What files/components are affected? (Link to relevant code)
3. CONSTRAINTS: What guidelines/patterns should I follow? (Your standards)
```

**Example - Good**:

```
I need to add a new component called SocialLinksRow that displays
social media icons in the profile header. It should:
- Display icons for X, Instagram, TikTok (only if links exist)
- Use MaterialCommunityIcons like the existing ProfileHeader
- Open URLs in browser/native app on tap
- Fire PostHog event 'social_link_tapped' on tap

Look at ProfileHeader.tsx for styling reference and useSoundCloudPlayer
for the analytics pattern.
```

**Example - Less Effective**:

```
Create a social links component
```

### Specificity Levels

- **🔴 Too vague**: "Fix the profile" (which part? what issue?)
- **🟡 Better**: "Add validation error styling to the phone input in EditProfile"
- **🟢 Best**: "The phone input in EditProfile.tsx (lines 600-620) needs a red border when validation fails. Reference the firstName input error styling at line 480."

### Include Line Numbers When Referencing Code

When you want me to update specific code:

```
In ProfileHeader.tsx, update the renderLocation section (lines 120-130) to...
```

Rather than:

```
Update the location rendering to...
```

### Be Explicit About File Operations

- **For edits**: "Replace lines 450-480 in EditProfile.tsx with..."
- **For new files**: "Create src/utils/socialLinks.ts with..."
- **For multiple changes**: "Make these changes:
  1. Add X field to UserData interface in auth.ts
  2. Update EditProfile to handle X field
  3. Create validation utility in utils/X.ts"

### When to Ask vs. Implement

Ask me to **create specs/docs** when you're:

- Unsure about architecture
- Exploring multiple approaches
- Planning a complex feature

Ask me to **implement code** when you're:

- Ready to code
- Have clear requirements
- Want to see working examples

---

## VSCode Configuration

### Recommended Settings for Copilot Integration

Add to your `.vscode/settings.json`:

```json
{
  // Editor behavior
  "editor.codeActionsOnSave": {
    "source.fixAll": true,
    "source.organizeImports": true
  },
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",

  // TypeScript/JavaScript
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "javascript.validate.enable": true,
  "typescript.preferences.importModuleSpecifierFormat": "relative",

  // Search and navigation (helpful for context)
  "search.smartCase": true,
  "search.exclude": {
    "**/node_modules": true,
    "**/.expo": true,
    "**/dist": true
  },

  // Copilot-specific
  "github.copilot.enable": {
    "*": true,
    "plaintext": true,
    "markdown": false
  },

  // File associations for better intellisense
  "files.associations": {
    "*.ts": "typescript",
    "*.tsx": "typescriptreact"
  }
}
```

### Essential VSCode Extensions

- **GitHub Copilot** (obviously)
- **TypeScript Vue Plugin** - better TS support
- **Prettier** - consistent formatting
- **ESLint** - catch errors early
- **GitLens** - understand code history
- **Expo Tools** - React Native development
- **Firebase Explorer** - visualize Firestore

### Keyboard Shortcuts Worth Knowing

| Action             | Shortcut      | Use Case                     |
| ------------------ | ------------- | ---------------------------- |
| Open Copilot Chat  | `⌘+I` (macOS) | Ask questions inline         |
| Ask Copilot inline | `⌘+Option+I`  | Quick questions without chat |
| Go to Definition   | `⌘+Click`     | Navigate to referenced code  |
| Find References    | `⌘+Shift+H`   | See where code is used       |
| Command Palette    | `⌘+Shift+P`   | Run tasks, formatting, etc.  |

---

## Context & Attachments

### When to Use Attachments

**Attach a file when**:

- You want me to work with the current state of a file
- The file has recent edits you want me to see
- You're showing me a reference implementation
- The file is the "source of truth" for how things currently work

**How to attach**:

```
You're working on file X in VSCode →
Open the attachment icon in chat →
Select the file →
It appears in context
```

**Pro Tip**: Attach the file you're currently editing at the start of a session so I have the latest state.

### Building Context Efficiently

**Bad**: Make me search for everything

```
Update the profile component to add social links
```

**Good**: Give me a quick context dump

```
I'm working on ProfileHeader.tsx which displays:
- Avatar (100x100)
- Display name + verification badge
- Bio + location
- Action buttons + stats

Currently takes props: profile (UserData), isOwnProfile (bool), callbacks

I need to add a SocialLinksRow between location and action buttons.
```

**Best**: Link directly to the code

```
In src/components/profile/ProfileHeader.tsx (lines 120-160),
I need to add social media icons after the location row.
```

### Repository Context

I already know:

- ✅ Project structure (React Native, Expo, Firebase, TypeScript)
- ✅ Your current branch (master)
- ✅ Design system (GlobalStyles, color scheme)
- ✅ Data models (UserData interface, Firestore collections)
- ✅ Existing patterns (hooks, services, components)

You don't need to explain these unless they've changed.

---

## Workflow Patterns

### Pattern 1: Specs First, Code Second

**When starting a major feature**:

1. **Request a spec** with architecture, data models, components

```
Scope out a solution for [feature] that:
- Describes the UX
- Lists components needed
- Shows data structure
- Includes implementation phases
```

2. **Review the spec** - ask clarifying questions
3. **Request implementation** of one phase at a time

```
Implement Phase 1 of the [feature] spec:
- Create [component]
- Update [file] to include [field]
- Add [hook]
```

### Pattern 2: Isolated Component Development

**When building a new component**:

1. Start with the component file only
2. Get the basic structure working
3. Then integrate into parent component
4. Finally add validation/error handling

```
Create src/components/profile/SocialLinksRow.tsx:
- Takes socialLinks object as prop
- Renders icon buttons for each link
- No validation yet, just display
```

### Pattern 3: Bug Fix + Context

**When fixing a bug**:

```
Bug: [Specific behavior that's wrong]
Expected: [What should happen]
Current code: [Relevant snippet or link]
Reference: [Similar working code]

Fix in [file]:
```

### Pattern 4: Batch Related Changes

**Instead of**:

```
Update EditProfile to add X field
Update UserData interface to add X field
Create validation for X field
```

**Try**:

```
Add social links support:
1. Update UserData interface in src/utils/auth.ts to include tiktok
2. Add TikTok input to EditProfile.tsx (after Instagram input)
3. Add TikTok validation to src/utils/socialLinks.ts

Use consistent styling with existing social inputs.
```

---

## File Operation Strategies

### Strategy 1: Read Before Edit

Always provide context when editing:

```
In ProfileHeader.tsx, the location row is at lines 120-130.
Add social links row right after it at line 131.
```

This helps me ensure proper indentation and context.

### Strategy 2: Use Attachments for Current State

When working on an actively-edited file:

1. Attach it at the start of the chat
2. Let me read its current state
3. Then request changes

### Strategy 3: Group Related Files

When multiple files need changes:

```
Make these updates together:
1. File A: Add interface
2. File B: Use interface
3. File C: Implement logic
```

I can batch these more efficiently than sequential requests.

### Strategy 4: Reference Patterns, Not Just Individual Files

```
For validation, follow the pattern used in:
- EditProfile.tsx (lines 200-250) - form validation
- soundcloud.ts (lines 60-100) - URL validation
```

---

## Project-Specific Context

### Key Files to Know

| File                                       | Purpose                | Key Info                          |
| ------------------------------------------ | ---------------------- | --------------------------------- |
| `src/utils/auth.ts`                        | UserData interface     | Source of truth for user shape    |
| `src/components/profile/ProfileHeader.tsx` | Profile display        | Design patterns, styling          |
| `src/components/modals/EditProfile.tsx`    | Edit form              | Form validation, submission       |
| `src/constants/styles.tsx`                 | GlobalStyles           | Colors, spacing, typography       |
| `src/hooks/SoundCloudPlayerContext.tsx`    | Audio playback         | WebView pattern, state management |
| `src/utils/soundcloud.ts`                  | SoundCloud integration | oEmbed, validation patterns       |

### Design Patterns in Use

1. **Hooks for state** - useSoundCloudPlayer, useSoundCloudTrack
2. **Services for data** - feedService, notificationManager
3. **React Query** - useQuery for data fetching
4. **Firestore** - collections: customers, profiles, posts, follows
5. **PostHog** - analytics tracking throughout
6. **WebView** - for embeds (SoundCloud widget)

### Data Flow

```
User Action → Hook/Service → Firestore/API → Component Update → PostHog Track
```

### Color System

Reference `GlobalStyles.colors`:

```typescript
redVivid5: "#FF0000"  // Primary action/accent
grey1-8: spectrum from black to light grey
accent: secondary color
```

---

## Common Request Types

### Request Type 1: "Scope Out a Feature"

**Best for**: Planning and understanding complexity

```
Scope out a solution for [feature] into spec documents that describe:
- User experience and visual design
- Data model changes needed
- Components to build
- Implementation phases with checklists
- Integration points with existing code
```

**Gives you**: Architecture, effort estimate, clear roadmap

### Request Type 2: "Implement This Phase"

**Best for**: Ready to code

```
Implement Phase 1 of [feature]:
- Create [component] with [responsibilities]
- Update [file] to [change]
- Add [hook] that [does what]

Follow patterns from [existing code].
```

**Gives you**: Working code, ready to integrate

### Request Type 3: "Fix This Bug"

**Best for**: Specific issues

```
Bug in [file] at lines X-Y:
Current behavior: [what happens]
Expected behavior: [what should happen]
Likely cause: [your hypothesis]

Fix and explain the root cause.
```

**Gives you**: Fix + understanding

### Request Type 4: "Refactor This"

**Best for**: Code improvements

```
Refactor [file] to:
- Extract [logic] into a utility
- Improve [aspect] by using [pattern]
- Reduce duplication with [approach]

Current usage patterns: [reference where it's used]
```

**Gives you**: Cleaner, more maintainable code

### Request Type 5: "Debug This"

**Best for**: Unexpected behavior

```
Attach the file or screenshot showing the issue.

When I [action], the result is [wrong behavior].
In the console I see: [error message].

This happens on [platform] in [screen].
```

**Gives you**: Root cause analysis + fix

### Request Type 6: "Explain This Code"

**Best for**: Understanding

```
Explain what this code does [paste snippet] and why it's
structured this way. Include any gotchas or assumptions.
```

**Gives you**: Clear understanding of complex logic

---

## Working Session Structure

### Session Start (First Message)

Include:

- What you're working on (e.g., "Implementing Social Links feature")
- Which files you're editing (attach current state)
- What phase/milestone you're on
- Any blockers or questions

**Example**:

```
Working on: Social Links feature (Phase 1 - display)

Editing: src/components/profile/SocialLinksRow.tsx (new file)
         src/components/profile/ProfileHeader.tsx (attachment)

Current progress: Created spec, ready to implement component

Next steps: Build SocialLinksRow and integrate it

Blockers: Need guidance on icon sizing to match ProfileHeader aesthetic
```

### Mid-Session (Ongoing)

- Ask clarifying questions when something isn't clear
- Share error messages if tests fail
- Reference previous decisions
- Use task tracking for complex features

**Example**:

```
Error building SocialLinksRow: Icon size too large (48px vs 28px).
What should be the right size to match the bio text icons at line 120?

Also, should taps open the app (deep link) or browser?
Spec says both - what's the priority?
```

### Session End (Wrapping Up)

- Summarize what was completed
- Note any follow-up tasks
- Save progress (commit if appropriate)
- Document decisions in code comments

---

## Tips for Maximum Efficiency

### ✅ DO

- ✅ Be specific about line numbers and file paths
- ✅ Attach your current files at session start
- ✅ Ask clarifying questions mid-work
- ✅ Provide error messages and stack traces
- ✅ Link to reference implementations
- ✅ Use task tracking for multi-part work
- ✅ Test after implementation before moving on
- ✅ Save specs for future reference
- ✅ Reference previous decisions ("like we did with...")

### ❌ DON'T

- ❌ Ask vague questions ("make it better")
- ❌ Change context mid-request without noting it
- ❌ Skip explaining what you're trying to achieve
- ❌ Request massive refactors without clarity
- ❌ Ignore errors and ask me to continue
- ❌ Assume I remember from last session (provide context)
- ❌ Request code without understanding what it does
- ❌ Skip testing—always validate after changes

---

## Quick Reference Checklists

### Before Requesting Implementation

- [ ] I have a spec or clear requirements
- [ ] I know which files need to change
- [ ] I've attached the current file state
- [ ] I've provided relevant line numbers
- [ ] I understand the design patterns in use
- [ ] I know what success looks like (tests, behavior)

### Before Requesting a Refactor

- [ ] Tests exist (or will be updated)
- [ ] I understand the current code
- [ ] I can articulate the problem it solves
- [ ] I've identified the pattern I want to use
- [ ] I know where else this change impacts

### Before Asking to Debug

- [ ] I've reproduced the issue
- [ ] I can describe exact steps
- [ ] I have error messages/logs
- [ ] I've tried basic troubleshooting
- [ ] I can show the relevant code

---

## Alfred Snippets for Copilot

Copy these into Alfred Snippets. Use `{cursor}` to indicate where your cursor lands after expansion.

### Setup Instructions

1. Open Alfred Preferences → Features → Snippets
2. Create a new Collection called "Copilot"
3. Add each snippet below with the suggested keyword
4. Enable "Auto Expansion" for the collection

---

### 🔍 Scout (Keyword: `//scout`)

```
I want to {cursor}

Scout: What files need changes and where specifically?
```

**Use when**: Starting any feature, before writing code.

---

### 🚀 Implement (Keyword: `//impl`)

```
Implement: {cursor}

Files to modify:
1.
2.
3.

Constraints:
- Follow existing patterns in [reference file]
- Include PostHog tracking
- Add proper TypeScript types
```

**Use when**: Ready to code after scouting.

---

### 🐛 Bug Fix (Keyword: `//bug`)

```
Bug: {cursor}

File:
Lines:

Current behavior:
Expected behavior:

Error message (if any):
```

**Use when**: Something's broken and you need a fix.

---

### 📋 Spec Request (Keyword: `//spec`)

```
Scope out a solution for: {cursor}

Include:
- User experience flow
- Data model changes
- Components needed
- Implementation phases
- Integration points with existing code
```

**Use when**: Planning a new feature before implementation.

---

### ✏️ Edit Request (Keyword: `//edit`)

```
Edit: {cursor}

File:
Lines:

Change:

Reference pattern: [similar code location]
```

**Use when**: Making a specific change to existing code.

---

### 🆕 New Component (Keyword: `//comp`)

```
Create component: {cursor}

Location: src/components/

Props:
-

Responsibilities:
-

Reference: [existing component for styling]
```

**Use when**: Building a new React component.

---

### 🔗 New Utility (Keyword: `//util`)

```
Create utility: {cursor}

Location: src/utils/

Functions needed:
-

Used by: [which components/hooks]

Reference: [existing util for patterns]
```

**Use when**: Adding helper functions or services.

---

### 🪝 New Hook (Keyword: `//hook`)

```
Create hook: {cursor}

Location: src/hooks/

Purpose:

Returns:
-

Dependencies: [other hooks, services]

Reference: [existing hook for patterns]
```

**Use when**: Building a custom React hook.

---

### 🔄 Refactor (Keyword: `//refactor`)

```
Refactor: {cursor}

File:
Lines:

Current issue:
Desired outcome:

Pattern to follow: [reference]
```

**Use when**: Improving existing code structure.

---

### ❓ Explain (Keyword: `//explain`)

```
Explain this code: {cursor}

File:
Lines:

Specifically:
- What does it do?
- Why is it structured this way?
- Any gotchas I should know?
```

**Use when**: Understanding unfamiliar code.

---

### 📦 Batch Changes (Keyword: `//batch`)

```
Make these changes together:

1. File:
   Change: {cursor}

2. File:
   Change:

3. File:
   Change:

Use consistent patterns from: [reference]
```

**Use when**: Multiple related files need updates.

---

### 🏁 Session Start (Keyword: `//start`)

```
Working on: {cursor}

Files I'm editing:
- [attach current file]

Current progress:

Next steps:

Blockers/Questions:
```

**Use when**: Beginning a new chat session.

---

### ✅ Session End (Keyword: `//done`)

```
Session complete.

Completed:
- {cursor}

Still TODO:
-

Notes for next session:
-
```

**Use when**: Wrapping up work, documenting progress.

---

### 🧪 Test Request (Keyword: `//test`)

```
Add tests for: {cursor}

File to test:
Test file: src/__tests__/

Cover these cases:
- Happy path:
- Edge case:
- Error case:

Reference: [existing test file for patterns]
```

**Use when**: Adding unit or integration tests.

---

### 📊 Debug Request (Keyword: `//debug`)

```
Debug: {cursor}

Steps to reproduce:
1.
2.
3.

Expected:
Actual:

Console output:
```

Platform: [iOS/Android/both]

```

**Use when**: Tracking down unexpected behavior.

---

### Quick Reference Card

| Snippet     | Keyword      | Use Case                    |
|-------------|--------------|------------------------------|
| Scout       | `//scout`    | Find files before coding     |
| Implement   | `//impl`     | Execute with full context    |
| Bug Fix     | `//bug`      | Fix broken behavior          |
| Spec        | `//spec`     | Plan before building         |
| Edit        | `//edit`     | Modify existing code         |
| Component   | `//comp`     | New React component          |
| Utility     | `//util`     | New helper functions         |
| Hook        | `//hook`     | New custom hook              |
| Refactor    | `//refactor` | Improve code structure       |
| Explain     | `//explain`  | Understand code              |
| Batch       | `//batch`    | Multiple file changes        |
| Session     | `//start`    | Begin work session           |
| Done        | `//done`     | End work session             |
| Test        | `//test`     | Add tests                    |
| Debug       | `//debug`    | Track down issues            |

---

## Summary

**Best practice**: Treat me like a senior teammate who:

- Knows the codebase and patterns
- Moves fast with clear direction
- Needs context but not tutorials
- Works best with async, documented communication
- Thrives on specific, actionable requests

**Think before asking**: "Would I ask a real teammate this?" If the answer is "no," clarify first.

**Document decisions**: Keep notes on architectural choices in code comments and docs so future you (and me in future sessions) understand the "why."

Good luck! You've got a solid foundation here. 🚀
```
