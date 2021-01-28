const Metro = require('../../packages/metro')

Metro.loadConfig().then(async config => {
  await Metro.runBuild(config, {
    entry: 'index.js',
    platform: 'ios',
    dev: false,
    hot: false,
    out: 'bundle/bundle.ios.js',
    sourceMap: true,
    sourceMapUrl: 'bundle.ios.map',
    minify: true,
  });
});


process.on('unhandledRejection', (err) => {
  console.log(err);
})