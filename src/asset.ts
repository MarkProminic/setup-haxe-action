// Copyright (c) 2020 Sho Kuroda <krdlab@gmail.com>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as tc from '@actions/tool-cache';
import * as core from '@actions/core';
import { exec } from '@actions/exec';

export type AssetFileExt = '.zip' | '.tar.gz';

abstract class Asset {
  protected readonly downloadTimeout: number;
  protected readonly maxRetries: number;
  protected readonly retryDelay: number;

  constructor(
    readonly name: string, 
    readonly version: string, 
    protected readonly env: Env,
    downloadTimeout: number = 60000,
    maxRetries: number = 5,
    retryDelay: number = 5000
  ) {
    this.downloadTimeout = downloadTimeout;
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
  }

  async setup() {
    const toolPath = tc.find(this.name, this.version);
    if (toolPath) {
      return toolPath;
    }

    return tc.cacheDir(await this.download(), this.name, this.version);
  }

  protected abstract get downloadUrl(): string;
  protected abstract get fileNameWithoutExt(): string;
  protected abstract get isDirectoryNested(): boolean;

  protected makeDownloadUrl(path: string) {
    return `https://github.com/HaxeFoundation${path}`;
  }

  protected get fileExt(): AssetFileExt {
    switch (this.env.platform) {
      case 'win': {
        return '.zip';
      }

      default: {
        return '.tar.gz';
      }
    }
  }

  private async download() {
    let attempt = 1;
    let lastError: Error | null = null;
    let currentDelay = this.retryDelay;

    core.info(`Downloading: ${this.downloadUrl}`);

    while (attempt <= this.maxRetries) {
      try {
        core.info(`Download attempt ${attempt}/${this.maxRetries} for ${this.downloadUrl}`);
        const downloadPath = await tc.downloadTool(this.downloadUrl);
        core.info(`Download successful on attempt ${attempt} for ${this.downloadUrl}`);
        
        const extractPath = await this.extract(downloadPath, this.fileNameWithoutExt, this.fileExt);
        const toolRoot = await this.findToolRoot(extractPath, this.isDirectoryNested);
        
        if (!toolRoot) {
          throw new Error(`tool directory not found: ${extractPath}`);
        }

        core.debug(`found toolRoot: ${toolRoot}`);
        return toolRoot;
      } catch (error: any) {
        lastError = error;
        core.warning(`Download attempt ${attempt} failed for ${this.downloadUrl}: ${error.message}`);
        
        if (attempt < this.maxRetries) {
          core.info(`Waiting ${currentDelay / 1000} seconds before trying again to download ${this.downloadUrl}`);
          await new Promise(resolve => setTimeout(resolve, currentDelay));
          // Exponential backoff
          currentDelay = Math.min(currentDelay * 2, 60000); // Cap at 1 minute
        }
        
        attempt++;
      }
    }

    throw new Error(`Failed to download ${this.downloadUrl} after ${this.maxRetries} attempts: ${lastError?.message}`);
  }

  private async extract(file: string, dest: string, ext: AssetFileExt) {
    if (fs.existsSync(dest)) {
      fs.rmdirSync(dest, { recursive: true });
    }

    switch (ext) {
      case '.tar.gz': {
        return tc.extractTar(file, dest);
      }

      case '.zip': {
        return tc.extractZip(file, dest);
      }

      default: {
        throw new Error(`unknown ext: ${ext}`); // eslint-disable-line @typescript-eslint/restrict-template-expressions
      }
    }
  }

  // * NOTE: tar xz -C haxe-4.0.5-linux64 -f haxe-4.0.5-linux64.tar.gz --> haxe-4.0.5-linux64/haxe_20191217082701_67feacebc
  private async findToolRoot(extractPath: string, nested: boolean) {
    if (!nested) {
      return extractPath;
    }

    let found = false;
    let toolRoot = '';
    await exec('ls', ['-1', extractPath], {
      listeners: {
        stdout(data) {
          const entry = data.toString().trim();
          if (entry.length > 0) {
            toolRoot = path.join(extractPath, entry);
            found = true;
          }
        },
      },
    });
    return found ? toolRoot : null;
  }
}

// * NOTE https://github.com/HaxeFoundation/neko/releases/download/v2-4-0/neko-2.4.0-linux64.tar.gz
// * NOTE https://github.com/HaxeFoundation/neko/releases/download/v2-4-0/neko-2.4.0-osx-universal.tar.gz
// * NOTE https://github.com/HaxeFoundation/neko/releases/download/v2-4-0/neko-2.4.0-win64.zip
export class NekoAsset extends Asset {
  static resolveFromHaxeVersion(
    version: string, 
    downloadTimeout?: number, 
    maxRetries?: number, 
    retryDelay?: number
  ) {
    const nekoVer = version.startsWith('3.') ? '2.1.0' : '2.4.0'; // Haxe 3 only supports neko 2.1
    return new NekoAsset(nekoVer, new Env(), downloadTimeout, maxRetries, retryDelay);
  }

  constructor(
    version: string, 
    env = new Env(), 
    downloadTimeout?: number, 
    maxRetries?: number, 
    retryDelay?: number
  ) {
    super('neko', version, env, downloadTimeout, maxRetries, retryDelay);
  }

  get downloadUrl() {
    const tag = `v${this.version.replace(/\./g, '-')}`;
    return super.makeDownloadUrl(
      `/neko/releases/download/${tag}/${this.fileNameWithoutExt}${this.fileExt}`,
    );
  }

  get target() {
    // No 64bit version of neko 2.1 available for windows
    if (this.env.platform === 'win' && this.version.startsWith('2.1')) {
      return this.env.platform;
    }

    if (this.env.platform === 'osx' && this.version.startsWith('2.4')) {
      return 'osx-universal';
    }

    return `${this.env.platform}${this.env.arch}`;
  }

  get fileNameWithoutExt() {
    return `neko-${this.version}-${this.target}`;
  }

  get isDirectoryNested() {
    return true;
  }
}

// * NOTE https://github.com/HaxeFoundation/haxe/releases/download/4.0.5/haxe-4.0.5-linux64.tar.gz
// * NOTE https://github.com/HaxeFoundation/haxe/releases/download/3.4.7/haxe-3.4.7-win64.zip
export class HaxeAsset extends Asset {
  nightly = false;

  constructor(
    version: string, 
    nightly: boolean, 
    env = new Env(),
    downloadTimeout?: number, 
    maxRetries?: number, 
    retryDelay?: number
  ) {
    super('haxe', version, env, downloadTimeout, maxRetries, retryDelay);
    this.nightly = nightly;
  }

  get downloadUrl() {
    if (this.nightly) {
      return `https://build.haxe.org/builds/haxe/${this.nightlyTarget}/${this.fileNameWithoutExt}${this.fileExt}`;
    }

    return super.makeDownloadUrl(
      `/haxe/releases/download/${this.version}/${this.fileNameWithoutExt}${this.fileExt}`,
    );
  }

  get target() {
    if (this.env.platform === 'osx') {
      return this.env.platform;
    }

    // No 64bit version of neko 2.1 available for windows, thus we can also only use 32bit version of Haxe 3
    if (this.env.platform === 'win' && this.version.startsWith('3.')) {
      return this.env.platform;
    }

    return `${this.env.platform}${this.env.arch}`;
  }

  get nightlyTarget() {
    const plat = this.env.platform;
    switch (plat) {
      case 'osx': {
        return 'mac';
      }

      case 'linux': {
        return 'linux64';
      }

      case 'win': {
        return 'windows64';
      }

      default: {
        throw new Error(`${plat} not supported`); // eslint-disable-line @typescript-eslint/restrict-template-expressions
      }
    }
  }

  get fileNameWithoutExt() {
    if (this.nightly) {
      return `haxe_${this.version}`;
    }

    return `haxe-${this.version}-${this.target}`;
  }

  get isDirectoryNested() {
    return true;
  }
}

export class Env {
  get platform() {
    const plat = os.platform();
    switch (plat) {
      case 'linux': {
        return 'linux';
      }

      case 'win32': {
        return 'win';
      }

      case 'darwin': {
        return 'osx';
      }

      default: {
        throw new Error(`${plat} not supported`);
      }
    }
  }

  get arch() {
    const arch = os.arch();

    if (arch === 'x64') {
      return '64';
    }

    if (arch === 'arm64' && this.platform === 'osx') {
      return '64';
    }

    throw new Error(`${arch} not supported`);
  }
}
