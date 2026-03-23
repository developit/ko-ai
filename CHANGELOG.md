# ko-ai

## 0.2.1

### Patch Changes

- b807543: Fix publish missing built types

## 0.2.0

### Minor Changes

- 68cb919: Add Agent SDK (`ko-ai/agent`), Agent Signals (`ko-ai/agent-signals`), and Agent Tools (`ko-ai/agent-tools`) entry points. The Agent SDK provides a higher-level agentic loop with multi-turn tool-calling, usage tracking, context management, and steering. Agent Signals wraps it with Preact Signals reactivity for building reactive UIs. Agent Tools provides ready-made shell, read, write, and edit tools.

### Patch Changes

- 4ea0a67: Set up changesets for versioning and automated npm publishing via GitHub Actions
