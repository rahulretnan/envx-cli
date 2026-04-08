# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).



# [1.4.0](https://github.com/rahulretnan/envx-cli/compare/v1.3.1...v1.4.0) (2026-04-08)


### Features

* **exec:** add decryptFileToString via execFileSync ([92b31e7](https://github.com/rahulretnan/envx-cli/commit/92b31e737ac44b58451856e4653dd2d83b1b235c))
* **exec:** add spawnChildWithEnv helper with signal forwarding ([1c4cf7f](https://github.com/rahulretnan/envx-cli/commit/1c4cf7f85cfc08207cb6b477519673e16c9279ff))
* **exec:** harden GPG passphrase passing via stdin ([db09e19](https://github.com/rahulretnan/envx-cli/commit/db09e19f5e037125b50dcd4fb528b69496a4b8f4))
* **file:** add loadEnvSource to unify plain/encrypted loading ([e88a98c](https://github.com/rahulretnan/envx-cli/commit/e88a98c77f320d8d53099dd0b9ce801b764665d0))
* **file:** add parseEnvContent helper using dotenv + dotenv-expand ([abbf4aa](https://github.com/rahulretnan/envx-cli/commit/abbf4aaae96479c4e1a91e60a721b57272e1ec2d))
* **file:** add resolveStageFile for cwd-only stage discovery ([3f2a756](https://github.com/rahulretnan/envx-cli/commit/3f2a756f0898a899a08e72a7b237011ae9ea4a86))
* **index:** register envx run command ([57c4fbd](https://github.com/rahulretnan/envx-cli/commit/57c4fbd7c1b8eec64d98d8179e76d9be2a054cdd))
* **run:** add collectRawSources pure function ([73be304](https://github.com/rahulretnan/envx-cli/commit/73be30432f51b59ffdf537234f226ae28d0b5e24))
* **run:** add formatDryRun pure function with secret-leak guard ([243ae81](https://github.com/rahulretnan/envx-cli/commit/243ae81ae6168126b404c452abedfbae615c863d))
* **run:** add mergeEnv pure function with dotenvx-style precedence ([de56029](https://github.com/rahulretnan/envx-cli/commit/de560294b9a6a0ba4234f07bfef103cef8a74af5))
* **run:** add parseInlineEnv pure function ([ff61cf1](https://github.com/rahulretnan/envx-cli/commit/ff61cf17e88d674d274b64fb61ffb270ad729fa1))
* **run:** scaffold run command file with type aliases ([1de884d](https://github.com/rahulretnan/envx-cli/commit/1de884d5ba9eabd9e380aa4893d3e39ac5369eba))
* **run:** wire createRunCommand and executeRun orchestrator ([79784ea](https://github.com/rahulretnan/envx-cli/commit/79784ea90db84ff4b95f29e4e5d06ce96b3cad7c))
* **schemas:** add runSchema and validateRunOptions ([5351620](https://github.com/rahulretnan/envx-cli/commit/535162042c14d1f0ed06f06596ecee9b61a1a398))

## [1.3.1](https://github.com/rahulretnan/envx-cli/compare/v1.3.0...v1.3.1) (2026-02-08)


### Features

* exclude node_modules and build dirs from environment file discovery ([d1056f8](https://github.com/rahulretnan/envx-cli/commit/d1056f81e4cfcd59c49fcff0f0b28aa3653437e3))

# [1.3.0](https://github.com/rahulretnan/envx-cli/compare/v1.2.4...v1.3.0) (2026-02-08)


### Features

* add .envxrc project config, envx config command, dry-run mode, environment filtering, and enhanced init flow ([98f1f33](https://github.com/rahulretnan/envx-cli/commit/98f1f33d60690fdce1c0c16de97961cc890dedab))

## [1.2.4](https://github.com/rahulretnan/envx-cli/compare/v1.2.3...v1.2.4) (2025-12-27)


### Features

* add overwrite option to encrypt and decrypt commands for non-interactive file processing ([4c3c69c](https://github.com/rahulretnan/envx-cli/commit/4c3c69cc234d1055f198aba20b8c4f3292e987e4))

## [1.2.3](https://github.com/rahulretnan/envx-cli/compare/v1.2.2...v1.2.3) (2025-07-27)


### Features

* implement updateGitignore function to manage EnvX patterns and enhance .gitignore handling ([139318f](https://github.com/rahulretnan/envx-cli/commit/139318feffc17944c1bc59e6e9892352269559cc))

## [1.2.2](https://github.com/rahulretnan/envx-cli/compare/v1.2.1...v1.2.2) (2025-07-27)


### Bug Fixes

* add tests for init command and refactor interactive command execution ([59b678e](https://github.com/rahulretnan/envx-cli/commit/59b678e28b1f102a6e453da317eb638dfd3592db))

## [1.2.1](https://github.com/rahulretnan/envx-cli/compare/v1.2.0...v1.2.1) (2025-07-27)


### Features

* enhance environment file copy command with user prompts for missing files ([c5f78cd](https://github.com/rahulretnan/envx-cli/commit/c5f78cd375ed30220d5bc331f4c7ab2ea471cb2d))

# [1.2.0](https://github.com/rahulretnan/envx-cli/compare/v1.1.1...v1.2.0) (2025-07-27)


### Features

* implement copy command for environment files with validation and options ([f996bec](https://github.com/rahulretnan/envx-cli/commit/f996beced01909ae6dbbfff7b6bfe95fb0bce915))

## [1.1.1](https://github.com/rahulretnan/envx-cli/compare/v1.1.0...v1.1.1) (2025-07-27)


### Bug Fixes

* replace shell echo with fs writeFileSync for test file creation ([c6724ee](https://github.com/rahulretnan/envx-cli/commit/c6724ee21f2341ba831e097b2383a764d402a366))

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
