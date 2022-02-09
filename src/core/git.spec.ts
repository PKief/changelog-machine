import { groupCommitsByTags } from './git';
import { createExecAsyncMock, mockNewDateTime } from './test-helpers';

mockNewDateTime();
jest.mock('./async');
const mockExecAsync = createExecAsyncMock();

describe('Git utils', () => {
  it('should return empty list if no commits made yet', async () => {
    mockExecAsync.mockImplementation(() =>
      Promise.resolve({
        stdout: '',
        stderr: '',
      })
    );
    const commits = await groupCommitsByTags(undefined);
    expect(commits).toStrictEqual([]);
  });

  it('should group commits by release tags', async () => {
    mockExecAsync
      .mockResolvedValueOnce({
        stdout: `2022-01-23,v4.12.0
                 2021-11-25,v4.11.0`,
        stderr: '',
      })
      .mockResolvedValueOnce({
        stdout: `Thu Dec 16 22:06:35 2021 +0100_||_90cc001_||_test.user@test.com_||_Subject2`,
        stderr: '',
      })
      .mockResolvedValueOnce({
        stdout: `Thu Nov 17 22:06:35 2021 +0100_||_90cc002_||_test.user@test.com_||_Subject1`,
        stderr: '',
      });
    const commits = await groupCommitsByTags(undefined);
    expect(commits).toStrictEqual([
      {
        date: new Date('2022-02-08'),
        previousTag: 'v4.12.0',
        tag: 'HEAD',
        commits: [
          {
            author: 'test.user@test.com',
            date: new Date('Thu Dec 16 22:06:35 2021 +0100'),
            hash: '90cc001',
            subject: 'Subject2',
          },
        ],
      },
      {
        date: new Date('2022-01-23'),
        previousTag: 'v4.11.0',
        tag: 'v4.12.0',
        commits: [
          {
            author: 'test.user@test.com',
            date: new Date('Thu Nov 17 22:06:35 2021 +0100'),
            hash: '90cc002',
            subject: 'Subject1',
          },
        ],
      },
    ]);
  });

  it('should exclude commits that must be filtered out by regular expression', async () => {
    mockExecAsync
      .mockResolvedValueOnce({
        stdout: `2022-01-23,v4.12.0`,
        stderr: '',
      })
      .mockResolvedValueOnce({
        stdout: `Thu Dec 16 22:06:35 2021 +0100_||_90cc002_||_test.user@test.com_||_Subject2
                 Thu Dec 15 22:06:35 2021 +0100_||_90cc001_||_test.user@test.com_||_Subject1`,
        stderr: '',
      });
    const commits = await groupCommitsByTags('2$');
    expect(commits).toStrictEqual([
      {
        date: new Date('2022-02-08'),
        previousTag: 'v4.12.0',
        tag: 'HEAD',
        commits: [
          {
            author: 'test.user@test.com',
            date: new Date('Thu Dec 15 22:06:35 2021 +0100'),
            hash: '90cc001',
            subject: 'Subject1',
          },
        ],
      },
    ]);
  });
});
