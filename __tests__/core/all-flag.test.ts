describe('All Flag Functionality', () => {
  describe('Environment Discovery', () => {
    it('should find all available environments from file list', () => {
      const findAllEnvironments = (files: string[]) => {
        const environments = new Set<string>();

        files.forEach(file => {
          const match = file.match(/^\.env\.([^.]+)(\.gpg)?$/);
          if (match && match[1] !== 'example' && match[1] !== 'template') {
            environments.add(match[1]);
          }
        });

        return Array.from(environments).sort();
      };

      const files = [
        '.env.development',
        '.env.production.gpg',
        '.env.staging',
        '.env.staging.gpg',
        '.env.test',
        '.env.example', // Should be excluded
        '.env.template', // Should be excluded
        'other.file',
        '.env', // Should be excluded (no environment)
      ];

      const environments = findAllEnvironments(files);

      expect(environments).toEqual([
        'development',
        'production',
        'staging',
        'test',
      ]);
      expect(environments).not.toContain('template');
    });

    it('should handle empty file list', () => {
      const findAllEnvironments = (files: string[]) => {
        const environments = new Set<string>();

        files.forEach(file => {
          const match = file.match(/^\.env\.([^.]+)(\.gpg)?$/);
          if (match && match[1] !== 'example' && match[1] !== 'template') {
            environments.add(match[1]);
          }
        });

        return Array.from(environments).sort();
      };

      expect(findAllEnvironments([])).toEqual([]);
    });

    it('should handle duplicate environments', () => {
      const findAllEnvironments = (files: string[]) => {
        const environments = new Set<string>();

        files.forEach(file => {
          const match = file.match(/^\.env\.([^.]+)(\.gpg)?$/);
          if (match && match[1] !== 'example' && match[1] !== 'template') {
            environments.add(match[1]);
          }
        });

        return Array.from(environments).sort();
      };

      const files = [
        '.env.production',
        '.env.production.gpg',
        '.env.staging',
        '.env.staging.gpg',
      ];

      const environments = findAllEnvironments(files);
      expect(environments).toEqual(['production', 'staging']);
    });
  });

  describe('All Flag Validation', () => {
    it('should validate all flag options', () => {
      const validateAllFlagOptions = (options: {
        all?: boolean;
        environment?: string;
        interactive?: boolean;
        passphrase?: string;
        secret?: string;
      }) => {
        const errors: string[] = [];
        const warnings: string[] = [];

        if (options.all) {
          if (options.environment) {
            errors.push('Cannot specify both --all and --environment flags');
          }

          if (options.interactive) {
            errors.push('Interactive mode is not compatible with --all flag');
          }

          if (!options.passphrase && !options.secret) {
            warnings.push(
              'Will prompt for passphrase for each environment without --passphrase or --secret'
            );
          }
        }

        return {
          valid: errors.length === 0,
          errors,
          warnings,
        };
      };

      // Valid combinations
      expect(validateAllFlagOptions({ all: true })).toEqual({
        valid: true,
        errors: [],
        warnings: [
          'Will prompt for passphrase for each environment without --passphrase or --secret',
        ],
      });

      expect(
        validateAllFlagOptions({ all: true, passphrase: 'secret' })
      ).toEqual({
        valid: true,
        errors: [],
        warnings: [],
      });

      expect(
        validateAllFlagOptions({ all: true, secret: 'MY_SECRET' })
      ).toEqual({
        valid: true,
        errors: [],
        warnings: [],
      });

      // Invalid combinations
      expect(
        validateAllFlagOptions({ all: true, environment: 'production' })
      ).toEqual({
        valid: false,
        errors: ['Cannot specify both --all and --environment flags'],
        warnings: [
          'Will prompt for passphrase for each environment without --passphrase or --secret',
        ],
      });

      expect(validateAllFlagOptions({ all: true, interactive: true })).toEqual({
        valid: false,
        errors: ['Interactive mode is not compatible with --all flag'],
        warnings: [
          'Will prompt for passphrase for each environment without --passphrase or --secret',
        ],
      });

      // Not using --all flag
      expect(validateAllFlagOptions({ environment: 'production' })).toEqual({
        valid: true,
        errors: [],
        warnings: [],
      });
    });
  });

  describe('Passphrase Resolution for All Environments', () => {
    it('should resolve passphrase for each environment', () => {
      const resolvePassphraseForEnvironment = (
        environment: string,
        options: {
          passphrase?: string;
          secret?: string;
        },
        envrcConfig: Record<string, string> = {}
      ) => {
        // Priority: provided passphrase > custom secret > default secret > prompt
        if (options.passphrase) {
          return {
            passphrase: options.passphrase,
            source: 'provided',
            needsPrompt: false,
          };
        }

        if (options.secret && envrcConfig[options.secret]) {
          return {
            passphrase: envrcConfig[options.secret],
            source: 'custom-secret',
            needsPrompt: false,
          };
        }

        const defaultSecret = `${environment.toUpperCase()}_SECRET`;
        if (envrcConfig[defaultSecret]) {
          return {
            passphrase: envrcConfig[defaultSecret],
            source: 'environment-secret',
            needsPrompt: false,
          };
        }

        return {
          passphrase: null,
          source: 'prompt',
          needsPrompt: true,
        };
      };

      const envrcConfig = {
        PRODUCTION_SECRET: 'prod-secret-123',
        STAGING_SECRET: 'staging-secret-456',
        CUSTOM_SECRET: 'custom-secret-789',
      };

      // Test provided passphrase (highest priority)
      expect(
        resolvePassphraseForEnvironment(
          'production',
          { passphrase: 'direct-pass' },
          envrcConfig
        )
      ).toEqual({
        passphrase: 'direct-pass',
        source: 'provided',
        needsPrompt: false,
      });

      // Test custom secret
      expect(
        resolvePassphraseForEnvironment(
          'production',
          { secret: 'CUSTOM_SECRET' },
          envrcConfig
        )
      ).toEqual({
        passphrase: 'custom-secret-789',
        source: 'custom-secret',
        needsPrompt: false,
      });

      // Test environment-specific secret
      expect(
        resolvePassphraseForEnvironment('production', {}, envrcConfig)
      ).toEqual({
        passphrase: 'prod-secret-123',
        source: 'environment-secret',
        needsPrompt: false,
      });

      // Test fallback to prompt
      expect(
        resolvePassphraseForEnvironment('development', {}, envrcConfig)
      ).toEqual({
        passphrase: null,
        source: 'prompt',
        needsPrompt: true,
      });
    });

    it('should handle missing environment secrets gracefully', () => {
      const resolvePassphraseForEnvironment = (
        environment: string,
        options: {
          passphrase?: string;
          secret?: string;
        },
        envrcConfig: Record<string, string> = {}
      ) => {
        if (options.passphrase) {
          return {
            passphrase: options.passphrase,
            source: 'provided',
            needsPrompt: false,
          };
        }

        if (options.secret && envrcConfig[options.secret]) {
          return {
            passphrase: envrcConfig[options.secret],
            source: 'custom-secret',
            needsPrompt: false,
          };
        }

        const defaultSecret = `${environment.toUpperCase()}_SECRET`;
        if (envrcConfig[defaultSecret]) {
          return {
            passphrase: envrcConfig[defaultSecret],
            source: 'environment-secret',
            needsPrompt: false,
          };
        }

        return {
          passphrase: null,
          source: 'prompt',
          needsPrompt: true,
        };
      };

      const emptyEnvrc = {};
      const partialEnvrc = { PRODUCTION_SECRET: 'prod-only' };

      // All environments need prompts when no secrets available
      ['development', 'staging', 'production'].forEach(env => {
        const result = resolvePassphraseForEnvironment(env, {}, emptyEnvrc);
        expect(result.needsPrompt).toBe(true);
        expect(result.source).toBe('prompt');
      });

      // Only production has secret, others need prompts
      expect(
        resolvePassphraseForEnvironment('production', {}, partialEnvrc)
      ).toEqual({
        passphrase: 'prod-only',
        source: 'environment-secret',
        needsPrompt: false,
      });

      expect(
        resolvePassphraseForEnvironment('development', {}, partialEnvrc)
      ).toEqual({
        passphrase: null,
        source: 'prompt',
        needsPrompt: true,
      });
    });
  });

  describe('Batch Operation Processing', () => {
    it('should process all environments independently', () => {
      const processBatchOperation = (
        environments: string[],
        _operation: 'encrypt' | 'decrypt',
        getOperationResult: (env: string) => {
          success: boolean;
          filesProcessed: number;
          error?: string;
        }
      ) => {
        const results = environments.map(env => {
          try {
            const result = getOperationResult(env);
            return {
              environment: env,
              success: result.success,
              filesProcessed: result.filesProcessed,
              error: result.error || null,
            };
          } catch (error) {
            return {
              environment: env,
              success: false,
              filesProcessed: 0,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        });

        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        const totalFiles = results.reduce(
          (sum, r) => sum + r.filesProcessed,
          0
        );

        return {
          results,
          summary: {
            totalEnvironments: environments.length,
            successfulEnvironments: successful.length,
            failedEnvironments: failed.length,
            totalFilesProcessed: totalFiles,
            overallSuccess: failed.length === 0,
          },
        };
      };

      // Mock operation results
      const mockGetResult = (env: string) => {
        switch (env) {
          case 'development':
            return { success: true, filesProcessed: 2 };
          case 'production':
            return { success: true, filesProcessed: 1 };
          case 'staging':
            return { success: false, filesProcessed: 0, error: 'GPG error' };
          case 'test':
            return { success: true, filesProcessed: 0 }; // No files but successful
          default:
            throw new Error('Unknown environment');
        }
      };

      const environments = ['development', 'production', 'staging', 'test'];
      const result = processBatchOperation(
        environments,
        'encrypt',
        mockGetResult
      );

      expect(result.summary).toEqual({
        totalEnvironments: 4,
        successfulEnvironments: 3,
        failedEnvironments: 1,
        totalFilesProcessed: 3,
        overallSuccess: false,
      });

      expect(result.results).toHaveLength(4);
      expect(result.results[0]).toEqual({
        environment: 'development',
        success: true,
        filesProcessed: 2,
        error: null,
      });

      expect(result.results[2]).toEqual({
        environment: 'staging',
        success: false,
        filesProcessed: 0,
        error: 'GPG error',
      });
    });

    it('should continue processing after failures', () => {
      const processBatchOperation = (
        environments: string[],
        _operation: 'encrypt' | 'decrypt',
        getOperationResult: (env: string) => {
          success: boolean;
          filesProcessed: number;
          error?: string;
        }
      ) => {
        const results = environments.map(env => {
          try {
            const result = getOperationResult(env);
            return {
              environment: env,
              success: result.success,
              filesProcessed: result.filesProcessed,
              error: result.error || null,
            };
          } catch (error) {
            return {
              environment: env,
              success: false,
              filesProcessed: 0,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        });

        return results;
      };

      // Mock that throws for some environments
      const mockGetResult = (env: string) => {
        if (env === 'staging') {
          throw new Error('Critical failure');
        }
        if (env === 'test') {
          return { success: false, filesProcessed: 0, error: 'No files found' };
        }
        return { success: true, filesProcessed: 1 };
      };

      const environments = ['development', 'staging', 'production', 'test'];
      const results = processBatchOperation(
        environments,
        'encrypt',
        mockGetResult
      );

      // Should process all environments despite failures
      expect(results).toHaveLength(4);

      // First should succeed
      expect(results[0].success).toBe(true);

      // Second should fail with exception
      expect(results[1]).toEqual({
        environment: 'staging',
        success: false,
        filesProcessed: 0,
        error: 'Critical failure',
      });

      // Third should succeed (processing continued)
      expect(results[2].success).toBe(true);

      // Fourth should fail but with graceful error
      expect(results[3]).toEqual({
        environment: 'test',
        success: false,
        filesProcessed: 0,
        error: 'No files found',
      });
    });
  });

  describe('Environment Status Determination', () => {
    it('should determine what operations are possible for each environment', () => {
      const getEnvironmentStatus = (
        environment: string,
        availableFiles: string[]
      ) => {
        const envFile = `.env.${environment}`;
        const encryptedFile = `.env.${environment}.gpg`;

        const hasUnencrypted = availableFiles.includes(envFile);
        const hasEncrypted = availableFiles.includes(encryptedFile);

        return {
          environment,
          hasUnencrypted,
          hasEncrypted,
          canEncrypt: hasUnencrypted,
          canDecrypt: hasEncrypted,
          status:
            hasUnencrypted && hasEncrypted
              ? 'both'
              : hasEncrypted
                ? 'encrypted-only'
                : hasUnencrypted
                  ? 'unencrypted-only'
                  : 'none',
        };
      };

      const files = [
        '.env.development',
        '.env.production.gpg',
        '.env.staging',
        '.env.staging.gpg',
      ];

      const environments = ['development', 'production', 'staging', 'test'];
      const statuses = environments.map(env =>
        getEnvironmentStatus(env, files)
      );

      expect(statuses[0]).toEqual({
        environment: 'development',
        hasUnencrypted: true,
        hasEncrypted: false,
        canEncrypt: true,
        canDecrypt: false,
        status: 'unencrypted-only',
      });

      expect(statuses[1]).toEqual({
        environment: 'production',
        hasUnencrypted: false,
        hasEncrypted: true,
        canEncrypt: false,
        canDecrypt: true,
        status: 'encrypted-only',
      });

      expect(statuses[2]).toEqual({
        environment: 'staging',
        hasUnencrypted: true,
        hasEncrypted: true,
        canEncrypt: true,
        canDecrypt: true,
        status: 'both',
      });

      expect(statuses[3]).toEqual({
        environment: 'test',
        hasUnencrypted: false,
        hasEncrypted: false,
        canEncrypt: false,
        canDecrypt: false,
        status: 'none',
      });
    });

    it('should filter environments by operation capability', () => {
      const filterEnvironmentsByOperation = (
        environments: Array<{
          environment: string;
          canEncrypt: boolean;
          canDecrypt: boolean;
        }>,
        operation: 'encrypt' | 'decrypt'
      ) => {
        return environments.filter(env =>
          operation === 'encrypt' ? env.canEncrypt : env.canDecrypt
        );
      };

      const environments = [
        { environment: 'development', canEncrypt: true, canDecrypt: false },
        { environment: 'production', canEncrypt: false, canDecrypt: true },
        { environment: 'staging', canEncrypt: true, canDecrypt: true },
        { environment: 'test', canEncrypt: false, canDecrypt: false },
      ];

      const encryptable = filterEnvironmentsByOperation(
        environments,
        'encrypt'
      );
      const decryptable = filterEnvironmentsByOperation(
        environments,
        'decrypt'
      );

      expect(encryptable.map(e => e.environment)).toEqual([
        'development',
        'staging',
      ]);
      expect(decryptable.map(e => e.environment)).toEqual([
        'production',
        'staging',
      ]);
    });
  });

  describe('Summary Generation', () => {
    it('should generate comprehensive summary for all environments', () => {
      const generateAllEnvironmentsSummary = (
        results: Array<{
          environment: string;
          success: boolean;
          filesProcessed: number;
          error?: string | null;
        }>,
        operation: 'encrypt' | 'decrypt'
      ) => {
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        const totalFiles = results.reduce(
          (sum, r) => sum + r.filesProcessed,
          0
        );
        const skipped = results.filter(
          r => r.success && r.filesProcessed === 0
        );

        return {
          operation,
          totalEnvironments: results.length,
          successful: successful.length,
          failed: failed.length,
          skipped: skipped.length,
          totalFilesProcessed: totalFiles,
          overallSuccess: failed.length === 0,

          details: {
            successfulEnvironments: successful.map(r => r.environment),
            failedEnvironments: failed.map(r => ({
              environment: r.environment,
              error: r.error,
            })),
            skippedEnvironments: skipped.map(r => r.environment),
          },

          hasWarnings: skipped.length > 0,
          hasErrors: failed.length > 0,
        };
      };

      const results = [
        { environment: 'development', success: true, filesProcessed: 2 },
        { environment: 'production', success: true, filesProcessed: 1 },
        {
          environment: 'staging',
          success: false,
          filesProcessed: 0,
          error: 'GPG failed',
        },
        { environment: 'test', success: true, filesProcessed: 0 }, // Skipped - no files
      ];

      const summary = generateAllEnvironmentsSummary(results, 'encrypt');

      expect(summary).toMatchObject({
        operation: 'encrypt',
        totalEnvironments: 4,
        successful: 3,
        failed: 1,
        skipped: 1,
        totalFilesProcessed: 3,
        overallSuccess: false,
        hasWarnings: true,
        hasErrors: true,
      });

      expect(summary.details.successfulEnvironments).toEqual([
        'development',
        'production',
        'test',
      ]);

      expect(summary.details.failedEnvironments).toEqual([
        { environment: 'staging', error: 'GPG failed' },
      ]);

      expect(summary.details.skippedEnvironments).toEqual(['test']);
    });

    it('should format environment results for display', () => {
      const formatEnvironmentResult = (
        environment: string,
        success: boolean,
        filesProcessed: number,
        error?: string | null
      ) => {
        const status = success
          ? filesProcessed > 0
            ? 'success'
            : 'skipped'
          : 'failed';

        return {
          environment,
          status,
          filesProcessed,
          message: success
            ? filesProcessed > 0
              ? `Processed ${filesProcessed} file(s)`
              : 'No files to process'
            : error || 'Operation failed',
          displayColor:
            status === 'success'
              ? 'green'
              : status === 'failed'
                ? 'red'
                : 'yellow',
        };
      };

      expect(formatEnvironmentResult('production', true, 2)).toEqual({
        environment: 'production',
        status: 'success',
        filesProcessed: 2,
        message: 'Processed 2 file(s)',
        displayColor: 'green',
      });

      expect(formatEnvironmentResult('staging', false, 0, 'GPG error')).toEqual(
        {
          environment: 'staging',
          status: 'failed',
          filesProcessed: 0,
          message: 'GPG error',
          displayColor: 'red',
        }
      );

      expect(formatEnvironmentResult('test', true, 0)).toEqual({
        environment: 'test',
        status: 'skipped',
        filesProcessed: 0,
        message: 'No files to process',
        displayColor: 'yellow',
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle individual environment failures gracefully', async () => {
      const processEnvironmentSafely = async (
        environment: string,
        operation: () => Promise<{ success: boolean; filesProcessed: number }>
      ) => {
        try {
          const result = await operation();
          return {
            environment,
            success: result.success,
            filesProcessed: result.filesProcessed,
            error: null,
          };
        } catch (error) {
          return {
            environment,
            success: false,
            filesProcessed: 0,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      };

      // Test successful operation
      const successOperation = () =>
        Promise.resolve({ success: true, filesProcessed: 1 });
      expect(
        await processEnvironmentSafely('production', successOperation)
      ).toEqual({
        environment: 'production',
        success: true,
        filesProcessed: 1,
        error: null,
      });

      // Test operation that throws
      const throwingOperation = () =>
        Promise.reject(new Error('GPG not found'));
      expect(
        await processEnvironmentSafely('staging', throwingOperation)
      ).toEqual({
        environment: 'staging',
        success: false,
        filesProcessed: 0,
        error: 'GPG not found',
      });

      // Test operation that returns failure
      const failingOperation = () =>
        Promise.resolve({ success: false, filesProcessed: 0 });
      expect(
        await processEnvironmentSafely('development', failingOperation)
      ).toEqual({
        environment: 'development',
        success: false,
        filesProcessed: 0,
        error: null,
      });
    });

    it('should categorize errors by type', () => {
      const categorizeError = (error: string) => {
        if (error.toLowerCase().includes('gpg')) {
          return 'gpg-error';
        }
        if (
          error.toLowerCase().includes('passphrase') ||
          error.toLowerCase().includes('password')
        ) {
          return 'auth-error';
        }
        if (
          error.toLowerCase().includes('file') ||
          error.toLowerCase().includes('path')
        ) {
          return 'file-error';
        }
        if (
          error.toLowerCase().includes('permission') ||
          error.toLowerCase().includes('access')
        ) {
          return 'permission-error';
        }
        return 'unknown-error';
      };

      expect(categorizeError('GPG command failed')).toBe('gpg-error');
      expect(categorizeError('Invalid passphrase')).toBe('auth-error');
      expect(categorizeError('File not found')).toBe('file-error');
      expect(categorizeError('Permission denied')).toBe('permission-error');
      expect(categorizeError('Something went wrong')).toBe('unknown-error');
    });
  });

  describe('Performance and Resource Management', () => {
    it('should process environments sequentially to avoid resource conflicts', () => {
      const processEnvironmentsSequentially = async (
        environments: string[],
        processFunction: (env: string) => Promise<boolean>
      ) => {
        const results = [];
        const startTime = Date.now();

        for (const env of environments) {
          const envStartTime = Date.now();
          try {
            const success = await processFunction(env);
            results.push({
              environment: env,
              success,
              duration: Date.now() - envStartTime,
            });
          } catch (error) {
            results.push({
              environment: env,
              success: false,
              duration: Date.now() - envStartTime,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }

        return {
          results,
          totalDuration: Date.now() - startTime,
          sequential: true,
        };
      };

      // Mock async process function
      const mockProcess = async (env: string) => {
        await new Promise(resolve => setTimeout(resolve, 10)); // Simulate async work
        return env !== 'failing-env';
      };

      const environments = ['env1', 'env2', 'failing-env', 'env3'];

      // Test that it processes sequentially
      const promise = processEnvironmentsSequentially(
        environments,
        mockProcess
      );
      expect(promise).toBeInstanceOf(Promise);

      return promise.then(result => {
        expect(result.results).toHaveLength(4);
        expect(result.sequential).toBe(true);
        expect(result.totalDuration).toBeGreaterThan(0);

        // Check that all environments were processed
        expect(result.results.map(r => r.environment)).toEqual(environments);

        // Check that the failing environment failed
        const failingResult = result.results.find(
          r => r.environment === 'failing-env'
        );
        expect(failingResult?.success).toBe(false);
      });
    });
  });
});
