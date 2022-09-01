[![npm version](https://badge.fury.io/js/@comake%2Fskql-js-engine.svg)](https://badge.fury.io/js/@comake%2Fskql-js-engine) [![License](https://img.shields.io/badge/License-BSD_4--Clause-blue.svg)](https://spdx.org/licenses/BSD-4-Clause.html)

# SKQL Javascript Engine

This is a Javascript implementation of a Standard Knowledge Query Language Engine for [Standard Knowledge Language (SKL)](https://www.comake.io/skl). It is written in Typescript and follows the [SKL Engine specification](https://docs.standardknowledge.com/get-started/engine).


## How to use SKQL Javascript Engine

#### 1. Install via npm or yarn:

```shell
npm install @comake/skql-js-engine
yarn add @comake/skql-js-engine
```

#### 2. Define Schemas

We will be posting more documentation on schemas soon.

#### 3. Write code

Once you have schemas defined for your domain, all you have to do is write code using the Verbs and Nouns in your schema to build your application logic.


#### Browser support
To use SKQL Javascript Engine in a browser, you'll need to use a bundling tool such as Webpack, Rollup, Parcel, or Browserify. Some bundlers may require a bit of configuration, such as setting browser: true in rollup-plugin-resolve.

## How to contribute

To clone the repo, execute the following commands in your terminal:
```shell
git clone https://github.com/comake/skql-js-engine.git
cd skql-js-engine
npm ci
```

# License & Copyright

SKQL Javascript Engine is open-source with certain limitations. See the [LICENSE](LICENSE) file for more info.

Copyright (c) 2022, Comake, Inc.

# TODO

- [ ] add CONTRIBUTING.md, CODE_OF_CONDUCT.md, etc
- [ ] add SKDS schema source
- [ ] Add reference to examples in readme
