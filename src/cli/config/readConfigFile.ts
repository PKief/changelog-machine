import { readFileAsync } from '../../core/async';
import { Config } from '../../models';

const readConfigFile = async (configFilePath: string) => {
  try {
    const file = await readFileAsync(configFilePath);
    return JSON.parse(file.toLocaleString()) as Config;
  } catch (error) {
    throw new Error(
      `Unable to read the config file at the location ${configFilePath}\n` +
        error ?? ''
    );
  }
};

export { readConfigFile };
