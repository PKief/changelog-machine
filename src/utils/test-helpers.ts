import { MockedFunction } from 'ts-jest/dist/utils/testing';
import { mocked } from 'ts-jest/utils';
import { execAsync } from './async';

export const createExecAsyncMock = () => {
  const mockExecAsync = mocked(execAsync) as unknown as MockedFunction<
    () => Promise<{
      stdout: string;
      stderr: string;
    }>
  >;
  return mockExecAsync;
};

export const mockNewDateTime = () => {
  jest.useFakeTimers().setSystemTime(new Date('2022-02-08').getTime());
};
