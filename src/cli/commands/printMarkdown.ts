import { Config } from '../../models';
import { outputFile } from '../../utils/async';
import { groupCommitsByTags } from '../../utils/git';
import { createMarkdown } from '../../utils/markdown';
import { defaultConfig } from '../config/default';

const printMarkdown = async (config?: Config) => {
  const tagGroups = await groupCommitsByTags(config?.blacklistPattern);

  const title = `### ${config?.title ?? defaultConfig.title} \n\n ${
    config?.description ?? defaultConfig.description
  }\n\n`;
  const output = createMarkdown(title, tagGroups, config?.repoName);

  try {
    await outputFile(
      config?.outputFilename ?? defaultConfig.outputFilename,
      output
    );
  } catch (error) {
    console.error(error);
  }
};

export { printMarkdown };
