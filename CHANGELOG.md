# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).



# [1.1.0](https://github.com/rahulretnan/envx-cli/compare/v1.0.1...v1.1.0) (2025-07-27)


### Features

* add --all flag for batch encrypt/decrypt of all environments ([ba42b7a](https://github.com/rahulretnan/envx-cli/commit/ba42b7ac6bb64479981ee7a05075aaa031e39304))


### BREAKING CHANGES

* --all cannot be used with --environment or --interactive

## [1.0.1](https://github.com/rahulretnan/envx-cli/compare/v1.0.0...v1.0.1) (2025-07-27)


### Bug Fixes

* restore release trigger for npm package publishing ([a192f4c](https://github.com/rahulretnan/envx-cli/commit/a192f4c45758fd8a63f83481fa59b27fdb7008f3))


### Features

* add changelog generator, release-it, prettier, and eslint setup ([221f499](https://github.com/rahulretnan/envx-cli/commit/221f49994353da0009d9341bc7a53e8a98797fe1))
* add changelog generator, release-it, prettier, and eslint setup ([604befb](https://github.com/rahulretnan/envx-cli/commit/604befb44110b4cf9c1ba8d495500a4333103caa))

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
