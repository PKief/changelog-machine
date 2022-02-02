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
  const { config: configFilePath } = minimist(process.argv.slice(2));
  let config: Config = {
    outputFilename: 'CHANGELOG.md',
  };

  if (configFilePath) {
    try {
      const file = await readFileAsync(configFilePath);
      config = { ...config, ...(JSON.parse(file.toLocaleString()) as Config) };
    } catch (error) {
      throw new Error(
        `Unable to read the config file at the location ${configFilePath}\n` +
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
