import { Config, TagGroup } from '../models';
import { defaultConfig } from './default';
import { groupCommitsByTags } from './git';

const createLink = (linkText: string, url: string) => {
  return `[${linkText}](${url})`;
};

const formatDate = (date: Date) => {
  return date.toLocaleString('en', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

const ticketRecognition = (commitMessage: string): string | undefined => {
  return commitMessage.match(/\((?<ticket>#\d+)\)/)?.groups?.ticket;
};

const createReleaseSubtitle = (
  group: TagGroup,
  repository?: string | undefined
) => {
  const latestTag = 'v' + process.env.npm_package_version;
  const unreleasedChanges = latestTag === group.previousTag;
  const latestVersion = unreleasedChanges ? 'Unreleased changes' : latestTag;
  const tagIsHead = group.tag === 'HEAD';
  const subtitleLinkText = tagIsHead ? latestVersion : group.tag;
  const subtitleLinkCurrentTag = tagIsHead
    ? unreleasedChanges
      ? 'HEAD'
      : latestTag
    : group.tag;
  const subtitleLink = `${repository}/compare/${group.previousTag}...${subtitleLinkCurrentTag}`;

  const subtitle = `${createLink(subtitleLinkText, subtitleLink)}`;
  return `#### ${repository ? subtitle : subtitleLinkText}`;
};

const createDateInformation = (group: TagGroup) => {
  return `> ${formatDate(group.date)}`;
};

const createCommitList = (group: TagGroup, repository: string | undefined) => {
  return group.commits.reduce<string>((result, commit) => {
    const ticket = ticketRecognition(commit.subject);
    let reference = '';

    if (ticket) {
      commit.subject = commit.subject.replace(`(${ticket})`, ''); // remove ticket number
      const ticketLinkText = `\`${ticket}\``;
      reference = repository
        ? createLink(ticketLinkText, `${repository}/pull/${ticket.slice(1)}`)
        : ticketLinkText;
    } else {
      const commitHashText = `\`${commit.hash}\``;
      reference = repository
        ? createLink(commitHashText, `${repository}/commit/${commit.hash}`)
        : commitHashText;
    }
    return (
      result +
      `- ${commit.subject.replace(/[<<]/, '&lt;').trim()} ${reference}\n`
    );
  }, '');
};

/**
 * Returns a changelog formatted in Markdown syntax
 * @param config Config
 * @returns Text in Markdown syntax
 */
const createMarkdown = async (config?: Config) => {
  const title = `### ${config?.title ?? defaultConfig.title} \n\n ${
    config?.description ?? defaultConfig.description
  }\n\n`;
  const tagGroups = await groupCommitsByTags(config?.blacklistPattern);

  return (
    title +
    tagGroups.reduce((markdown, group) => {
      const subtitle = createReleaseSubtitle(group, config?.repositoryUrl);
      const date = createDateInformation(group);
      const commitList = createCommitList(group, config?.repositoryUrl);
      return `${markdown} \n${subtitle} \n\n${date} \n\n${commitList}`;
    }, '')
  );
};

export { createMarkdown };
