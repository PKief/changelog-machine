import { outputFileAsync } from '../../core/async';
import { defaultConfig } from '../../core/default';
import { createMarkdown } from '../../core/markdown';
import { Config } from '../../models';

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
