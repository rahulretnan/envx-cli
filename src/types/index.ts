export interface CliOptions {
  environment?: string;
  passphrase?: string;
  secret?: string;
  cwd?: string;
  interactive?: boolean;
  generate?: boolean;
  stage?: string;
}

export interface EncryptOptions extends CliOptions {
  environment: string;
  passphrase: string;
}

export interface DecryptOptions extends CliOptions {
  environment: string;
  passphrase: string;
}

export interface CreateOptions extends CliOptions {
  environment: string;
  template?: string;
}

export interface InteractiveOptions extends CliOptions {
  overwrite?: boolean;
}

export interface EnvFile {
  path: string;
  stage: string;
  encrypted: boolean;
  exists: boolean;
}

export interface StageSecret {
  stage: string;
  secret: string;
  variableName: string;
}

export interface EnvrcConfig {
  [key: string]: string;
}

export type SupportedStage =
  | 'local'
  | 'development'
  | 'staging'
  | 'production'
  | string;

export interface CliContext {
  cwd: string;
  stages: string[];
  envrcPath: string;
  envrcExists: boolean;
  secrets: StageSecret[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  data?: any;
}

export interface FileOperationResult {
  success: boolean;
  message: string;
  filePath?: string;
  error?: Error;
}

export interface CommandResult {
  success: boolean;
  message: string;
  data?: any;
  errors?: string[];
}
