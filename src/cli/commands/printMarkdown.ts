import { Config } from '../../models';
import { groupCommitsByTags } from '../../utils/git';
import { createMarkdown } from '../../utils/markdown';
import { writeFileAsync } from '../../utils/promisify';

const printMarkdown = async (config: Config) => {
  const tagGroups = await groupCommitsByTags(config.blacklistPattern);

  const title = `### ${config.title} \n\n ${config.description}\n\n`;
  const output = createMarkdown(title, tagGroups, config.repoName);

  await writeFileAsync(config.outputFilename, output);
};

export { printMarkdown };
