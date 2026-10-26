export interface Commit {
  hash: string;
  name: string;
  email: string;
  subject: string;
  body: string;
}

export interface ParsedCommit extends Commit {
  type: string;
  scope?: string;
  description: string;
  breaking: boolean;
  breakingNotes: string[];
  pr?: string;
}

export interface Release {
  tag: string;
  previousTag?: string;
  commits: Commit[];
}

export interface ContributorProfile {
  username: string;
  url: string;
}

export interface Options {
  cwd?: string;
  repositoryUrl?: string;
  includeNonConventional?: boolean;
  contributors?: Readonly<Record<string, ContributorProfile>>;
  output?: string;
}
