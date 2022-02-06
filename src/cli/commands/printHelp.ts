const printHelp = () => {
  return console.log(
    `
  Usage
    $ npx changelog-machine -c changelog.config.json
  
  Options
    --config, -c  Path to the configuration file
    --version, -v  Show version
    --help, -h  Show help
    `
  );
};

export { printHelp };
