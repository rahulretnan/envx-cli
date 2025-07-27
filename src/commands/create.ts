import chalk from "chalk";
import { Command } from "commander";
import path from "path";
import { validateCreateOptions } from "../schemas";
import { CliUtils, ExecUtils } from "../utils/exec";
import { FileUtils } from "../utils/file";
import { InteractiveUtils } from "../utils/interactive";

export const createCreateCommand = (): Command => {
  const command = new Command("create");

  command
    .description("Create new environment files")
    .option(
      "-e, --environment <env>",
      "Environment name (e.g., development, staging, production)",
    )
    .option("-t, --template <path>", "Template file path to use as base")
    .option("-c, --cwd <path>", "Working directory path")
    .option(
      "-i, --interactive",
      "Interactive mode for creating multiple environments",
    )
    .option("--overwrite", "Overwrite existing files without confirmation")
    .action(async (options) => {
      try {
        await executeCreate(options);
      } catch (error) {
        CliUtils.error(
          `File creation failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        process.exit(1);
      }
    });

  return command;
};

async function executeCreate(rawOptions: any): Promise<void> {
  CliUtils.header("Environment File Creation");

  // Get working directory
  const cwd = rawOptions.cwd || ExecUtils.getCurrentDir();

  // Find existing environments
  const existingEnvironments = await FileUtils.findAllEnvironments(cwd);

  if (existingEnvironments.length > 0) {
    CliUtils.info(
      `Existing environments: ${existingEnvironments.map((env) => CliUtils.formatEnvironment(env)).join(", ")}`,
    );
  }

  let environment = rawOptions.environment;
  let template = rawOptions.template;

  // Interactive mode for creating multiple environments
  if (rawOptions.interactive) {
    await executeInteractiveCreate(
      cwd,
      existingEnvironments,
      template,
      rawOptions.overwrite,
    );
    return;
  }

  // Single environment creation
  if (!environment) {
    environment = await InteractiveUtils.promptEnvironmentName(
      "Enter environment name:",
    );
  }

  // Validate environment name
  if (!FileUtils.isValidEnvironmentName(environment)) {
    throw new Error(
      "Environment name can only contain letters, numbers, hyphens, and underscores",
    );
  }

  // Validate options
  const options = validateCreateOptions({
    environment,
    template,
    cwd,
  });

  // Check if environment already exists
  if (existingEnvironments.includes(environment)) {
    CliUtils.warning(`Environment '${environment}' already exists`);

    const envFiles = await FileUtils.findEnvFiles(environment, cwd);
    if (envFiles.length > 0) {
      console.log("Existing files:");
      envFiles.forEach((file) => {
        const displayPath = file.encrypted
          ? FileUtils.getEncryptedPath(file.path)
          : file.path;
        console.log(`  • ${CliUtils.formatPath(displayPath, cwd)}`);
      });

      if (!rawOptions.overwrite) {
        const confirm = await InteractiveUtils.confirmOperation(
          "Do you want to create additional files for this environment?",
          false,
        );
        if (!confirm) {
          CliUtils.info("Operation cancelled.");
          return;
        }
      }
    }
  }

  // Check if template exists
  if (template) {
    const templatePath = path.isAbsolute(template)
      ? template
      : path.join(cwd, template);
    if (!(await FileUtils.fileExists(templatePath))) {
      throw new Error(`Template file not found: ${template}`);
    }
    template = templatePath;
  }

  // Create the environment file
  const envFilePath = path.join(cwd, `.env.${environment}`);
  const relativePath = FileUtils.getRelativePath(envFilePath, cwd);

  // Check if file already exists
  if ((await FileUtils.fileExists(envFilePath)) && !rawOptions.overwrite) {
    const confirm = await InteractiveUtils.confirmOperation(
      `File ${chalk.cyan(relativePath)} already exists. Overwrite?`,
      false,
    );
    if (!confirm) {
      CliUtils.info("Operation cancelled.");
      return;
    }
  }

  CliUtils.info(`Creating environment file: ${chalk.cyan(relativePath)}`);

  try {
    const result = await FileUtils.createEnvTemplate(envFilePath, template);

    if (result.success) {
      CliUtils.success(`Created: ${chalk.cyan(relativePath)}`);

      // Show next steps
      console.log();
      CliUtils.info("Next steps:");
      console.log(
        chalk.gray(`• Edit ${relativePath} and add your environment variables`),
      );
      console.log(
        chalk.gray(
          `• Use "envx encrypt -e ${environment}" to encrypt the file`,
        ),
      );
      console.log(
        chalk.gray("• Add the encrypted .gpg file to version control"),
      );
    } else {
      CliUtils.error(result.message);
      if (result.error) {
        console.log(chalk.red(`  • ${result.error.message}`));
      }
    }
  } catch (error) {
    CliUtils.error(
      `Failed to create file: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function executeInteractiveCreate(
  cwd: string,
  existingEnvironments: string[],
  template?: string,
  overwrite?: boolean,
): Promise<void> {
  CliUtils.subheader("Interactive Environment Creation");

  // Show common environment suggestions
  const commonEnvironments = [
    "development",
    "staging",
    "production",
    "local",
    "test",
  ];
  const suggestedEnvironments = commonEnvironments.filter(
    (env) => !existingEnvironments.includes(env),
  );

  if (suggestedEnvironments.length > 0) {
    CliUtils.info("Suggested environments:");
    suggestedEnvironments.forEach((env) => {
      console.log(`  • ${CliUtils.formatEnvironment(env)}`);
    });
    console.log();
  }

  // Get environments to create
  const { createMode } = (await InteractiveUtils.confirmOperation(
    "Do you want to select from suggested environments?",
  ))
    ? { createMode: "suggested" }
    : { createMode: "custom" };

  let environmentsToCreate: string[] = [];

  if (createMode === "suggested" && suggestedEnvironments.length > 0) {
    environmentsToCreate = await InteractiveUtils.selectMultipleEnvironments(
      suggestedEnvironments,
      "Select environments to create:",
    );
  }

  // Add custom environments
  const { addCustom } = (await InteractiveUtils.confirmOperation(
    "Do you want to add custom environments?",
    createMode === "custom",
  ))
    ? { addCustom: true }
    : { addCustom: false };

  if (addCustom) {
    let addingMore = true;
    while (addingMore) {
      const newEnv = await InteractiveUtils.promptEnvironmentName(
        "Enter environment name:",
      );

      if (
        !environmentsToCreate.includes(newEnv) &&
        !existingEnvironments.includes(newEnv)
      ) {
        environmentsToCreate.push(newEnv);
        CliUtils.success(
          `Added ${CliUtils.formatEnvironment(newEnv)} to creation list`,
        );
      } else if (existingEnvironments.includes(newEnv)) {
        CliUtils.warning(
          `Environment ${CliUtils.formatEnvironment(newEnv)} already exists`,
        );
        const confirm = await InteractiveUtils.confirmOperation(
          "Do you want to create files for this environment anyway?",
        );
        if (confirm) {
          environmentsToCreate.push(newEnv);
        }
      } else {
        CliUtils.warning(
          `Environment ${CliUtils.formatEnvironment(newEnv)} already in creation list`,
        );
      }

      const { continueAdding } = (await InteractiveUtils.confirmOperation(
        "Do you want to add another environment?",
        false,
      ))
        ? { continueAdding: true }
        : { continueAdding: false };

      addingMore = continueAdding;
    }
  }

  if (environmentsToCreate.length === 0) {
    CliUtils.warning("No environments selected for creation.");
    return;
  }

  // Ask about template
  if (!template) {
    const { useTemplate } = (await InteractiveUtils.confirmOperation(
      "Do you want to use a template file?",
      false,
    ))
      ? { useTemplate: true }
      : { useTemplate: false };

    if (useTemplate) {
      // Look for common template files
      const commonTemplates = [".env.example", ".env.template", ".env.sample"];
      const foundTemplates: string[] = [];

      for (const templateName of commonTemplates) {
        const templatePath = path.join(cwd, templateName);
        if (await FileUtils.fileExists(templatePath)) {
          foundTemplates.push(templateName);
        }
      }

      if (foundTemplates.length > 0) {
        const { templateChoice } = (await InteractiveUtils.selectFiles(
          [...foundTemplates, "Enter custom path"],
          "Select template file:",
        )) as any;

        if (templateChoice === "Enter custom path") {
          // Prompt for custom template path
          const { customTemplate } =
            (await InteractiveUtils.promptEnvironmentName(
              "Enter template file path:",
            )) as any;
          template = customTemplate;
        } else {
          template = path.join(cwd, templateChoice[0]);
        }
      } else {
        // Prompt for template path
        const { customTemplate } =
          (await InteractiveUtils.promptEnvironmentName(
            "Enter template file path:",
          )) as any;
        template = customTemplate;
      }

      // Validate template
      if (template) {
        const templatePath = path.isAbsolute(template)
          ? template
          : path.join(cwd, template);
        if (!(await FileUtils.fileExists(templatePath))) {
          CliUtils.warning(`Template file not found: ${template}`);
          template = undefined;
        } else {
          template = templatePath;
          CliUtils.success(
            `Using template: ${CliUtils.formatPath(template, cwd)}`,
          );
        }
      }
    }
  }

  // Show summary
  console.log();
  CliUtils.subheader("Creation Summary");
  console.log(
    `Will create ${environmentsToCreate.length} environment file(s):`,
  );
  environmentsToCreate.forEach((env) => {
    console.log(`  • .env.${CliUtils.formatEnvironment(env)}`);
  });

  if (template) {
    console.log(`Using template: ${CliUtils.formatPath(template, cwd)}`);
  }

  // Confirm creation
  const confirm = await InteractiveUtils.confirmOperation(
    "Create these environment files?",
  );

  if (!confirm) {
    CliUtils.info("Operation cancelled.");
    return;
  }

  // Create files
  CliUtils.subheader("Creating Files");

  let successCount = 0;
  let errorCount = 0;

  for (const environment of environmentsToCreate.sort()) {
    const envFilePath = path.join(cwd, `.env.${environment}`);
    const relativePath = FileUtils.getRelativePath(envFilePath, cwd);

    console.log();
    CliUtils.info(`Creating: ${chalk.cyan(relativePath)}`);

    try {
      // Check if file exists
      if ((await FileUtils.fileExists(envFilePath)) && !overwrite) {
        const fileConfirm = await InteractiveUtils.confirmOperation(
          `File already exists. Overwrite ${relativePath}?`,
          false,
        );
        if (!fileConfirm) {
          CliUtils.warning("Skipped existing file");
          continue;
        }
      }

      const result = await FileUtils.createEnvTemplate(envFilePath, template);

      if (result.success) {
        CliUtils.success(`Created: ${chalk.cyan(relativePath)}`);
        successCount++;
      } else {
        CliUtils.error(`Failed: ${result.message}`);
        errorCount++;
      }
    } catch (error) {
      CliUtils.error(
        `Error creating ${relativePath}: ${error instanceof Error ? error.message : String(error)}`,
      );
      errorCount++;
    }
  }

  // Final summary
  console.log();
  CliUtils.subheader("Creation Results");

  if (successCount > 0) {
    CliUtils.success(`Successfully created ${successCount} file(s)`);
  }

  if (errorCount > 0) {
    CliUtils.error(`Failed to create ${errorCount} file(s)`);
  }

  // Show next steps
  if (successCount > 0) {
    console.log();
    CliUtils.info("Next steps:");
    console.log(
      chalk.gray("• Edit the created files and add your environment variables"),
    );
    console.log(chalk.gray('• Use "envx encrypt" to encrypt sensitive files'));
    console.log(
      chalk.gray('• Use "envx interactive" to set up .envrc with secrets'),
    );
  }

  if (errorCount > 0) {
    process.exit(1);
  }
}
