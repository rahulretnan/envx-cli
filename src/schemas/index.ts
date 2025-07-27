import { z } from "zod";

export const baseOptionsSchema = z.object({
  cwd: z.string().optional(),
  environment: z.string().optional(),
  passphrase: z.string().optional(),
  secret: z.string().optional(),
  interactive: z.boolean().optional(),
  generate: z.boolean().optional(),
  stage: z.string().optional(),
});

export const encryptSchema = z.object({
  environment: z.string().min(1, "Environment is required"),
  passphrase: z.string().min(1, "Passphrase is required"),
  cwd: z.string().optional(),
  secret: z.string().optional(),
});

export const decryptSchema = z.object({
  environment: z.string().min(1, "Environment is required"),
  passphrase: z.string().min(1, "Passphrase is required"),
  cwd: z.string().optional(),
  secret: z.string().optional(),
});

export const createSchema = z.object({
  environment: z.string().min(1, "Environment is required"),
  template: z.string().optional(),
  cwd: z.string().optional(),
});

export const interactiveSchema = z.object({
  overwrite: z.boolean().optional(),
  cwd: z.string().optional(),
});

export const stageSecretSchema = z.object({
  stage: z.string().min(1, "Stage is required"),
  secret: z.string().min(1, "Secret is required"),
  variableName: z.string().min(1, "Variable name is required"),
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
        (err: any) => `${err.path.join(".")}: ${err.message}`,
      );
      throw new Error(`Validation failed:\n${errorMessages.join("\n")}`);
    }
    throw error;
  }
};

export const validateOptions = (data: unknown) =>
  validateSchema(baseOptionsSchema, data);
export const validateEncryptOptions = (data: unknown) =>
  validateSchema(encryptSchema, data);
export const validateDecryptOptions = (data: unknown) =>
  validateSchema(decryptSchema, data);
export const validateCreateOptions = (data: unknown) =>
  validateSchema(createSchema, data);
export const validateInteractiveOptions = (data: unknown) =>
  validateSchema(interactiveSchema, data);
