#! /usr/bin/env node
const {execSync} = require('child_process');
const {copyFileSync, mkdirSync} = require('fs');
mkdirSync('patches', {recursive: true});
copyFileSync(
    'node_modules/@gravity-ui/gateway/patches/grpc-reflection-js+0.1.2.patch',
    'patches/grpc-reflection-js+0.1.2.patch',
);
copyFileSync(
    'node_modules/@gravity-ui/gateway/patches/protobufjs+6.11.4.patch',
    'patches/protobufjs+6.11.4.patch',
);
execSync('npx patch-package', {stdio: 'inherit'});
