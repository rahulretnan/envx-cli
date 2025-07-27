import {
  validateCreateOptions,
  validateDecryptOptions,
  validateEncryptOptions,
  validateInteractiveOptions,
} from '../../src/schemas';

describe('Schema Validation Core', () => {
  describe('validateEncryptOptions', () => {
    it('should validate correct encrypt options', () => {
      const options = {
        environment: 'production',
        passphrase: 'test-passphrase',
        cwd: '/test/path',
      };

      const result = validateEncryptOptions(options);
      expect(result).toEqual(options);
    });

    it('should require environment', () => {
      expect(() => {
        validateEncryptOptions({
          passphrase: 'test-passphrase',
        });
      }).toThrow(/environment.*required/i);
    });

    it('should require passphrase', () => {
      expect(() => {
        validateEncryptOptions({
          environment: 'production',
        });
      }).toThrow(/passphrase.*required/i);
    });

    it('should reject empty environment', () => {
      expect(() => {
        validateEncryptOptions({
          environment: '',
          passphrase: 'test-passphrase',
        });
      }).toThrow();
    });

    it('should accept optional fields', () => {
      const options = {
        environment: 'test',
        passphrase: 'test-pass',
        cwd: '/custom/path',
        secret: 'CUSTOM_SECRET',
      };

      const result = validateEncryptOptions(options);
      expect(result.cwd).toBe('/custom/path');
      expect(result.secret).toBe('CUSTOM_SECRET');
    });
  });

  describe('validateDecryptOptions', () => {
    it('should validate correct decrypt options', () => {
      const options = {
        environment: 'production',
        passphrase: 'test-passphrase',
      };

      const result = validateDecryptOptions(options);
      expect(result).toEqual(options);
    });

    it('should require environment', () => {
      expect(() => {
        validateDecryptOptions({
          passphrase: 'test-passphrase',
        });
      }).toThrow(/environment.*required/i);
    });

    it('should require passphrase', () => {
      expect(() => {
        validateDecryptOptions({
          environment: 'production',
        });
      }).toThrow(/passphrase.*required/i);
    });

    it('should handle optional cwd', () => {
      const options = {
        environment: 'production',
        passphrase: 'secure-pass',
        cwd: '/project/path',
      };

      const result = validateDecryptOptions(options);
      expect(result.cwd).toBe('/project/path');
    });
  });

  describe('validateCreateOptions', () => {
    it('should validate correct create options', () => {
      const options = {
        environment: 'development',
        cwd: '/test/path',
      };

      const result = validateCreateOptions(options);
      expect(result).toEqual(options);
    });

    it('should require environment', () => {
      expect(() => {
        validateCreateOptions({
          cwd: '/test/path',
        });
      }).toThrow(/environment.*required/i);
    });

    it('should reject empty environment', () => {
      expect(() => {
        validateCreateOptions({
          environment: '',
          cwd: '/test/path',
        });
      }).toThrow();
    });

    it('should handle optional template', () => {
      const options = {
        environment: 'staging',
        template: '.env.example',
        cwd: '/test/path',
      };

      const result = validateCreateOptions(options);
      expect(result.template).toBe('.env.example');
    });

    it('should work with minimal options', () => {
      const options = {
        environment: 'development',
      };

      const result = validateCreateOptions(options);
      expect(result.environment).toBe('development');
      expect(result.template).toBeUndefined();
      expect(result.cwd).toBeUndefined();
    });
  });

  describe('validateInteractiveOptions', () => {
    it('should validate empty options', () => {
      const result = validateInteractiveOptions({});
      expect(result).toEqual({});
    });

    it('should handle cwd option', () => {
      const options = { cwd: '/test/path' };
      const result = validateInteractiveOptions(options);
      expect(result.cwd).toBe('/test/path');
    });

    it('should handle overwrite option', () => {
      const options = { overwrite: true };
      const result = validateInteractiveOptions(options);
      expect(result.overwrite).toBe(true);
    });

    it('should handle all options together', () => {
      const options = {
        cwd: '/test/path',
        overwrite: false,
      };

      const result = validateInteractiveOptions(options);
      expect(result).toEqual(options);
    });
  });

  describe('input validation edge cases', () => {
    it('should handle special characters in environment names', () => {
      const options = {
        environment: 'test-env_123',
        passphrase: 'pass',
      };

      const result = validateEncryptOptions(options);
      expect(result.environment).toBe('test-env_123');
    });

    it('should handle special characters in passphrases', () => {
      const options = {
        environment: 'test',
        passphrase: 'p@ssw0rd!#$%^&*()',
      };

      const result = validateEncryptOptions(options);
      expect(result.passphrase).toBe('p@ssw0rd!#$%^&*()');
    });

    it('should handle paths with spaces', () => {
      const options = {
        environment: 'test',
        passphrase: 'pass',
        cwd: '/path with spaces/project',
      };

      const result = validateEncryptOptions(options);
      expect(result.cwd).toBe('/path with spaces/project');
    });

    it('should reject non-string environment', () => {
      expect(() => {
        validateEncryptOptions({
          environment: 123,
          passphrase: 'pass',
        } as any);
      }).toThrow();
    });

    it('should reject non-string passphrase', () => {
      expect(() => {
        validateEncryptOptions({
          environment: 'test',
          passphrase: true,
        } as any);
      }).toThrow();
    });

    it('should reject null input', () => {
      expect(() => {
        validateEncryptOptions(null as any);
      }).toThrow();
    });

    it('should reject undefined input', () => {
      expect(() => {
        validateEncryptOptions(undefined as any);
      }).toThrow();
    });
  });
});
