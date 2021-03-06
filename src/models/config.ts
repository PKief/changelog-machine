export interface Config {
  /**
   * Name of the file in which the output should be written. Can also include a path name.
   * @default `CHANGELOG.md`
   * @optional
   */
  filePath?: string;

  /**
   * Title of the page
   * @default `Changelog`
   * @optional
   */
  title?: string;

  /**
   * Description of the page
   * @default `All notable changes to this project will be documented in this file. Dates are displayed in UTC.`
   * @optional
   */
  description?: string;

  /**
   * URL of the repository
   * @optional If not set, no links will be provided.
   */
  repositoryUrl?: string;

  /**
   * Regular expression pattern to exclude commit messages
   * @optional
   */
  blacklistPattern?: string;
}
