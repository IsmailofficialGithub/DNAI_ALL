const path = require('path');

module.exports = {
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    configure: (webpackConfig) => {
      // Fix source-map-loader issues with node_modules
      const sourceMapRule = webpackConfig.module.rules.find(
        (rule) => rule.enforce === 'pre' && rule.loader && rule.loader.includes('source-map-loader')
      );
      if (sourceMapRule) {
        sourceMapRule.exclude = /node_modules/;
      }
      return webpackConfig;
    },
  },
};
