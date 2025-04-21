// Copyright (c) 2020 Sho Kuroda <krdlab@gmail.com>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import * as core from '@actions/core';
import * as semver from 'semver';
import * as http from 'node:http';
import * as https from 'node:https';
import { setup } from './setup';

async function main(): Promise<void> {
  try {
    const inputVersion = core.getInput('haxe-version');
    const cacheDependencyPath = core.getInput('cache-dependency-path');
    const downloadTimeout = parseInt(core.getInput('download-timeout') || '60000', 10);
    const maxRetries = parseInt(core.getInput('max-retries') || '5', 10);
    const retryDelay = parseInt(core.getInput('retry-delay') || '5000', 10);
    
    // Configure global HTTP/HTTPS timeouts
    http.globalAgent.timeout = downloadTimeout;
    https.globalAgent.timeout = downloadTimeout;
    
    core.debug(`Download timeout set to ${downloadTimeout}ms`);
    core.debug(`Max retries set to ${maxRetries}`);
    core.debug(`Initial retry delay set to ${retryDelay}ms`);
    
    const nightly = /^(\d{4}-\d{2}-\d{2}_[\w.-]+_\w+)|latest$/.test(inputVersion);
    const version = nightly ? inputVersion : semver.valid(semver.clean(inputVersion));
    if (version) {
      await setup(version, nightly, cacheDependencyPath, downloadTimeout, maxRetries, retryDelay);
    }
  } catch (error: any) { // eslint-disable-line @typescript-eslint/no-implicit-any-catch
    core.setFailed(error.message);
  }
}

await main();
