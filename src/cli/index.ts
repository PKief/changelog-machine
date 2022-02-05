import { readFile, writeFile } from 'fs';
import minimist from 'minimist';
import { promisify } from 'util';
import { Config, TagGroup } from '../models';
import { groupCommitsByTags } from '../utils/git';
import {
  createCommitList,
  createDateInformation,
  createReleaseSubtitle,
} from '../utils/markdown';

const writeFileAsync = promisify(writeFile);
const readFileAsync = promisify(readFile);

const createMarkdown = (
  title: string,
  tagGroups: TagGroup[],
  repository: string | undefined
) => {
  return (
    title +
    tagGroups.reduce((markdown, group) => {
      const subtitle = createReleaseSubtitle(group, repository);
      const date = createDateInformation(group);
      const commitList = createCommitList(group, repository);
      return `${markdown} \n${subtitle} \n\n${date} \n\n${commitList}`;
    }, '')
  );
};

const run = async () => {
  const args = minimist<{
    version: undefined;
    config: string;
  }>(process.argv.slice(2), {
    // eslint-disable-next-line id-blacklist
    string: 'config',
    // eslint-disable-next-line id-blacklist
    boolean: ['version', 'help'],
    alias: { v: 'version', h: 'help' },
    unknown: (a) => {
      console.log(
        `The argument '${a}' is invalid for this command. Please use --help to read the description of this command.`
      );
      return false;
    },
  });
  if (args.version) {
    return console.log(
      `${process.env.npm_package_name} v${process.env.npm_package_version}`
    );
  }
  if (args.help) {
    return console.log(
      `
Usage
  $ npx changelog-machine -c changelog.config.json

Options
  --config, -c  Path to the configuration file
  --version, -v  Show version
  --help, -h  Show help
  `
    );
  }
  let config: Config = {
    outputFilename: 'CHANGELOG.md',
  };

  if (args.config) {
    try {
      const file = await readFileAsync(args.config);
      config = { ...config, ...(JSON.parse(file.toLocaleString()) as Config) };
    } catch (error) {
      throw new Error(
        `Unable to read the config file at the location ${args.config}\n` +
          error ?? ''
      );
    }
  }

  const tagGroups = await groupCommitsByTags(config.blacklistPattern);

  const title =
    '### Changelog \n\n All notable changes to this project will be documented in this file. Dates are displayed in UTC.\n\n';
  const output = createMarkdown(title, tagGroups, config.repoName);

  await writeFileAsync(config.outputFilename, output);
};

run();
