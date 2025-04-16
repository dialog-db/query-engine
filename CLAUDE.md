# Datalogia Development Guide

## General Overview

Project is implementation of the datalog query engine inspired by SICP logic programming system.

## Commands

- **Build**: `npm run build` (TypeScript compilation)
- **Check Types**: `pnpm run check`
- **Run Single Test**: `entail 'test/specific.spec.js'`
- **Test (Node)**: `pnpm test:node` (all tests)
- **Test (Web)**: `pnpm test:web` (browser tests)
- **Coverage**: `pnpm coverage`

## Code Style

- **Formatting**: Prettier with trailing commas, 2 space indentation, no semicolons, single quotes
- **Imports**: ES modules only (`import * as X from 'y'`)
- **Types**: TypeScript type definitions and interfaces in .ts files, implementations in JS files with JSDoc annotations.
- **Variables**: Descriptive names, camelCase for variables/functions, PascalCase for classes
- **Error Handling**: Use descriptive error messages with specific details
- **Functions**: Prefer pure functions with clear inputs/outputs
- **Testing**: Each module should have corresponding test file with clear test cases

## Implementation Details

- **Task Library**: Library uses generators to manage potentially async work, specifically `yield* subtask()` acts similar to `await subtask()`.

## Project Structure

- `src/`: Source files
- `test/`: Test files (corresponding to src modules)
- `bench/`: Benchmarking tools

## Variable Unification in the Query Planner

The query planner needs to recognize when variables are unified (made equivalent). When a rule unifies two variables by mapping them to the same variable (e.g., `$.x` and `$.is` both mapped to `$.as`), binding one of these variables should effectively bind the other as well.

This is important because:
1. It prevents unnecessary blocking of rule execution
2. It allows the planner to resolve dependencies correctly
3. It's essential for rules that use variable unification as a key part of their logic

The solution involves enhancing the `Join.plan` method to check not only if a variable is directly bound, but also if any equivalent variable (through unification in `references`) is bound.