import { Config } from '../../models';
import { outputFile } from '../../core/async';
import { createMarkdown } from '../../core/markdown';
import { defaultConfig } from '../../core/default';

const printMarkdown = async (config?: Config) => {
  const output = await createMarkdown(config);

  try {
    await outputFile(
      config?.outputFilename ?? defaultConfig.outputFilename,
      output
    );
  } catch (error) {
    console.error(error);
  }
};

export { printMarkdown };
