import { z } from 'zod';

export const baseOptionsSchema = z.object({
  cwd: z.string().optional(),
  environment: z.string().optional(),
  passphrase: z.string().optional(),
  secret: z.string().optional(),
  interactive: z.boolean().optional(),
  generate: z.boolean().optional(),
  stage: z.string().optional(),
});

export const encryptSchema = z
  .object({
    environment: z.string().min(1, 'Environment is required'),
    passphrase: z.string().min(1, 'Passphrase is required'),
    cwd: z.string().optional(),
    secret: z.string().optional(),
    all: z.boolean().optional(),
  })
  .refine(
    data => {
      // If all is true, environment should not be provided
      if (data.all && data.environment) {
        return false;
      }
      // If all is false/undefined, environment is required
      if (!data.all && !data.environment) {
        return false;
      }
      return true;
    },
    {
      message: 'Cannot use --all with --environment flag',
      path: ['all'],
    }
  );

export const decryptSchema = z
  .object({
    environment: z.string().min(1, 'Environment is required'),
    passphrase: z.string().min(1, 'Passphrase is required'),
    cwd: z.string().optional(),
    secret: z.string().optional(),
    all: z.boolean().optional(),
    overwrite: z.boolean().optional(),
  })
  .refine(
    data => {
      // If all is true, environment should not be provided
      if (data.all && data.environment) {
        return false;
      }
      // If all is false/undefined, environment is required
      if (!data.all && !data.environment) {
        return false;
      }
      return true;
    },
    {
      message: 'Cannot use --all with --environment flag',
      path: ['all'],
    }
  );

export const createSchema = z.object({
  environment: z.string().min(1, 'Environment is required'),
  template: z.string().optional(),
  cwd: z.string().optional(),
});

export const interactiveSchema = z.object({
  overwrite: z.boolean().optional(),
  cwd: z.string().optional(),
});

export const copySchema = z
  .object({
    environment: z.string().optional(),
    passphrase: z.string().optional(),
    secret: z.string().optional(),
    cwd: z.string().optional(),
    overwrite: z.boolean().optional(),
    all: z.boolean().optional(),
  })
  .refine(
    data => {
      // If all is true, environment is required
      if (data.all && !data.environment) {
        return false;
      }
      // If all is false/undefined, environment is still required
      if (!data.all && !data.environment) {
        return false;
      }
      return true;
    },
    {
      message: 'Environment is required, especially when using --all flag',
      path: ['environment'],
    }
  );

export const stageSecretSchema = z.object({
  stage: z.string().min(1, 'Stage is required'),
  secret: z.string().min(1, 'Secret is required'),
  variableName: z.string().min(1, 'Variable name is required'),
});

export const envrcConfigSchema = z.record(z.string(), z.string());

export const fileOperationSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  filePath: z.string().optional(),
  error: z.instanceof(Error).optional(),
});

export const commandResultSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.any().optional(),
  errors: z.array(z.string()).optional(),
});

export type EncryptSchemaType = z.infer<typeof encryptSchema>;
export type DecryptSchemaType = z.infer<typeof decryptSchema>;
export type CreateSchemaType = z.infer<typeof createSchema>;
export type InteractiveSchemaType = z.infer<typeof interactiveSchema>;
export type CopySchemaType = z.infer<typeof copySchema>;
export type StageSecretSchemaType = z.infer<typeof stageSecretSchema>;
export type EnvrcConfigSchemaType = z.infer<typeof envrcConfigSchema>;
export type FileOperationSchemaType = z.infer<typeof fileOperationSchema>;
export type CommandResultSchemaType = z.infer<typeof commandResultSchema>;

// Common validation functions
export const validateSchema = <T>(schema: z.ZodSchema<T>, data: unknown): T => {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.issues.map(
        (err: any) => `${err.path.join('.')}: ${err.message}`
      );
      throw new Error(`Validation failed:\n${errorMessages.join('\n')}`);
    }
    throw error;
  }
};

export const validateOptions = (data: unknown) =>
  validateSchema(baseOptionsSchema, data);
export const validateEncryptOptions = (data: unknown) => {
  // Handle --all flag by making environment optional when all is true
  const processedData = data as any;
  if (processedData?.all) {
    const schemaForAll = z
      .object({
        passphrase: z.string().min(1, 'Passphrase is required'),
        cwd: z.string().optional(),
        secret: z.string().optional(),
        all: z.boolean().optional(),
        environment: z.string().optional(),
      })
      .refine(data => !data.environment, {
        message: 'Cannot use --all with --environment flag',
        path: ['environment'],
      });
    return validateSchema(schemaForAll, data);
  }
  return validateSchema(encryptSchema, data);
};

export const validateDecryptOptions = (data: unknown) => {
  // Handle --all flag by making environment optional when all is true
  const processedData = data as any;
  if (processedData?.all) {
    const schemaForAll = z
      .object({
        passphrase: z.string().min(1, 'Passphrase is required'),
        cwd: z.string().optional(),
        secret: z.string().optional(),
        all: z.boolean().optional(),
        overwrite: z.boolean().optional(),
        environment: z.string().optional(),
      })
      .refine(data => !data.environment, {
        message: 'Cannot use --all with --environment flag',
        path: ['environment'],
      });
    return validateSchema(schemaForAll, data);
  }
  return validateSchema(decryptSchema, data);
};
export const validateCreateOptions = (data: unknown) =>
  validateSchema(createSchema, data);
export const validateInteractiveOptions = (data: unknown) =>
  validateSchema(interactiveSchema, data);
export const validateCopyOptions = (data: unknown) => {
  // For copy command, --all requires environment to be specified
  const processedData = data as any;
  if (processedData?.all && !processedData?.environment) {
    throw new Error(
      'The --all flag requires an environment to be specified with -e/--environment'
    );
  }
  return validateSchema(copySchema, data);
};
