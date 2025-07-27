# EnvX 🔐

Environment file encryption and management tool for secure development workflows.

[![npm version](https://badge.fury.io/js/envx-cli.svg)](https://badge.fury.io/js/envx-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

EnvX is a command-line tool that helps you securely manage environment files across different stages (development, staging, production) using GPG encryption. It provides a simple workflow for encrypting sensitive environment variables while maintaining ease of use for development teams.

## Features

- 🔒 **GPG-based encryption** for maximum security
- 🎯 **Stage-based management** (development, staging, production, etc.)
- 🚀 **Interactive setup** with guided configuration
- 📁 **Batch operations** on multiple files and directories
- 🔑 **Secret management** with `.envrc` integration
- 🎨 **Beautiful CLI** with colored output and progress indicators
- 🛡️ **Best practices** enforcement and security recommendations

## Prerequisites

Before using EnvX, ensure you have:

- **Node.js** >= 14.0.0
- **GPG** (GNU Privacy Guard) installed and configured

### Installing GPG

#### macOS

```bash
brew install gnupg
```

#### Ubuntu/Debian

```bash
sudo apt-get install gnupg
```

#### Windows

Download from [https://gnupg.org/download/](https://gnupg.org/download/)

#### Verify Installation

```bash
gpg --version
```

## Installation

### Global Installation (Recommended)

```bash
npm install -g envx-cli
```

### Local Installation

```bash
npm install envx-cli
npx envx --help
```

## Quick Start

1. **Initialize EnvX in your project:**

```bash
envx init
```

2. **Create environment files:**

```bash
envx create -e development
envx create -e production
```

3. **Set up secrets for encryption:**

```bash
envx interactive
```

4. **Encrypt your environment files:**

```bash
envx encrypt -e production
```

5. **Commit encrypted files to git:**

```bash
git add *.gpg
git commit -m "Add encrypted environment files"
```

6. **Copy environment to .env for use:**

```bash
envx copy -e production
```

7. **Decrypt when needed:**

```bash
envx decrypt -e production
```

## Commands

### `envx init`

Initialize EnvX in a new project with guided setup.

```bash
envx init
```

### `envx create`

Create new environment files.

```bash
# Create a single environment file
envx create -e development

# Interactive mode for multiple environments
envx create -i

# Use a template file
envx create -e production -t .env.example

# Overwrite existing files
envx create -e staging --overwrite
```

**Options:**

- `-e, --environment <env>` - Environment name
- `-t, --template <path>` - Template file path
- `-i, --interactive` - Interactive mode
- `--overwrite` - Overwrite existing files
- `-c, --cwd <path>` - Working directory

### `envx encrypt`

Encrypt environment files using GPG.

```bash
# Encrypt specific environment
envx encrypt -e production

# Encrypt all environments at once
envx encrypt --all

# Use custom secret from .envrc
envx encrypt -e production -s CUSTOM_SECRET

# Interactive file selection (for single environment)
envx encrypt -e staging -i

# Encrypt all with specific passphrase
envx encrypt --all -p "your-passphrase"

# Specify passphrase directly (not recommended)
envx encrypt -e development -p "your-passphrase"
```

**Options:**

- `-e, --environment <env>` - Environment name (required unless using --all)
- `-a, --all` - Process all available environments
- `-p, --passphrase <pass>` - Encryption passphrase
- `-s, --secret <secret>` - Secret variable name from .envrc
- `-i, --interactive` - Interactive file selection (disabled with --all)
- `-c, --cwd <path>` - Working directory

### `envx decrypt`

Decrypt environment files.

```bash
# Decrypt specific environment
envx decrypt -e production

# Decrypt all environments at once
envx decrypt --all

# Overwrite existing files without confirmation
envx decrypt -e development --overwrite

# Decrypt all with overwrite flag
envx decrypt --all --overwrite

# Interactive file selection (for single environment)
envx decrypt -e staging -i
```

**Options:**

- `-e, --environment <env>` - Environment name (required unless using --all)
- `-a, --all` - Process all available environments
- `-p, --passphrase <pass>` - Decryption passphrase
- `-s, --secret <secret>` - Secret variable name from .envrc
- `-i, --interactive` - Interactive file selection (disabled with --all)
- `--overwrite` - Overwrite existing files without confirmation
- `-c, --cwd <path>` - Working directory

### `envx interactive`

Interactive setup for `.envrc` file with secrets.

```bash
# Start interactive setup
envx interactive

# Overwrite existing .envrc
envx interactive --overwrite

# Generate random secrets for all environments
envx interactive --generate
```

**Options:**

- `--overwrite` - Overwrite existing .envrc file
- `--generate` - Generate random secrets
- `-c, --cwd <path>` - Working directory

### `envx list`

List all environment files and their status.

```bash
# List all environment files
envx list

# Short alias
envx ls
```

**Options:**

- `-c, --cwd <path>` - Working directory

### `envx copy`

Copy environment file from a specific stage to `.env`. This command is perfect for deployment scenarios where you need to activate a specific environment configuration.

```bash
# Copy production environment to .env (single directory)
envx copy -e production

# Copy to ALL directories with environment files (multi-service)
envx copy -e production --all

# Copy development environment to .env
envx copy -e development

# Copy with overwrite (no confirmation)
envx copy -e staging --overwrite

# Copy from encrypted file (auto-decrypts)
envx copy -e production -p "your-passphrase"

# Use secret from .envrc for encrypted files
envx copy -e production -s PRODUCTION_SECRET

# Copy production to all services from project root
envx copy -e production --all --overwrite
```

**Options:**

- `-e, --environment <env>` - Environment name (required)
- `-a, --all` - Process all directories with environment files
- `-p, --passphrase <pass>` - Passphrase for decryption (if source is encrypted)
- `-s, --secret <secret>` - Secret variable name from .envrc
- `--overwrite` - Overwrite existing .env file without confirmation
- `-c, --cwd <path>` - Working directory

**How it works:**

- **Single directory mode**: Copies `.env.<environment>` to `.env` in current directory
- **Multi-directory mode (`--all`)**: Finds all directories with environment files and copies to each
- If `.env.<environment>` exists (unencrypted), it copies directly to `.env`
- If `.env.<environment>.gpg` exists (encrypted), it decrypts and copies to `.env`
- Prefers unencrypted files over encrypted ones if both exist
- Creates backup of existing `.env` file during encrypted operations
- Shows security warnings when copying production environments

### `envx status`

Show project encryption status and recommendations.

```bash
envx status
```

**Options:**

- `-c, --cwd <path>` - Working directory

## Workflow Examples

### Basic Workflow

1. **Create environment files:**

```bash
envx create -e development
envx create -e production
```

2. **Edit your environment files:**

```bash
# Edit .env.development
echo "DATABASE_URL=postgresql://localhost:5432/myapp_dev" >> .env.development
echo "API_KEY=dev-api-key" >> .env.development

# Edit .env.production
echo "DATABASE_URL=postgresql://prod-server:5432/myapp" >> .env.production
echo "API_KEY=prod-api-key-secret" >> .env.production
```

3. **Set up encryption secrets:**

```bash
envx interactive
```

4. **Encrypt production secrets:**

```bash
envx encrypt -e production
```

5. **Copy environment for application use:**

```bash
# For development
envx copy -e development

# For production deployment
envx copy -e production
```

6. **Add to version control:**

```bash
echo ".env.*" >> .gitignore
echo "!*.gpg" >> .gitignore
git add .env.production.gpg .envrc
git commit -m "Add encrypted production environment"
```

### Deployment Workflow

1. **Single service deployment:**

```bash
# On production server after pulling latest code
envx copy -e production --overwrite
```

2. **Multi-service deployment (from project root):**

```bash
# Copy production environment to ALL services at once
envx copy -e production --all --overwrite
```

3. **For local development with production data:**

```bash
# Copy production environment locally (be careful!)
envx copy -e production

# Or copy to all services locally
envx copy -e production --all
```

4. **Switch between environments easily:**

```bash
# Use development environment across all services
envx copy -e development --all --overwrite

# Switch to staging across all services
envx copy -e staging --all --overwrite

# Switch to production (with warning)
envx copy -e production --all --overwrite
```

### Team Workflow

1. **Clone repository and set up environment:**

```bash
git clone <your-repo>
cd <your-repo>

# For development
envx copy -e development

# For production deployment
envx copy -e production
```

2. **Make changes and re-encrypt:**

```bash
# Edit .env.production directly or copy from .env after changes
cp .env .env.production  # if you made changes to .env
envx encrypt -e production
git add .env.production.gpg
git commit -m "Update production configuration"
```

### Multi-Service Management

**From project root, manage all services at once:**

```bash
# Copy production environment to all services
envx copy -e production --all

# Copy staging environment to all services
envx copy -e staging --all --overwrite

# Perfect for deployment scripts
#!/bin/bash
envx copy -e production --all --overwrite
docker-compose up -d
```

### Batch Operations

**Process all environments at once:**

```bash
# Encrypt all environment files
envx encrypt --all

# Decrypt all environment files
envx decrypt --all

# Decrypt all with overwrite protection disabled
envx decrypt --all --overwrite
```

**Benefits of using `--all`:**

- ✅ **Efficiency**: Process multiple environments in one command
- ✅ **Consistency**: Same passphrase/secret handling across all environments
- ✅ **Automation**: Perfect for CI/CD pipelines and scripts
- ✅ **Safety**: Each environment is processed independently - failures in one don't stop others
- ✅ **Reporting**: Comprehensive summary showing results for each environment

**Key Features of `--all` Flag:**

- **Sequential Processing**: Environments are processed one by one to avoid resource conflicts
- **Independent Operations**: Failure in one environment doesn't stop processing of others
- **Smart Passphrase Resolution**: Uses provided passphrase, environment-specific secrets, or prompts as needed
- **Comprehensive Reporting**: Shows detailed results for each environment plus overall summary
- **Safety Checks**: Validates compatibility with other flags (incompatible with `--environment` and `--interactive`)
- **Flexible Configuration**: Works with all existing options like `--passphrase`, `--secret`, `--cwd`, and `--overwrite`

### Copy to `.env` Workflow

**Activate environments for your application:**

```bash
# Activate development environment for local work
envx copy -e development

# Activate staging for testing
envx copy -e staging --overwrite

# Activate production for deployment
envx copy -e production --overwrite
```

**Use cases for `envx copy`:**

- 🚀 **Deployment**: Copy environment configuration to `.env` for application use
- 🔄 **Environment Switching**: Quickly switch between different configurations
- 🛠️ **Local Development**: Use production/staging config locally for debugging
- 📦 **Docker/Containers**: Set up environment in containerized deployments
- 🔧 **CI/CD**: Activate specific environments during pipeline stages
- 🏗️ **Multi-Service**: Manage environment files across multiple services from project root
- ⚡ **Batch Operations**: Copy same environment to all services with one command

## Configuration

### `.envrc` File

EnvX uses `.envrc` files to store encryption secrets. The format follows the direnv convention:

```bash
# Environment secrets generated by envx
export DEVELOPMENT_SECRET="your-development-secret"
export STAGING_SECRET="your-staging-secret"
export PRODUCTION_SECRET="your-production-secret"
```

### Secret Variable Naming

EnvX follows the convention: `<STAGE>_SECRET`

Examples:

- `DEVELOPMENT_SECRET`
- `STAGING_SECRET`
- `PRODUCTION_SECRET`
- `LOCAL_SECRET`

### File Structure

```
your-project/
├── .env.development          # Unencrypted (local only)
├── .env.staging.gpg         # Encrypted (committed)
├── .env.production.gpg      # Encrypted (committed)
├── .envrc                   # Secrets (local only)
└── .gitignore               # Excludes .env.* but allows *.gpg
```

## Security Best Practices

### ✅ Do's

- ✅ Always encrypt production and staging environment files
- ✅ Commit encrypted `.gpg` files to version control
- ✅ Add `.envrc` to your `.gitignore`
- ✅ Use strong, unique secrets for each environment
- ✅ Regularly rotate encryption secrets
- ✅ Use `envx status` to check your security posture

### ❌ Don'ts

- ❌ Never commit unencrypted `.env.*` files (except templates)
- ❌ Don't commit `.envrc` files to version control
- ❌ Don't use weak or predictable passphrases
- ❌ Don't share secrets through insecure channels
- ❌ Don't leave decrypted files in production environments

### Recommended `.gitignore`

```gitignore
# Environment files
.env.*
!.env.example
!.env.template
!*.gpg

# EnvX secrets
.envrc
```

## Integration with Direnv

EnvX works great with [direnv](https://direnv.net/) for automatic environment loading:

1. **Install direnv:**

```bash
# macOS
brew install direnv

# Ubuntu/Debian
sudo apt install direnv
```

2. **Add to your shell profile:**

```bash
# For bash
echo 'eval "$(direnv hook bash)"' >> ~/.bashrc

# For zsh
echo 'eval "$(direnv hook zsh)"' >> ~/.zshrc
```

3. **Allow direnv in your project:**

```bash
direnv allow
```

Now your secrets will be automatically loaded when you enter the project directory!

## Troubleshooting

### GPG Issues

**Problem:** `gpg: command not found`

```bash
# Install GPG (see Prerequisites section)
```

**Problem:** `gpg: decryption failed: Bad session key`

```bash
# Wrong passphrase - try again or check your .envrc file
envx decrypt -e production
```

**Problem:** `gpg: can't connect to the agent`

```bash
# Restart GPG agent
gpgconf --kill gpg-agent
gpgconf --launch gpg-agent
```

### Permission Issues

**Problem:** `EACCES: permission denied`

```bash
# Check file permissions
ls -la .env.*
chmod 644 .env.*
```

### File Not Found

**Problem:** `Template file not found`

```bash
# Check if template exists
ls -la .env.example
# Or create without template
envx create -e development
```

## API Reference

### Environment Variables

EnvX respects the following environment variables:

- `ENVX_DEFAULT_CWD` - Default working directory
- `ENVX_GPG_BINARY` - Custom GPG binary path
- `NODE_ENV` - Affects error reporting verbosity

### Exit Codes

- `0` - Success
- `1` - General error
- `2` - Invalid arguments
- `3` - File operation failed
- `4` - GPG operation failed

## Testing

EnvX includes a streamlined test suite focused on essential functionality and real-world CLI usage scenarios.

### Running Tests

```bash
# Run all tests
npm test

# Run core functionality tests
npm run test:core

# Run integration tests
npm run test:integration

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode (for development)
npm run test:watch
```

### Testing Philosophy

The test suite prioritizes **essential functionality** over comprehensive coverage:

- ✅ **Core business logic** - Command validation, file utilities, path manipulation
- ✅ **Real CLI scenarios** - Actual command execution in various environments
- ✅ **Critical workflows** - User-facing functionality that must work reliably
- ❌ **UI/cosmetic features** - Colors, formatting, and visual elements
- ❌ **Complex mocking** - Simplified approach focusing on actual behavior

### Test Coverage

**Current Status**: ✅ 120 tests passing, ~11s execution time

- **Core Tests**: 104 tests covering essential functionality
  - Schema validation: 25 tests (command input validation)
  - File utilities: 39 tests (path manipulation, secret generation)
  - Command logic: 25 tests (workflow patterns and decision logic)
  - All-flag functionality: 15 tests (batch operations, error handling)

- **Integration Tests**: 16 tests covering real CLI usage
  - Help/version commands
  - Create command functionality
  - All-flag compatibility testing
  - Error handling scenarios
  - Environment validation

### Test Structure

```
__tests__/
├── core/                    # Essential functionality tests
│   ├── schemas.test.ts     # Input validation for all commands
│   ├── file.test.ts        # File utilities and path manipulation
│   ├── commands.test.ts    # Command workflow logic patterns
│   └── all-flag.test.ts    # Batch operations and --all flag functionality
└── integration/            # End-to-end CLI tests
    └── cli.test.ts         # Real CLI execution scenarios
```

For detailed testing information, see [TESTING.md](TESTING.md).

## Development

### Building from Source

```bash
git clone https://github.com/rahulretnan/envx-cli
cd envx-cli
npm install
npm run build
npm link
```

### Development Workflow

```bash
# Start development mode
npm run dev

# Run tests in watch mode
npm run test:watch

# Build and test
npm run build && npm test
```

### Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and add tests
4. Run tests: `npm test`
5. Ensure test coverage remains high: `npm run test:coverage`
6. Submit a pull request

#### Test Requirements

- New CLI commands must include integration tests
- Core utility functions must include unit tests
- Focus on user-facing functionality over implementation details
- Keep tests simple and maintainable
- Ensure tests verify real CLI behavior

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for detailed release notes.

## License

MIT © [rahulretnan](https://github.com/rahulretnan)

## Support

- 📝 [Issues](https://github.com/rahulretnan/envx-cli/issues)
- 💬 [Discussions](https://github.com/rahulretnan/envx-cli/discussions)
- 📧 Email: hi@rahulretnan.me

---

**Made with ❤️ by developers, for developers.**

_Remember: Security is not a feature, it's a requirement. EnvX helps you maintain security without sacrificing developer experience._
