'use strict';

const path = require('path');
const yaml = require('yaml');
const metaBabelTransformer = require('metro-babel-transformer');

module.exports.transform = function transform(transformerParams) {
  const { src, filename } = transformerParams;
  if (filename.endsWith('.yaml') || filename.endsWith('.yml')) {
    const data = yaml.parse(src);
    const jsContent = `module.exports = ${JSON.stringify(data)};`;
    const jsFilename = path.join(path.dirname(filename), path.basename(filename) + '.js');
    return metaBabelTransformer.transform({
      ...transformerParams,
      src: jsContent,
      filename: jsFilename,
    });
  }
  return metaBabelTransformer.transform(transformerParams);
};
