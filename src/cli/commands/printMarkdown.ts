import { Config } from '../../models';
import { groupCommitsByTags } from '../../utils/git';
import { createMarkdown } from '../../utils/markdown';
import { writeFileAsync } from '../../utils/async';
import { defaultConfig } from '../config/default';

const printMarkdown = async (config?: Config) => {
  const tagGroups = await groupCommitsByTags(config?.blacklistPattern);

  const title = `### ${config?.title ?? defaultConfig.title} \n\n ${
    config?.description ?? defaultConfig.description
  }\n\n`;
  const output = createMarkdown(title, tagGroups, config?.repoName);

  try {
    await writeFileAsync(
      config?.outputFilename ?? defaultConfig.outputFilename,
      output
    );
  } catch (error) {
    console.error(error);
  }
};

export { printMarkdown };
