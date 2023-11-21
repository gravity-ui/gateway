#! /usr/bin/env node
const {execSync} = require('child_process');
const {copyFileSync, mkdirSync} = require('fs');
mkdirSync('patches', {recursive: true});
copyFileSync(
    'node_modules/@gravity-ui/gateway/patches/grpc-reflection-js+0.3.0.patch',
    'patches/grpc-reflection-js+0.3.0.patch',
);
copyFileSync(
    'node_modules/@gravity-ui/gateway/patches/protobufjs+7.2.5.patch',
    'patches/protobufjs+7.2.5.patch',
);
execSync('npx patch-package', {stdio: 'inherit'});
