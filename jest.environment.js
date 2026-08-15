/**
 * Custom test environment for Foresight.
 * Extends the root-level jest-environment-node (v30) so that jest-runtime's
 * moduleMocker API (clearMocksOnScope) is available when using jest 30.
 * This avoids the version mismatch between jest 30 and @react-native/jest-preset
 * which bundles jest-environment-node@29.
 */
'use strict';

const { TestEnvironment: NodeEnv } = require('jest-environment-node');

module.exports = class ForesightTestEnvironment extends NodeEnv {
  customExportConditions = ['require', 'react-native'];
};
