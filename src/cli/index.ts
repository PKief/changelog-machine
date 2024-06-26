import minimist from 'minimist';
import { checkPackageJsonExists } from '../core/async';
import { defaultConfig } from '../core/default';
import { Config } from '../models';
import { printHelp } from './commands/printHelp';
import { printMarkdown } from './commands/printMarkdown';
import { printVersion } from './commands/printVersion';
import { flags } from './config/options';
import { readConfigFile } from './config/readConfigFile';

const run = async () => {
  if (!checkPackageJsonExists()) {
    console.error('Error: package.json does not exist.');
    process.exit(1);
  }

  const args = minimist<{
    version: undefined;
    config: string;
    help: undefined;
  }>(process.argv.slice(2), flags);
  if (args.version) {
    printVersion();
    return;
  }
  if (args.help) {
    printHelp();
    return;
  }
  let config: Config = defaultConfig;

  if (args.config) {
    config = { ...defaultConfig, ...(await readConfigFile(args.config)) };
  }

  await printMarkdown(config);
};

run();
