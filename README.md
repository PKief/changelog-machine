<h1 align="center">
  <br>
    <img src="./logo.png" alt="logo" width="200">
  <br><br>
  Changelog Machine
  <br>
  <br>
</h1>

<h4 align="center">Generate a changelog based on Git commit messages and tags.</h4>

## Getting started

The tool can be executed with this command:

```
npx changelog-machine
```

It will generate a file called CHANGELOG.md in the root directory of the project.

## Configuration

The generation of the changelog can be configured via a config file.

```
npx changelog-machine --config changelog.config.json
```

### Command overview

| COMMAND   | ALIAS | DESCRIPTION                    |
| --------- | ----- | ------------------------------ |
| --config  | -c    | Path to the configuration file |
| --version | -v    | Print version                  |
| --help    | -h    | Print command instructions     |

### Configuration file

The configuration file can be configured like this:

```json
{
  "repoName": "https://github.com/PKief/vscode-material-icon-theme",
  "blacklistPattern": "Release|^\\d+\\.\\d+\\.\\d+$",
  "outputFilename": "CHANGELOG.md"
}
```

## Example output

The following commit summary is printed into the CHANGELOG.md file and can look like this:

#### [v4.12.1](https://github.com/PKief/vscode-material-icon-theme/compare/v4.12.1...HEAD)

> February 5, 2022

- Update release commit message [`3167316`](https://github.com/PKief/vscode-material-icon-theme/commit/3167316)
- Update release workflow [`7f2520d`](https://github.com/PKief/vscode-material-icon-theme/commit/7f2520d)
- Adjust preview script for folder icons [`6a00111`](https://github.com/PKief/vscode-material-icon-theme/commit/6a00111)
- Fix compare link [`fa45abf`](https://github.com/PKief/vscode-material-icon-theme/commit/fa45abf)
- Filter out release commits [`e3468ca`](https://github.com/PKief/vscode-material-icon-theme/commit/e3468ca)
