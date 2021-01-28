/* eslint-disable no-console */
/**
 * @flow
 */
import traverse from '@babel/traverse';

import {transform} from './transform';
import {hasOwnProperty, intersection} from './utils';

import type {OutputGraph} from 'metro/src/IncrementalBundler';
import type {
  JsTransformerConfig,
  JsTransformOptions,
} from 'metro-transform-worker';
import type {TransformResultExportModules} from 'metro/src/DeltaBundler/types.flow';

function wasNoReferences(importee: TransformResultExportModules): boolean {
  return (
    // $FlowFixMe
    !Object.values(importee.exports).some(({references}) => references > 0) &&
    importee.exportDefault.references <= 0 &&
    importee.exportAll.references <= 0
  );
}

/**
 * examples/node_modules/react-native/Libraries/Core/Devtools/parseErrorStack.js
 * es module export but use require stacktrace-parser
 */

function collectExports(
  graph: OutputGraph,
  treeShakingIgnore: (absolutePath: string) => boolean
) {
  const globalDependencies = graph.dependencies;
  for (const module of globalDependencies.values()) {
    const exportsFormOtherModule = Object.keys(module.importee.exports).filter(
      name => !module.namedExports.includes(name)
    );
    for (const subDependecy of module.dependencies.values()) {
      const {importee} = subDependecy.data.data;
      const dependecy = globalDependencies.get(subDependecy.absolutePath);
      if (!dependecy) {
        continue;
      }
      dependecy.importee.sideEffect = dependecy.importee.sideEffect || importee.sideEffect;
      dependecy.importee.exportDefault.references +=
        importee.exportDefault.references;
      Object.keys(importee.exports).forEach(key => {
        if (hasOwnProperty(dependecy.importee.exports, key)) {
          dependecy.importee.exports[key].references++;
        } else {
          dependecy.importee.exports[key] = {references: 1};
        }
      });

      if (importee.exportAll.references) {
        const intersec = intersection(
          exportsFormOtherModule,
          dependecy.namedExports
        );
        if (intersec.length > 0) {
          intersec.forEach(key => {
            if (hasOwnProperty(dependecy.importee.exports, key)) {
              dependecy.importee.exports[key].references++;
            } else {
              dependecy.importee.exports[key] = {
                references: 1,
              };
            }
          });
        } else {
          dependecy.importee.exportAll.references +=
          importee.exportAll.references;
        }
      }
    }
  }
}

async function removeUnUsedExports(
  graph: OutputGraph,
  config: JsTransformerConfig,
  projectRoot: string,
  options: JsTransformOptions,
  treeShakingIgnore: (absolutePath: string) => boolean
) {
  const globalDependencies = graph.dependencies;
  // analyze AST
  for (const [absolutePath, module] of globalDependencies.entries()) {
    if (treeShakingIgnore(absolutePath) || module.importee.sideEffect) {
      continue;
    }
    const traverseState = {
      changed: false,
    };
    const exportsFormOtherModule = Object.keys(module.importee.exports).filter(
      name => !module.namedExports.includes(name)
    );
    // $FlowFixMe
    const copyModuleDependencies = new Map(module.dependencies);
    const visitor = {
      ExportNamedDeclaration(path) {
        const node = path.node;
        if (node.exportKind !== 'value') {
          return;
        }
        if (
          'ClassDeclaration' === node.declaration?.type ||
          'FunctionDeclaration' === node.declaration?.type
        ) {
          // $FlowFixMe export declaration must has name
          const exportedName = node.declaration.id.name;
          if (
            !hasOwnProperty(module.importee.exports, exportedName) &&
            path.scope.bindings &&
            path.scope.bindings[exportedName].references === 1
          ) {
            traverseState.changed = true;
            path.remove();
          }
          return;
        }

        if ('VariableDeclaration' === node.declaration?.type) {
          const indexs = node.declaration.declarations.map((_, i) => i)
          // $FlowFixMe
          ;[...node.declaration.declarations].forEach((decl, index) => {
            if (decl.id.type === 'Identifier') {
              const exportedName = decl.id.name;

              if (
                !hasOwnProperty(module.importee.exports, exportedName) &&
                path.scope.bindings &&
                path.scope.bindings[exportedName].references === 1
              ) {
                const newIndex = indexs.findIndex(i => i === index);
                const varNode = path.get(`declaration.declarations.${newIndex}`);
                indexs.splice(newIndex, 1);
                if (!Array.isArray(varNode)) {
                  traverseState.changed = true;
                  varNode.remove();
                  // $FlowFixMe
                  if (node.declaration.declarations.length === 0) {
                    path.remove();
                  }
                }
              }
            }
          });
        }
        if (node.specifiers) {
          const source = node.source?.value;
          const indexs = node.specifiers.map((_, i) => i)
          // $FlowFixMe
          ;[...node.specifiers].forEach((specifier, index) => {
            const exportedName = specifier.exported.name;
            const localName =
              specifier.type === 'ExportSpecifier' ? specifier.local.name : '';

            const removeSpecifier = () => {
              const newIndex = indexs.findIndex(i => i === index);
              const specifierNode = path.get(`specifiers.${newIndex}`);
              indexs.splice(newIndex, 1);

              if (!Array.isArray(specifierNode)) {
                traverseState.changed = true;
                specifierNode.remove();
                // $FlowFixMe
                if (node.specifiers.length === 0) {
                  path.remove();
                }
              }
            };

            if (!hasOwnProperty(module.importee.exports, exportedName)) {
              if (!source) {
                if (path.scope.bindings) {
                  // export { A as B }
                  const bindingName = localName || exportedName;
                  const bindingPath = path.scope.bindings[bindingName].path;
                  const parentPath = bindingPath.parentPath;

                  if (
                    parentPath?.node &&
                    parentPath.node.type === 'ImportDeclaration'
                  ) {
                    const value = parentPath.node.source.value;
                    // $FlowFixMe
                    const {absolutePath} = copyModuleDependencies.get(value);
                    const dependency = globalDependencies.get(absolutePath);
                     // $FlowFixMe
                    const subDependecyImportee = module.dependencies.get(value).data.data.importee;
                    // $FlowFixMe
                    parentPath.node.specifiers.forEach((specifier, index) => {
                      // $FlowFixMe
                      if (specifier.local.name === bindingName) {
                        const specifierNode = parentPath.get(
                          `specifiers.${index}`
                        );
                        if (!Array.isArray(specifierNode)) {
                          specifierNode.remove();
                        }

                        if (specifier.type === 'ImportSpecifier') {
                          // $FlowFixMe
                          dependency.importee.exports[specifier.imported.name]
                            .references--;
                          subDependecyImportee.exports[specifier.imported.name]
                            .references--;
                        }

                        if (specifier.type === 'ImportDefaultSpecifier') {
                          // $FlowFixMe
                          dependency.importee.exportDefault.references--;
                          subDependecyImportee.exportDefault.references--;
                        }
                      }
                    });

                    if (
                      // $FlowFixMe
                      parentPath.node.specifiers.length === 0 &&
                      // $FlowFixMe
                      !path.scope.bindings[bindingName]
                    ) {
                      // removed when no specifiers
                      parentPath.remove();
                      if (wasNoReferences(subDependecyImportee)) {
                        module.dependencies.delete(value);
                      }
                      if (
                        !path.scope.path.find(path =>
                          path.isImportDefaultSpecifier()
                        )
                      ) {
                        module.dependencies.delete(
                          '@babel/runtime/helpers/interopRequireWildcard'
                        );
                      }
                    }
                  }
                }
                removeSpecifier();
                return;
              }

              // $FlowFixMe
              const {absolutePath} = copyModuleDependencies.get(source);
              const dependency = globalDependencies.get(absolutePath);
              if (!dependency) {
                return;
              }

              if (localName === 'default') {
                /* export {default} from 'xxx' or export {default as B} from 'xxx' */
                if (
                  (exportedName === 'default' &&
                    module.importee.exportDefault.references === 0) ||
                  exportedName !== 'default'
                ) {
                  // $FlowFixMe
                  const subDependecyImportee = module.dependencies.get(source).data.data.importee;
                  removeSpecifier();
                  if (exportedName === 'isString') {
                    console.log(module.path, dependency.importee);
                    
                  }
                  dependency.importee.exportDefault.references--;
                  /* because of generate code will use it，should remove shaking dependency */
                  subDependecyImportee.exportDefault.references--;
                  if (wasNoReferences(subDependecyImportee)) {
                    module.dependencies.delete(source);
                  }
                  if (
                    !path.scope.path.find(path =>
                      path.isImportDefaultSpecifier()
                    )
                  ) {
                    module.dependencies.delete(
                      '@babel/runtime/helpers/interopRequireWildcard'
                    );
                  }
                }
              } else {
                removeSpecifier();
                dependency.importee.exports[localName].references--;
              }
            }
          });
        }
      },
      ExportDefaultDeclaration(path) {
        // export default A;
        if (module.importee.exportDefault.references === 0) {
          traverseState.changed = true;
          path.remove();
        }
      },
      ExportAllDeclaration(path) {
        if (exportsFormOtherModule.length === 0) {
          traverseState.changed = true;
          path.remove();
        }
      },
    };
    traverse(module.sourceAst, visitor);

    if (traverseState.changed) {
      // $FlowFixMe
      module.output = (
        await transform(config, projectRoot, module, options)
      ).output;
    }
  }
}

async function treeShaking(
  graph: OutputGraph,
  config: JsTransformerConfig,
  projectRoot: string,
  options: JsTransformOptions
): Promise<void> {
  const globalDependencies = graph.dependencies;
  const beforeKeys = [...globalDependencies.keys()];
  console.time('after treeshaking');
  console.log('dependencies size: ', beforeKeys.length);

  const treeShakingIgnore = (absolutePath: string) => {
    // babel imports module assist code
    // Image/AssetRegistry.js is imported by metro...
    return (
      /(babel)|(react-native)\//g.test(absolutePath) ||
      graph.entryPoints.includes(absolutePath) ||
      config.treeShakingPathIgnore(absolutePath)
    );
  };

  collectExports(graph, treeShakingIgnore);

  // analyze AST
  await removeUnUsedExports(graph, config, projectRoot, options, treeShakingIgnore);
  // remove dependencies
  const entries = globalDependencies.entries();
  const removedDependencies: Array<string> = [];
  for (const [absolutePath, module] of entries) {
    if (treeShakingIgnore(absolutePath)) {
      continue;
    }

    const importee = module.importee;
    if (wasNoReferences(importee)) {
      removedDependencies.push(absolutePath);
    }
  }
  // cycle
  do {
    const absolutePath = removedDependencies.shift();
    const module = globalDependencies.get(absolutePath);
    if (!module || treeShakingIgnore(absolutePath)) {
      continue;
    }
    globalDependencies.delete(absolutePath);
    const entries = module.dependencies.entries();
    for (const [source, dependecy] of entries) {
      const {data} = dependecy.data;
      const importee = globalDependencies.get(dependecy.absolutePath)?.importee;
      if (!importee) {
        continue;
      }
      importee.exportDefault.references -=
        data.importee.exportDefault.references;
      importee.exportAll.references -= data.importee.exportAll.references;
      Object.keys(data.importee.exports).forEach(key => {
        if (hasOwnProperty(importee.exports, key)) {
          importee.exports[key].references -=
            data.importee.exports[key].references;
        }
      });
      if (wasNoReferences(importee)) {
        module.dependencies.delete(source);
        if (!removedDependencies.includes(dependecy.absolutePath)) {
          removedDependencies.push(dependecy.absolutePath);
        }
      }
    }
  } while (removedDependencies.length !== 0);

  // remove subdependencies
  for (const module of globalDependencies.values()) {
    for (const [moduleName, dependecy] of module.dependencies.entries()) {
      if (!globalDependencies.has(dependecy.absolutePath)) {
        module.dependencies.delete(moduleName);
      }
    }
  }

  const afterKeys = [...globalDependencies.keys()];
  console.timeEnd('after treeshaking');
  console.log('dependencies size: ', afterKeys.length, afterKeys);
}

export default treeShaking;
