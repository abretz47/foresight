const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts = [...(config.resolver.sourceExts || []), 'yaml', 'yml'];
config.transformer.babelTransformerPath = require.resolve('./yamlTransformer');

module.exports = config;
