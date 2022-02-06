/* eslint-disable id-blacklist */
import minimist from 'minimist';

const flags: minimist.Opts | undefined = {
  string: 'config',
  boolean: ['version', 'help'],
  alias: { v: 'version', h: 'help' },
  unknown: (a) => {
    console.log(
      `The argument '${a}' is invalid for this command. Please use --help to read the description of this command.`
    );
    return false;
  },
};

export { flags };
