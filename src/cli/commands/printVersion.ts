const printVersion = () => {
  if (typeof process.env.npm_package_version === 'undefined') {
    console.warn('Warning: No version information found.');
  } else {
    console.log(
      `${process.env.npm_package_name} v${process.env.npm_package_version}`
    );
  }
};

export { printVersion };
