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

### Configuration file

The configuration file can be configured like this:

```json
{
  "repoName": "https://github.com/PKief/vscode-material-icon-theme",
  "blacklistPattern": "/Release|^d+.d+.d+$/",
  "outputFilename": "CHANGELOG.md"
}
```
