import { Commit } from '../models';
import { execAsync } from './async';

const getReleaseTags = async (): Promise<
  {
    creatorDate: string;
    tag: string;
  }[]
> => {
  const command = `git tag -l --sort=-creatordate --format="%(creatordate:short),%(refname:short)"`;
  const result = await execAsync(command);
  return result.stdout
    .split('\n')
    .filter((tag: string) => !!tag)
    .map((tag: string) => {
      const value = tag.split(',');
      return {
        creatorDate: value[0],
        tag: value[1],
      };
    });
};

const getReleaseCommits = async (
  toTag: string,
  fromTag: string,
  blacklistPattern?: string
): Promise<Commit[]> => {
  const separator = '_||_';
  const command = `git log ${fromTag}..${toTag} --no-merges --pretty=format:"%ad${separator}%h${separator}%ae${separator}%s"`;
  const logResult = await execAsync(command);
  return logResult.stdout
    .split('\n')
    .filter((message) => !!message)
    .map((message) => {
      const data = message.split(separator);
      return {
        date: new Date(data[0]),
        hash: data[1],
        author: data[2],
        subject: data[3],
      } as Commit;
    })
    .filter((commit) => {
      if (!blacklistPattern) {
        return true;
      }
      return !new RegExp(blacklistPattern, 'gm').test(commit.subject);
    });
};

const groupCommitsByTags = async (blacklistPattern: string | undefined) => {
  const releaseCommits = [];

  const headTag = {
    creatorDate: new Date().toISOString().slice(0, 10),
    tag: 'HEAD',
  };
  const allTags = [headTag, ...(await getReleaseTags())];
  for await (const [index, value] of allTags.slice(0, -1).entries()) {
    const previousTag = allTags[index + 1].tag;
    const commits = await getReleaseCommits(
      value.tag,
      previousTag,
      blacklistPattern
    );
    releaseCommits.push({
      commits,
      previousTag,
      tag: value.tag,
      date: new Date(value.creatorDate),
    });
  }
  return releaseCommits;
};

export { groupCommitsByTags };
