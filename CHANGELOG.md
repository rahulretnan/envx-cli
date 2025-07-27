# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-07-27

### Added

- Initial release of EnvX CLI tool
- GPG-based encryption and decryption of environment files
- Stage-based environment management (development, staging, production, etc.)
- Interactive setup mode for `.envrc` file generation
- Support for multiple environment files in subdirectories
- Batch operations on multiple files and directories
- Beautiful CLI with colored output and progress indicators
- Comprehensive error handling and validation
- Security best practices enforcement
- Integration with direnv for automatic environment loading

### Features

- `envx init` - Initialize EnvX in a new project
- `envx create` - Create new environment files with optional templates
- `envx encrypt` - Encrypt environment files using GPG
- `envx decrypt` - Decrypt environment files
- `envx interactive` - Interactive setup for secrets management
- `envx list` - List all environment files and their status
- `envx status` - Show project encryption status and recommendations
- `envx version` - Show version information

### Security

- GPG encryption for maximum security
- Secret management with `.envrc` integration
- Automatic secret variable naming (`<STAGE>_SECRET`)
- File backup and restoration on failed operations
- Secure file permission handling

### Developer Experience

- TypeScript support with full type safety
- Zod schema validation for all inputs
- Interactive prompts with validation
- Comprehensive help system
- Detailed error messages and troubleshooting guides
- Progress indicators for long operations

### Documentation

- Complete README with installation and usage instructions
- Security best practices guide
- Troubleshooting section
- API reference
- Integration examples with popular tools
