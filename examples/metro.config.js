/**
 * Metro configuration for React Native
 * https://github.com/facebook/react-native
 *
 * @format
 */

const path = require('path');

const { getDefaultConfig } = require('metro-config');

module.exports = (async () => {
  const {
    resolver: { sourceExts, resolverMainFields },
  } = await getDefaultConfig();
  return {
  watchFolders: [path.resolve('../packages/')],
  // resetCache: true,
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: false,
      },
    }),
    experimentalTreeShaking: true,
    assetRegistryPath: require.resolve(
      'react-native/Libraries/Image/AssetRegistry',
    ),
    babelTransformerPath: require.resolve('../packages/metro-react-native-babel-transformer'),
  },
  serializer: {
    getPolyfills: require('react-native/rn-get-polyfills'),
    getModulesRunBeforeMainModule: () => [require.resolve(
      require.resolve('react-native/Libraries/Core/InitializeCore'),
    )]
  },
  resolver: {
    sourceExts: ['ios.js', 'android.js', ...sourceExts],
    blockList: /(website\/node_modules\/.*|.*\/__tests__\/.*)$/,
    resolverMainFields: ['react-native', 'module', ...resolverMainFields],
  },
}})();