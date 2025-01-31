#! /usr/bin/env node
const {execSync} = require('child_process');
const {copyFileSync, mkdirSync, readdirSync, rmSync} = require('fs');
const srcPatchesDir = 'node_modules/@gravity-ui/gateway/patches';
const dstPatchesDir = 'patches';

mkdirSync(dstPatchesDir, {recursive: true});
readdirSync(dstPatchesDir).forEach((patch) => rmSync(`${dstPatchesDir}/${patch}`));
readdirSync(srcPatchesDir).forEach((patch) =>
    copyFileSync(`${srcPatchesDir}/${patch}`, `${dstPatchesDir}/${patch}`),
);
execSync('npx patch-package', {stdio: 'inherit'});
