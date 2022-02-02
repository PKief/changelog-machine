import { Commit } from './commit';

export interface TagGroup {
  commits: Commit[];
  previousTag: string;
  tag: string;
  date: Date;
}
