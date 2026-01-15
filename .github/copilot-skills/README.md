# RAGESTATE Copilot Skills

This directory contains GitHub Copilot Skills that provide specialized knowledge and standards for developing the RAGESTATE app. Skills help Copilot understand project-specific patterns, conventions, and best practices.

## Available Skills

### 🔥 High-Impact (Daily Use)

1. **[React Native Component](./react-native-component.md)**

   - Component structure and patterns
   - Theme-aware styling with hooks
   - TypeScript interfaces
   - Performance best practices
   - Icon, image, and list handling

2. **[Theming & Styling](./theming-and-styling.md)**

   - Complete theme token reference
   - Dark/light mode support
   - useThemedStyles hook patterns
   - Color, spacing, typography tokens
   - Shadow and border radius system

3. **[Firebase & Firestore](./firebase-firestore.md)**
   - Client-side service patterns
   - Security rules structure
   - Cloud Functions development
   - Real-time subscriptions
   - Query patterns and schemas

### 💡 Medium-Impact (Weekly Use)

4. **[Error Handling](./error-handling.md)**

   - Unified error handler hooks
   - Firebase error translation
   - Error UI components
   - Validation patterns
   - Retry mechanisms

5. **[Analytics & PostHog](./analytics-posthog.md)**
   - Event tracking standards
   - Naming conventions (snake_case)
   - User identification
   - Feature flags
   - Privacy considerations

## How to Use Skills

### In Copilot Chat

Reference a skill in your prompts:

```
Create a new ProfileCard component following the React Native Component skill patterns
```

or

```
@workspace Using the Theming & Styling skill, update this component to use theme tokens
```

### Attach Skills to Context

Use the `#file` mention to attach skill context:

```
#file:.github/copilot-skills/react-native-component.md
Create a comment input component
```

## Skill Development Guidelines

When creating new skills or updating existing ones:

1. **Be specific** - Include actual code examples from the codebase
2. **Show patterns** - Demonstrate both correct (✅) and incorrect (❌) usage
3. **Link to source** - Reference actual files in the project
4. **Keep updated** - Update when patterns change
5. **Test them** - Use skills in actual development to verify usefulness

## Contributing

To add a new skill:

1. Create a new `.md` file in this directory
2. Follow the existing skill structure:
   - Purpose & scope at top
   - Core principles
   - Code examples
   - DO's and DON'Ts
   - Resources
3. Update this README with a link
4. Test the skill with Copilot

## Skill Priority Matrix

| Skill                  | Impact  | Frequency | Best For        |
| ---------------------- | ------- | --------- | --------------- |
| React Native Component | 🔥 High | Daily     | UI development  |
| Theming & Styling      | 🔥 High | Daily     | Styling, colors |
| Firebase/Firestore     | 🔥 High | Daily     | Data operations |
| Error Handling         | Medium  | Weekly    | Error UX        |
| Analytics & PostHog    | Medium  | Weekly    | Event tracking  |

## Upcoming Skills

Skills planned for future development:

- **Cloud Functions Skill** - Detailed backend patterns
- **Social Feed Skill** - Posts, comments, likes patterns
- **Expo Router Skill** - Navigation and routing
- **Testing Skill** - Unit and integration testing
- **Performance Skill** - Optimization patterns

## Resources

- [GitHub Copilot Skills Documentation](https://docs.github.com/en/copilot/using-github-copilot/prompt-engineering-for-github-copilot)
- [RAGESTATE Copilot Workflow Guide](../../docs/COPILOT-WORKFLOW-GUIDE.md)
- [Project Documentation](../../docs/)

---

**Last Updated:** January 14, 2026  
**Maintained by:** RAGESTATE Development Team
