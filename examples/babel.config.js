module.exports = {
  presets: [require('../packages/metro-react-native-babel-preset')],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./'],
        extensions: ['.tsx', '.ts', '.js', '.jsx'],
        alias: {
          '@': './',
        },
      },
    ],
  ],
};
