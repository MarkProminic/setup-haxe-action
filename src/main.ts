// Copyright (c) 2020 Sho Kuroda <krdlab@gmail.com>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import * as core from '@actions/core';
import * as semver from 'semver';
import { setup } from './setup';

async function main(): Promise<void> {
  try {
    const inputVersion = core.getInput('haxe-version');
    const cacheDependencyPath = core.getInput('cache-dependency-path');
    const downloadTimeout = parseInt(core.getInput('download-timeout') || '60000', 10);
    const maxRetries = parseInt(core.getInput('max-retries') || '5', 10);
    const retryDelay = parseInt(core.getInput('retry-delay') || '5000', 10);
    
    // Set environment variables for Node.js HTTP request timeouts
    // These will be picked up by underlying HTTP request libraries
    process.env.NODE_TLS_TIMEOUT = String(downloadTimeout);
    process.env.HTTP_TIMEOUT = String(downloadTimeout);
    
    core.info(`Download timeout set to ${downloadTimeout}ms`);
    core.info(`Max retries set to ${maxRetries}`);
    core.info(`Initial retry delay set to ${retryDelay}ms`);
    
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
