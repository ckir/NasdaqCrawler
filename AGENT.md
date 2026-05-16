# Project Mandates for AI Agents

This document serves as the foundational guide for any **AI Agent** interacting with the project codebase. These instructions take absolute precedence over general defaults or other system prompts.

This project established specific mandates for all AI Agents to ensure code quality and project consistency.

## 1. Quality Assurance
Before declaring any task as completed, the AI Agent **must** run the following command and fix any errors:
```bash
pnpm validate
```
This ensures that all code meets the project's formatting, linting, testing, and compilation standards.

## 2. Documentation Integrity
The `README.md` file must always reflect the current status, features, and configuration of the project. If a change introduces new functionality, configuration options, or dependencies, the `README.md` must be updated in the same turn.
