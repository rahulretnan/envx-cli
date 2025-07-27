import { FileUtils } from "../../src/utils/file";

describe("FileUtils Core Operations", () => {
  describe("generateRandomSecret", () => {
    it("should generate secret of default length", () => {
      const secret = FileUtils.generateRandomSecret();

      expect(secret).toHaveLength(64); // 32 bytes = 64 hex chars
      expect(secret).toMatch(/^[a-f0-9]+$/);
    });

    it("should generate secret of specified length", () => {
      const secret = FileUtils.generateRandomSecret(16);

      expect(secret).toHaveLength(32); // 16 bytes = 32 hex chars
      expect(secret).toMatch(/^[a-f0-9]+$/);
    });

    it("should generate different secrets each time", () => {
      const secret1 = FileUtils.generateRandomSecret();
      const secret2 = FileUtils.generateRandomSecret();

      expect(secret1).not.toBe(secret2);
    });

    it("should generate hex-encoded secrets", () => {
      const secret = FileUtils.generateRandomSecret(4);
      expect(secret).toMatch(/^[a-f0-9]{8}$/);
    });
  });

  describe("generateSecretVariableName", () => {
    it("should generate correct variable name", () => {
      const result = FileUtils.generateSecretVariableName("production");
      expect(result).toBe("PRODUCTION_SECRET");
    });

    it("should handle mixed case input", () => {
      const result = FileUtils.generateSecretVariableName("ProDucTion");
      expect(result).toBe("PRODUCTION_SECRET");
    });

    it("should handle special characters", () => {
      const result = FileUtils.generateSecretVariableName("test-env_123");
      expect(result).toBe("TEST-ENV_123_SECRET");
    });

    it("should handle lowercase input", () => {
      const result = FileUtils.generateSecretVariableName("development");
      expect(result).toBe("DEVELOPMENT_SECRET");
    });
  });

  describe("isValidEnvironmentName", () => {
    it("should accept valid environment names", () => {
      expect(FileUtils.isValidEnvironmentName("development")).toBe(true);
      expect(FileUtils.isValidEnvironmentName("test-env")).toBe(true);
      expect(FileUtils.isValidEnvironmentName("prod_123")).toBe(true);
      expect(FileUtils.isValidEnvironmentName("env123")).toBe(true);
      expect(FileUtils.isValidEnvironmentName("LOCAL")).toBe(true);
    });

    it("should reject invalid environment names", () => {
      expect(FileUtils.isValidEnvironmentName("")).toBe(false);
      expect(FileUtils.isValidEnvironmentName("test env")).toBe(false);
      expect(FileUtils.isValidEnvironmentName("test@env")).toBe(false);
      expect(FileUtils.isValidEnvironmentName("test.env")).toBe(false);
      expect(FileUtils.isValidEnvironmentName("test/env")).toBe(false);
    });

    it("should reject names with special characters", () => {
      expect(FileUtils.isValidEnvironmentName("env$test")).toBe(false);
      expect(FileUtils.isValidEnvironmentName("env!test")).toBe(false);
      expect(FileUtils.isValidEnvironmentName("env#test")).toBe(false);
      expect(FileUtils.isValidEnvironmentName("env%test")).toBe(false);
    });
  });

  describe("path utilities", () => {
    it("should get encrypted path correctly", () => {
      const result = FileUtils.getEncryptedPath("/test/.env.production");
      expect(result).toBe("/test/.env.production.gpg");
    });

    it("should get encrypted path for relative paths", () => {
      const result = FileUtils.getEncryptedPath(".env.development");
      expect(result).toBe(".env.development.gpg");
    });

    it("should get decrypted path correctly", () => {
      const result = FileUtils.getDecryptedPath("/test/.env.production.gpg");
      expect(result).toBe("/test/.env.production");
    });

    it("should get decrypted path for relative paths", () => {
      const result = FileUtils.getDecryptedPath(".env.staging.gpg");
      expect(result).toBe(".env.staging");
    });

    it("should identify encrypted files", () => {
      expect(FileUtils.isEncryptedFile(".env.production.gpg")).toBe(true);
      expect(FileUtils.isEncryptedFile("/path/.env.production.gpg")).toBe(true);
    });

    it("should identify non-encrypted files", () => {
      expect(FileUtils.isEncryptedFile(".env.production")).toBe(false);
      expect(FileUtils.isEncryptedFile("/path/.env.production")).toBe(false);
    });

    it("should get relative path correctly", () => {
      const result = FileUtils.getRelativePath(
        "/base/path/to/file.txt",
        "/base",
      );
      expect(result).toBe("path/to/file.txt");
    });

    it("should handle same directory paths", () => {
      const result = FileUtils.getRelativePath("/base/file.txt", "/base");
      expect(result).toBe("file.txt");
    });

    it("should handle current directory", () => {
      const result = FileUtils.getRelativePath("/base", "/base");
      expect(result).toBe("");
    });
  });

  describe("path manipulation edge cases", () => {
    it("should handle empty paths", () => {
      expect(FileUtils.getEncryptedPath("")).toBe(".gpg");
      expect(FileUtils.getDecryptedPath(".gpg")).toBe("");
    });

    it("should handle paths without extensions", () => {
      expect(FileUtils.getEncryptedPath("envfile")).toBe("envfile.gpg");
      expect(FileUtils.isEncryptedFile("envfile")).toBe(false);
    });

    it("should handle multiple .gpg extensions", () => {
      expect(FileUtils.getDecryptedPath("file.gpg.gpg")).toBe("file.gpg");
      expect(FileUtils.isEncryptedFile("file.gpg.gpg")).toBe(true);
    });

    it("should handle Windows-style paths", () => {
      const windowsPath = "C:\\project\\.env.production";
      expect(FileUtils.getEncryptedPath(windowsPath)).toBe(
        "C:\\project\\.env.production.gpg",
      );
    });
  });

  describe("environment name validation edge cases", () => {
    it("should handle single character names", () => {
      expect(FileUtils.isValidEnvironmentName("a")).toBe(true);
      expect(FileUtils.isValidEnvironmentName("1")).toBe(true);
      expect(FileUtils.isValidEnvironmentName("-")).toBe(true);
      expect(FileUtils.isValidEnvironmentName("_")).toBe(true);
    });

    it("should handle very long names", () => {
      const longName = "a".repeat(100);
      expect(FileUtils.isValidEnvironmentName(longName)).toBe(true);
    });

    it("should handle names starting with numbers", () => {
      expect(FileUtils.isValidEnvironmentName("123env")).toBe(true);
    });

    it("should handle names starting with special characters", () => {
      expect(FileUtils.isValidEnvironmentName("-env")).toBe(true);
      expect(FileUtils.isValidEnvironmentName("_env")).toBe(true);
    });
  });

  describe("secret variable name generation edge cases", () => {
    it("should handle empty input", () => {
      const result = FileUtils.generateSecretVariableName("");
      expect(result).toBe("_SECRET");
    });

    it("should handle numeric input", () => {
      const result = FileUtils.generateSecretVariableName("123");
      expect(result).toBe("123_SECRET");
    });

    it("should handle input with multiple separators", () => {
      const result = FileUtils.generateSecretVariableName("test-env_name");
      expect(result).toBe("TEST-ENV_NAME_SECRET");
    });

    it("should preserve original casing patterns", () => {
      const result = FileUtils.generateSecretVariableName("CamelCase");
      expect(result).toBe("CAMELCASE_SECRET");
    });
  });

  describe("relative path calculation edge cases", () => {
    it("should handle identical paths", () => {
      const result = FileUtils.getRelativePath("/same/path", "/same/path");
      expect(result).toBe("");
    });

    it("should handle nested paths", () => {
      const result = FileUtils.getRelativePath(
        "/base/very/deep/nested/file.txt",
        "/base",
      );
      expect(result).toBe("very/deep/nested/file.txt");
    });

    it("should handle parent directory paths", () => {
      const result = FileUtils.getRelativePath("/base/file.txt", "/base/sub");
      expect(result).toBe("../file.txt");
    });

    it("should handle completely different paths", () => {
      const result = FileUtils.getRelativePath("/other/path", "/base");
      expect(result).toBe("../other/path");
    });
  });

  describe("file extension handling", () => {
    it("should handle files with no extension", () => {
      expect(FileUtils.isEncryptedFile("README")).toBe(false);
      expect(FileUtils.getEncryptedPath("README")).toBe("README.gpg");
    });

    it("should handle files with multiple extensions", () => {
      expect(FileUtils.isEncryptedFile(".env.local.backup.gpg")).toBe(true);
      expect(FileUtils.getDecryptedPath(".env.local.backup.gpg")).toBe(
        ".env.local.backup",
      );
    });

    it("should handle hidden files", () => {
      expect(FileUtils.isEncryptedFile(".hidden.gpg")).toBe(true);
      expect(FileUtils.getEncryptedPath(".hidden")).toBe(".hidden.gpg");
    });
  });
});
