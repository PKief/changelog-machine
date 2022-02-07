import { Config } from '../../models';
import { outputFileAsync } from '../../core/async';
import { createMarkdown } from '../../core/markdown';
import { defaultConfig } from '../../core/default';

const printMarkdown = async (config?: Config) => {
  const output = await createMarkdown(config);

  try {
    await outputFileAsync(
      config?.filePath ?? defaultConfig.outputFilename,
      output
    );
  } catch (error) {
    console.error(error);
  }
};

export { printMarkdown };
