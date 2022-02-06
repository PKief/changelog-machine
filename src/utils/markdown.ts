import { TagGroup } from '../models';

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
  repository: string | undefined
) => {
  const subtitleLinkText =
    group.tag === 'HEAD' ? 'v' + process.env.npm_package_version : group.tag;
  const subtitleLink = `${repository}/compare/${group.previousTag}...${group.tag}`;

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
      result + `- ${commit.subject.replace(/[<<]/, '&lt;')} ${reference}\n`
    );
  }, '');
};

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

export { createMarkdown };
