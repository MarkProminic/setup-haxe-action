# setup-haxe

[![Build Status](https://github.com/krdlab/setup-haxe/actions/workflows/test.yml/badge.svg "GitHub Actions")](https://github.com/krdlab/setup-haxe/actions/workflows/test.yml)
[![License](https://img.shields.io/github/license/krdlab/setup-haxe.svg?label=license)](#license)

This action sets up a Haxe environment for use in your workflows.

## Usage

### Download Timeout and Retry Settings

For slow networks or self-hosted runners, you can configure download timeout and retry settings:

```yaml
jobs:
  build:
    runs-on: self-hosted
    steps:
      - uses: MarkProminic/setup-haxe-action@master
        with:
          haxe-version: 4.3.6
          download-timeout: 120000  # 2 minutes (in milliseconds)
          max-retries: 10           # Maximum number of retry attempts
          retry-delay: 10000        # Initial retry delay in milliseconds (increases exponentially)
```

### Basic Usage

See [action.yml](action.yml) and [.github/workflows/](.github/workflows/).

Basic:
```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: krdlab/setup-haxe@v1
        with:
          haxe-version: 4.3.4
      - run: |
          haxe -version
          haxelib install hxnodejs
```

For nigthly versions:
```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: krdlab/setup-haxe@v1
        with:
          haxe-version: latest  # Install 'haxe_latest.tar.gz' from https://build.haxe.org/builds/haxe/linux64/
      - run: haxe -version
```

Caching global packages data:
```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: krdlab/setup-haxe@v1
        with:
          haxe-version: 4.3.4
          cache-dependency-path: 'lib.hxml'
      - run: |
          haxe -version
          haxelib install lib.hxml --always
```
