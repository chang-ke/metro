/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @emails oncall+metro_bundler
 * @flow strict-local
 * @format
 */

'use strict';

const createModuleIdFactory = require('../../../../lib/createModuleIdFactory');

const {wrapModule} = require('../js');
const babylon = require('@babel/parser');

let myModule;

beforeEach(() => {
  myModule = {
    path: '/root/foo.js',
    dependencies: new Map([
      [
        'bar',
        {
          absolutePath: '/bar',
          data: {
            data: {
              asyncType: null,
              locs: [],
              importee: {
                exports: {},
                sideEffect: false,
                exportAll: {references: 0},
                exportDefault: {references: 0},
              },
            },
            name: 'bar',
          },
        },
      ],
      [
        'baz',
        {
          absolutePath: '/baz',
          data: {
            data: {
              asyncType: null,
              locs: [],
              importee: {
                exports: {},
                sideEffect: false,
                exportAll: {references: 0},
                exportDefault: {references: 0},
              },
            },
            name: 'baz',
          },
        },
      ],
    ]),
    getSource: () => Buffer.from(''),
    inverseDependencies: new Set(),
    namedExports: [],
    importee: {
      exports: {},
      sideEffect: false,
      exportAll: {references: 0},
      exportDefault: {references: 0},
    },
    sourceAst: babylon.parse('', {}),
    output: [
      {
        data: {
          code: '__d(function() { console.log("foo") });',
          lineCount: 1,
          map: [],
        },

        type: 'js/module',
      },
    ],
  };
});

describe('wrapModule()', () => {
  it('Should wrap a module in nondev mode', () => {
    expect(
      wrapModule(myModule, {
        createModuleId: createModuleIdFactory(),
        dev: false,
        projectRoot: '/root',
      }),
    ).toEqual('__d(function() { console.log("foo") },0,[1,2]);');
  });

  it('Should wrap a module in dev mode', () => {
    expect(
      wrapModule(myModule, {
        createModuleId: createModuleIdFactory(),
        dev: true,
        projectRoot: '/root',
      }),
    ).toEqual('__d(function() { console.log("foo") },0,[1,2],"foo.js");');
  });

  it('should not wrap a script', () => {
    // $FlowFixMe[cannot-write]
    myModule.output[0].type = 'js/script';

    expect(
      wrapModule(myModule, {
        createModuleId: createModuleIdFactory(),
        dev: true,
        projectRoot: '/root',
      }),
      // $FlowFixMe[incompatible-use]
    ).toEqual(myModule.output[0].data.code);
  });

  it('should use custom createModuleId param', () => {
    // Just use a createModuleId that returns the same path.
    expect(
      wrapModule(myModule, {
        createModuleId: (path: string) => path,
        dev: false,
        projectRoot: '/root',
      }),
    ).toEqual(
      '__d(function() { console.log("foo") },"/root/foo.js",["/bar","/baz"]);',
    );
  });
});
