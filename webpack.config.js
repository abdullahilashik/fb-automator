const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  // 1. MUST be 'production' or if using 'development', you MUST set devtool (below)
  mode: 'production', 

  // 2. THIS IS THE KEY FIX: 
  // 'source-map' or 'cheap-module-source-map' are CSP compliant.
  // DO NOT use 'eval', 'eval-source-map', etc.
  devtool: 'source-map', 

  entry: {
    popup: './src/popup/index.jsx',
    content: './src/content/content.js',
    background: './src/background/background.js',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react'],
          },
        },
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader', 'postcss-loader'],
      },
    ],
  },
  resolve: {
    extensions: ['.js', '.jsx'],
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'public', to: '.' },
      ],
    }),
  ],
};