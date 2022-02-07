import { mocked } from 'jest-mock';
import { createMarkdown } from '..';
import { Config } from '../models';
import { defaultConfig } from './default';
import { groupCommitsByTags } from './git';

jest.mock('./git');
const groupCommitsByTagsMock = mocked(groupCommitsByTags);

describe('Git utils', () => {
  beforeEach(() => {
    groupCommitsByTagsMock.mockResolvedValueOnce([
      {
        commits: [
          {
            author: 'test.user@test.com',
            date: new Date('Thu Dec 16 22:06:36 2021 +0100'),
            hash: '90cc004',
            subject: '  some whitespace    ',
          },
          {
            author: 'test.user@test.com',
            date: new Date('Thu Dec 16 22:06:35 2021 +0100'),
            hash: '90cc003',
            subject: 'Subject3',
          },
        ],
        previousTag: 'v4.11.0',
        tag: 'v4.12.0',
        date: new Date('2022-02-08'),
      },
      {
        commits: [
          {
            author: 'test.user@test.com',
            date: new Date('Thu Nov 17 22:06:35 2021 +0100'),
            hash: '90cc002',
            subject: 'Subject2',
          },
          {
            author: 'test.user@test.com',
            date: new Date('Thu Nov 17 22:06:34 2021 +0100'),
            hash: '90cc001',
            subject: 'Subject1 (#123)',
          },
        ],
        previousTag: 'v4.10.0',
        tag: 'v4.11.0',
        date: new Date('2022-01-23'),
      },
    ]);
  });

  it('it should contain all default values and commit messages formatted as markdown', async () => {
    const output = await createMarkdown();
    expect(output).toContain(`### ${defaultConfig.title}`);
    expect(output).toContain(defaultConfig.description);
    expect(output).toContain(`#### v4.12.0`);
    expect(output).toContain(`#### v4.11.0`);
    expect(output).toContain('> February 8, 2022');
    expect(output).toContain('> January 23, 2022');
    expect(output).toContain('- some whitespace `90cc004`');
    expect(output).toContain('- Subject3 `90cc003`');
    expect(output).toContain('- Subject2 `90cc002`');
    expect(output).toContain('- Subject1 `#123`');
  });

  it('it should contain custom title and description', async () => {
    const testConfig: Config = {
      title: 'My changes',
      description: 'Custom description of the changelog',
    };
    const output = await createMarkdown(testConfig);
    expect(output).toContain(`### ${testConfig.title}`);
    expect(output).toContain(testConfig.description);
  });

  it('it should create compare and commit links based on repository URL', async () => {
    const testConfig: Config = {
      repositoryUrl: 'https://github.com/PKief/vscode-material-icon-theme',
    };
    const output = await createMarkdown(testConfig);
    expect(output).toContain(
      `[v4.12.0](${testConfig.repositoryUrl}/compare/v4.11.0...v4.12.0)`
    );
    expect(output).toContain(
      `[\`90cc004\`](${testConfig.repositoryUrl}/commit/90cc004)`
    );
  });

  it('it should create ticket links based on repository URL', async () => {
    const testConfig: Config = {
      repositoryUrl: 'https://github.com/PKief/vscode-material-icon-theme',
    };
    const output = await createMarkdown(testConfig);
    expect(output).toContain(
      `[\`#123\`](${testConfig.repositoryUrl}/pull/123)`
    );
  });
});
