# Testing Documentation

This document describes the testing approach for the envx CLI tool.

## Testing Philosophy

The test suite has been streamlined to focus on **essential functionality** rather than comprehensive coverage of every edge case or UI element. The goal is to ensure the CLI works correctly with all commands in different scenarios without getting bogged down in testing cosmetic features like chalk colors or complex mocking scenarios.

## Test Structure

### Core Tests (`__tests__/core/`)

These tests focus on the fundamental business logic and utility functions:

- **`schemas.test.ts`** - Tests input validation for all CLI commands
- **`file.test.ts`** - Tests file utility functions (path manipulation, secret generation, validation)
- **`commands.test.ts`** - Tests command workflow logic and decision patterns

### Integration Tests (`__tests__/integration/`)

These tests verify the CLI works as a complete system:

- **`cli.test.ts`** - End-to-end tests of CLI commands in real scenarios

## Test Categories

### What We Test

✅ **Core Business Logic**

- Command input validation
- File path manipulation
- Environment name validation
- Secret generation
- Command workflow patterns

✅ **Essential CLI Functionality**

- Help and version commands
- Basic create command functionality
- Error handling for invalid inputs
- File overwrite protection

✅ **Critical Edge Cases**

- Invalid environment names
- Path edge cases (empty paths, Windows paths, etc.)
- Input validation boundaries

### What We Don't Test

❌ **UI/Cosmetic Features**

- Chalk color formatting
- Inquirer prompt styling
- Console output formatting

❌ **Complex External Dependencies**

- GPG integration details (beyond availability checks)
- File system permissions (beyond basic checks)
- Network operations

❌ **Implementation Details**

- Internal module structure
- Private methods
- Specific ESM/CommonJS compatibility

## Running Tests

```bash
# Run all tests
npm test

# Run only core functionality tests
npm run test:core

# Run only integration tests
npm run test:integration

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Test Principles

1. **Pragmatic over Perfect** - Tests should verify the CLI works, not achieve 100% coverage
2. **Real Scenarios** - Integration tests use actual CLI execution rather than mocks
3. **Maintainable** - Simple tests that are easy to understand and modify
4. **Fast Feedback** - Tests should run quickly to enable rapid development

## Coverage Goals

We aim for:

- **High coverage** of core utility functions (schemas, file utils)
- **Functional coverage** of CLI commands (basic operations work)
- **Scenario coverage** of common user workflows

We don't aim for:

- 100% line coverage
- Coverage of error messages and UI formatting
- Coverage of rarely-used edge cases

## Adding New Tests

When adding new functionality:

1. **Add core tests** for new utility functions or business logic
2. **Add integration tests** for new CLI commands or major workflows
3. **Focus on user-facing behavior** rather than implementation details
4. **Keep tests simple** and avoid complex mocking when possible

## Test Maintenance

- Tests should be updated when functionality changes
- Failing tests should be fixed or removed if functionality is deprecated
- Test files should be kept clean and focused on their specific purpose
- Complex setup should be avoided in favor of simple, direct testing

---

This streamlined approach ensures we have confidence in the CLI's core functionality while keeping the test suite maintainable and focused on what matters most to users.

## envx run command

### What we test

- **Pure functions** (`collectRawSources`, `parseInlineEnv`, `mergeEnv`, `formatDryRun`) are unit tested in `__tests__/core/run.test.ts` with no subprocess and no GPG.
- **Utility helpers** (`FileUtils.parseEnvContent`, `FileUtils.resolveStageFile`, `FileUtils.loadEnvSource`, `ExecUtils.decryptFileToString`) are unit tested with mocked I/O.
- **End-to-end flow** (real GPG, real spawn, real exit-code propagation) is covered in `__tests__/integration/cli.test.ts` under the `Run Command` describe block.

### What we intentionally skip in v1

- **Signal forwarding tests** (SIGINT, SIGTERM, SIGHUP). These are reliable in practice but hard to write cross-platform. The spawn helper's signal-forwarding code is small and well-understood. If a bug ever appears here, add a regression test at that point.
- **Variable expansion edge cases** — covered by `dotenv-expand`'s own test suite.
- **TTY / no-TTY behavior of the passphrase prompt** — not run-specific.

### Critical constraint

`executeRun` calls `process.exit` after the sub-process finishes. **Jest cannot intercept this.** That's why the merge and source-collection logic is implemented as _pure functions_ that take explicit inputs and return explicit outputs, not as methods that read `process.env` directly. Unit tests exercise the pure functions; the orchestrator is only touched through the integration tests, which spawn `dist/index.js` as a fresh subprocess.

### Prerequisites

Integration tests for `envx run` require `npm run build` first. They exec `dist/index.js` directly. If the source has changed, rebuild before running integration tests.
