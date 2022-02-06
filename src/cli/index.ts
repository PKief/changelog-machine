import minimist from 'minimist';
import { Config } from '../models';
import { printHelp } from './commands/printHelp';
import { printMarkdown } from './commands/printMarkdown';
import { printVersion } from './commands/printVersion';
import { defaultConfig } from './config/default';
import { flags } from './config/options';
import { readConfigFile } from './config/readConfigFile';

const run = async () => {
  const args = minimist<{
    version: undefined;
    config: string;
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
