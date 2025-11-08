import process from "node:process";

import {
  OpenAICompatibleClient,
  maskSensitiveInfo,
} from "@mask-cut/text-llm-core";

import { createCliApplication } from "./cliApplication.js";
import { CommandRouter } from "./commandRouter.js";
import { createConfigCommandDescriptor } from "./commands/configCommand.js";
import { createMaskCommandDescriptor } from "./commands/maskCommand.js";
import { createCredentialVault } from "./config/credentialVault.js";
import { ConfigService } from "./config/configService.js";
import { resolveConfigFilePath } from "./config/configPaths.js";
import { ConfigStore } from "./config/configStore.js";
import { InputResolver } from "./inputResolver.js";
import { createNodeProcessIO } from "./processIo.js";

async function main(): Promise<void> {
  const configFilePath = resolveConfigFilePath();
  const configStore = new ConfigStore(configFilePath);
  const credentialVault = createCredentialVault();
  const configService = new ConfigService(configStore, credentialVault);
  await configService.initialize();

  const router = new CommandRouter();
  router.register(
    createMaskCommandDescriptor({
      inputResolver: new InputResolver(),
      configService,
      llmFactory: (options) =>
        new OpenAICompatibleClient(
          options.baseUrl,
          options.apiKey,
          options.model
        ),
      maskingExecutor: maskSensitiveInfo,
    })
  );
  router.register(
    createConfigCommandDescriptor({
      configService,
    })
  );

  const app = createCliApplication({
    name: "mask-cut",
    description: "Mask-Cut CLI",
    router,
  });

  const io = createNodeProcessIO(process);
  const exitCode = await app.run(process.argv, io);

  if (typeof process.exitCode !== "number") {
    process.exitCode = exitCode;
  }
}

void main();
