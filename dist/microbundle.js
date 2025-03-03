#!/usr/bin/env node
function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var fs = _interopDefault(require('fs'));
var path = require('path');
var kleur = require('kleur');
var asyncro = require('asyncro');
var glob = _interopDefault(require('tiny-glob/sync'));
var autoprefixer = _interopDefault(require('autoprefixer'));
var cssnano = _interopDefault(require('cssnano'));
var rollup = require('rollup');
var commonjs = _interopDefault(require('@rollup/plugin-commonjs'));
var babelPlugin = _interopDefault(require('rollup-plugin-babel'));
var core = require('@babel/core');
var merge = _interopDefault(require('lodash.merge'));
var es6Promisify = require('es6-promisify');
var nodeResolve = _interopDefault(require('@rollup/plugin-node-resolve'));
var rollupPluginTerser = require('rollup-plugin-terser');
var alias = _interopDefault(require('@rollup/plugin-alias'));
var postcss = _interopDefault(require('rollup-plugin-postcss'));
var postcssCopy = _interopDefault(require('postcss-copy'));
var gzipSize = _interopDefault(require('gzip-size'));
var brotliSize = _interopDefault(require('brotli-size'));
var prettyBytes = _interopDefault(require('pretty-bytes'));
var typescript = _interopDefault(require('rollup-plugin-typescript2'));
var json = _interopDefault(require('@rollup/plugin-json'));
var svgr = _interopDefault(require('@svgr/rollup'));
var smartAsset = _interopDefault(require('rollup-plugin-smart-asset'));
var camelCase = _interopDefault(require('camelcase'));

// A type of promise-like that resolves synchronously and supports only one observer

const _iteratorSymbol = /*#__PURE__*/ typeof Symbol !== "undefined" ? (Symbol.iterator || (Symbol.iterator = Symbol("Symbol.iterator"))) : "@@iterator";

const _asyncIteratorSymbol = /*#__PURE__*/ typeof Symbol !== "undefined" ? (Symbol.asyncIterator || (Symbol.asyncIterator = Symbol("Symbol.asyncIterator"))) : "@@asyncIterator";

// Asynchronously call a function and send errors to recovery continuation
function _catch(body, recover) {
	try {
		var result = body();
	} catch(e) {
		return recover(e);
	}
	if (result && result.then) {
		return result.then(void 0, recover);
	}
	return result;
}

const readFile = es6Promisify.promisify(fs.readFile);
const stat = es6Promisify.promisify(fs.stat);
const isDir = name => stat(name).then(stats => stats.isDirectory()).catch(() => false);
const isFile = name => stat(name).then(stats => stats.isFile()).catch(() => false);
const stdout = console.log.bind(console);
const stderr = console.error.bind(console);
const isTruthy = obj => {
  if (!obj) {
    return false;
  }

  return obj.constructor !== Object || Object.keys(obj).length > 0;
};

const ESMODULES_TARGET = {
  esmodules: true
};

const mergeConfigItems = (type, ...configItemsToMerge) => {
  const mergedItems = [];
  configItemsToMerge.forEach(configItemToMerge => {
    configItemToMerge.forEach(item => {
      const itemToMergeWithIndex = mergedItems.findIndex(mergedItem => mergedItem.file.resolved === item.file.resolved);

      if (itemToMergeWithIndex === -1) {
        mergedItems.push(item);
        return;
      }

      mergedItems[itemToMergeWithIndex] = core.createConfigItem([mergedItems[itemToMergeWithIndex].file.resolved, merge(mergedItems[itemToMergeWithIndex].options, item.options)], {
        type
      });
    });
  });
  return mergedItems;
};

const createConfigItems = (type, items) => {
  return items.map(({
    name,
    ...options
  }) => {
    return core.createConfigItem([require.resolve(name), options], {
      type
    });
  });
};

const presetEnvRegex = RegExp(/@babel\/(preset-)?env/);
var customBabel = (() => {
  return babelPlugin.custom(babelCore => {
    return {
      options({
        custom: customOptions,
        ...pluginOptions
      }) {
        return {
          customOptions,
          pluginOptions
        };
      },

      config(config, {
        customOptions
      }) {
        const defaultPlugins = createConfigItems('plugin', [{
          name: '@babel/plugin-transform-react-jsx',
          pragma: customOptions.pragma || 'h',
          pragmaFrag: customOptions.pragmaFrag || 'Fragment'
        }, !customOptions.typescript && {
          name: '@babel/plugin-transform-flow-strip-types'
        }, isTruthy(customOptions.defines) && {
          name: 'babel-plugin-transform-replace-expressions',
          replace: customOptions.defines
        }, !customOptions.modern && {
          name: 'babel-plugin-transform-async-to-promises',
          inlineHelpers: true,
          externalHelpers: true
        }, {
          name: '@babel/plugin-proposal-decorators',
          legacy: true
        }, {
          name: '@babel/plugin-proposal-optional-chaining'
        }, {
          name: '@babel/plugin-proposal-class-properties',
          loose: true
        }, !customOptions.modern && {
          name: '@babel/plugin-transform-regenerator',
          async: false
        }, {
          name: 'babel-plugin-macros'
        }].filter(Boolean));
        const babelOptions = config.options || {};
        const envIdx = (babelOptions.presets || []).findIndex(preset => presetEnvRegex.test(preset.file.request));
        const environmentPreset = customOptions.modern ? '@babel/preset-modules' : '@babel/preset-env';

        if (envIdx !== -1) {
          const preset = babelOptions.presets[envIdx];
          babelOptions.presets[envIdx] = core.createConfigItem([environmentPreset, Object.assign(merge({
            loose: true,
            useBuiltIns: false,
            targets: customOptions.targets
          }, preset.options, {
            modules: false,
            exclude: merge(['transform-async-to-generator', 'transform-regenerator'], preset.options && preset.options.exclude || [])
          }), customOptions.modern ? {
            targets: ESMODULES_TARGET
          } : {})], {
            type: `preset`
          });
        } else {
          babelOptions.presets = createConfigItems('preset', [{
            name: environmentPreset,
            targets: customOptions.modern ? ESMODULES_TARGET : customOptions.targets,
            modules: false,
            loose: true,
            useBuiltIns: false,
            exclude: ['transform-async-to-generator', 'transform-regenerator']
          }]);
        }

        babelOptions.plugins = mergeConfigItems('plugin', defaultPlugins, babelOptions.plugins || []);
        babelOptions.generatorOpts = {
          minified: customOptions.compress,
          compact: customOptions.compress,
          shouldPrintComment: comment => /[@#]__PURE__/.test(comment)
        };
        return babelOptions;
      }

    };
  });
});

function logError (err) {
  const error = err.error || err;
  const description = `${error.name ? error.name + ': ' : ''}${error.message || error}`;
  const message = error.plugin ? `(${error.plugin} plugin) ${description}` : description;
  stderr(kleur.red().bold(message));

  if (error.loc) {
    stderr();
    stderr(`at ${error.loc.file}:${error.loc.line}:${error.loc.column}`);
  }

  if (error.frame) {
    stderr();
    stderr(kleur.dim(error.frame));
  } else if (err.stack) {
    const headlessStack = error.stack.replace(message, '');
    stderr(kleur.dim(headlessStack));
  }

  stderr();
}

const getEntries = function ({
  input,
  cwd
}) {
  try {
    return Promise.resolve(asyncro.map([].concat(input), function (file) {
      try {
        file = path.resolve(cwd, file);
        return Promise.resolve(isDir(file)).then(function (_isDir3) {
          if (_isDir3) {
            file = path.resolve(file, 'index.js');
          }

          return file;
        });
      } catch (e) {
        return Promise.reject(e);
      }
    })).then(function (_map) {
      let entries = _map.filter((item, i, arr) => arr.indexOf(item) === i);

      return entries;
    });
  } catch (e) {
    return Promise.reject(e);
  }
};

const getOutput = function ({
  cwd,
  output,
  pkgMain,
  pkgName
}) {
  try {
    function _temp9(_isDir2) {
      if (_isDir2) {
        main = path.resolve(main, `${removeScope(pkgName)}.js`);
      }

      return main;
    }

    let main = path.resolve(cwd, output || pkgMain || 'dist');

    const _main$match = !main.match(/\.[a-z]+$/);

    return Promise.resolve(_main$match ? _temp9(_main$match) : Promise.resolve(isDir(main)).then(_temp9));
  } catch (e) {
    return Promise.reject(e);
  }
};

const getInput = function ({
  entries,
  cwd,
  source,
  module
}) {
  try {
    function _temp8(_isDir) {
      function _temp7(_jsOrTs) {
        function _temp6(_jsOrTs2) {
          _concat.call([], _temp5 ? _jsOrTs2 : _jsOrTs2 || module).map(file => glob(file)).forEach(file => input.push(...file));

          return input;
        }

        return _temp5 || _temp4 || _jsOrTs ? _temp6(_temp5 ? _jsOrTs : _temp4 || _jsOrTs || jsOrTs(cwd, 'index')) : Promise.resolve(_temp5 ? _jsOrTs : _temp4 || _jsOrTs || jsOrTs(cwd, 'index')).then(_temp6);
      }

      return _temp5 || _temp4 || !_isDir ? _temp7(_temp5 ? _isDir : _temp4 || _isDir && jsOrTs(cwd, 'src/index')) : Promise.resolve(_temp5 ? _isDir : _temp4 || _isDir && jsOrTs(cwd, 'src/index')).then(_temp7);
    }

    const input = [];

    const _concat = [].concat,
          _temp5 = entries && entries.length,
          _temp4 = _temp5 || source && (Array.isArray(source) ? source : [source]).map(file => path.resolve(cwd, file));

    return Promise.resolve(_temp5 || _temp4 ? _temp8(_temp5 ? entries : _temp4 || isDir(path.resolve(cwd, 'src'))) : Promise.resolve(_temp5 ? entries : _temp4 || isDir(path.resolve(cwd, 'src'))).then(_temp8));
  } catch (e) {
    return Promise.reject(e);
  }
};

const jsOrTs = function (cwd, filename) {
  try {
    return Promise.resolve(isFile(path.resolve(cwd, filename + '.ts'))).then(function (_isFile) {
      function _temp3(_isFile2) {
        const extension = _isFile ? _isFile2 : _isFile2 ? '.tsx' : '.js';
        return path.resolve(cwd, `${filename}${extension}`);
      }

      return _isFile ? _temp3('.ts') : Promise.resolve(isFile(path.resolve(cwd, filename + '.tsx'))).then(_temp3);
    });
  } catch (e) {
    return Promise.reject(e);
  }
};

const getConfigFromPkgJson = function (cwd) {
  try {
    return Promise.resolve(_catch(function () {
      return Promise.resolve(readFile(path.resolve(cwd, 'package.json'), 'utf8')).then(function (pkgJSON) {
        const pkg = JSON.parse(pkgJSON);
        return {
          hasPackageJson: true,
          pkg
        };
      });
    }, function (err) {
      const pkgName = path.basename(cwd);
      stderr(kleur.yellow(`${kleur.yellow().inverse('WARN')} no package.json found. Assuming a pkg.name of "${pkgName}".`));
      let msg = String(err.message || err);
      if (!msg.match(/ENOENT/)) stderr(`  ${kleur.red().dim(msg)}`);
      return {
        hasPackageJson: false,
        pkg: {
          name: pkgName
        }
      };
    }));
  } catch (e) {
    return Promise.reject(e);
  }
};

const microbundle = function (inputOptions) {
  try {
    let options = { ...inputOptions
    };
    options.cwd = path.resolve(process.cwd(), inputOptions.cwd);
    const cwd = options.cwd;
    return Promise.resolve(getConfigFromPkgJson(cwd)).then(function ({
      hasPackageJson,
      pkg
    }) {
      options.pkg = pkg;
      const {
        finalName,
        pkgName
      } = getName({
        name: options.name,
        pkgName: options.pkg.name,
        amdName: options.pkg.amdName,
        hasPackageJson,
        cwd
      });
      options.name = finalName;
      options.pkg.name = pkgName;

      if (options.sourcemap !== false) {
        options.sourcemap = true;
      }

      return Promise.resolve(getInput({
        entries: options.entries,
        cwd,
        source: options.pkg.source,
        module: options.pkg.module
      })).then(function (_getInput) {
        options.input = _getInput;
        return Promise.resolve(getOutput({
          cwd,
          output: options.output,
          pkgMain: options.pkg.main,
          pkgName: options.pkg.name
        })).then(function (_getOutput) {
          options.output = _getOutput;
          return Promise.resolve(getEntries({
            cwd,
            input: options.input
          })).then(function (_getEntries) {
            options.entries = _getEntries;
            options.multipleEntries = options.entries.length > 1;
            options.compress = typeof options.compress !== 'boolean' ? options.compress !== 'false' && options.compress !== '0' : options.compress;
            let formats = (options.format || options.formats).split(',');
            formats.sort((a, b) => a === 'cjs' ? -1 : a > b ? 1 : 0);
            let steps = [];

            for (let i = 0; i < options.entries.length; i++) {
              for (let j = 0; j < formats.length; j++) {
                steps.push(createConfig(options, options.entries[i], formats[j], i === 0 && j === 0));
              }
            }

            if (options.watch) {
              const onBuild = options.onBuild;
              return new Promise((resolve, reject) => {
                stdout(kleur.blue(`Watching source, compiling to ${path.relative(cwd, path.dirname(options.output))}:`));
                steps.map(options => {
                  rollup.watch(Object.assign({
                    output: options.outputOptions,
                    watch: WATCH_OPTS
                  }, options.inputOptions)).on('event', e => {
                    if (e.code === 'FATAL') {
                      return reject(e.error);
                    } else if (e.code === 'ERROR') {
                      logError(e.error);
                    }

                    if (e.code === 'END') {
                      options._sizeInfo.then(text => {
                        stdout(`Wrote ${text.trim()}`);
                      });

                      if (typeof onBuild === 'function') {
                        onBuild(e);
                      }
                    }
                  });
                });
              });
            }

            let cache;
            return Promise.resolve(asyncro.series(steps.map(config => function () {
              try {
                const {
                  inputOptions,
                  outputOptions
                } = config;
                inputOptions.cache = cache;
                return Promise.resolve(rollup.rollup(inputOptions)).then(function (bundle) {
                  cache = bundle;
                  return Promise.resolve(bundle.write(outputOptions)).then(function () {
                    return Promise.resolve(config._sizeInfo);
                  });
                });
              } catch (e) {
                return Promise.reject(e);
              }
            }))).then(function (out) {
              return kleur.blue(`Build "${options.name}" to ${path.relative(cwd, path.dirname(options.output)) || '.'}:`) + '\n   ' + out.join('\n   ');
            });
          });
        });
      });
    });
  } catch (e) {
    return Promise.reject(e);
  }
};

const getSizeInfo = function (code, filename, raw) {
  try {
    return Promise.resolve(gzipSize(code)).then(function (_gzipSize) {
      let _exit = false;

      function _temp2(_result) {
        return _exit ? _result : gzip + '\n' + brotli;
      }

      const gzip = formatSize(_gzipSize, filename, 'gz', raw || code.length < 5000);
      let brotli;

      const _temp = _catch(function () {
        return Promise.resolve(brotliSize(code)).then(function (_brotliSize) {
          brotli = formatSize(_brotliSize, filename, 'br', raw || code.length < 5000);
        });
      }, function () {
        _exit = true;
        return gzip;
      });

      return _temp && _temp.then ? _temp.then(_temp2) : _temp2(_temp);
    });
  } catch (e) {
    return Promise.reject(e);
  }
};

const removeScope = name => name.replace(/^@.*\//, '');

const toReplacementExpression = (value, name) => {
  const matches = value.match(/^(['"])(.+)\1$/);

  if (matches) {
    return [JSON.stringify(matches[2]), name];
  }

  if (/^(true|false|\d+)$/i.test(value)) {
    return [value, name];
  }

  return [JSON.stringify(value), name];
};

function normalizeMinifyOptions(minifyOptions) {
  const mangle = minifyOptions.mangle || (minifyOptions.mangle = {});
  let properties = mangle.properties;

  if (minifyOptions.properties != null) {
    properties = mangle.properties = minifyOptions.properties && Object.assign(properties, minifyOptions.properties);
  }

  if (minifyOptions.regex || minifyOptions.reserved) {
    if (!properties) properties = mangle.properties = {};
    properties.regex = properties.regex || minifyOptions.regex;
    properties.reserved = properties.reserved || minifyOptions.reserved;
  }

  if (properties) {
    if (properties.regex) properties.regex = new RegExp(properties.regex);
    properties.reserved = [].concat(properties.reserved || []);
  }
}

const parseMappingArgument = (globalStrings, processValue) => {
  const globals = {};
  globalStrings.split(',').forEach(globalString => {
    let [key, value] = globalString.split('=');

    if (processValue) {
      const r = processValue(value, key);

      if (r !== undefined) {
        if (Array.isArray(r)) {
          [value, key] = r;
        } else {
          value = r;
        }
      }
    }

    globals[key] = value;
  });
  return globals;
};

const parseMappingArgumentAlias = aliasStrings => {
  return aliasStrings.split(',').map(str => {
    let [key, value] = str.split('=');
    return {
      find: key,
      replacement: value
    };
  });
};

const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.es6', '.es', '.mjs', '.jpg', '.png', '.svg'];
const WATCH_OPTS = {
  exclude: 'node_modules/**'
};

function formatSize(size, filename, type, raw) {
  const pretty = raw ? `${size} B` : prettyBytes(size);
  const color = size < 5000 ? kleur.green : size > 40000 ? kleur.red : kleur.yellow;
  const MAGIC_INDENTATION = type === 'br' ? 13 : 10;
  return `${' '.repeat(MAGIC_INDENTATION - pretty.length)}${color(pretty)}: ${kleur.white(path.basename(filename))}.${type}`;
}

const safeVariableName = name => camelCase(removeScope(name).toLowerCase().replace(/((^[^a-zA-Z]+)|[^\w.-])|([^a-zA-Z0-9]+$)/g, ''));

function getName({
  name,
  pkgName,
  amdName,
  cwd,
  hasPackageJson
}) {
  if (!pkgName) {
    pkgName = path.basename(cwd);

    if (hasPackageJson) {
      stderr(kleur.yellow(`${kleur.yellow().inverse('WARN')} missing package.json "name" field. Assuming "${pkgName}".`));
    }
  }

  return {
    finalName: name || amdName || safeVariableName(pkgName),
    pkgName
  };
}

const shebang = {};

function createConfig(options, entry, format, writeMeta) {
  let {
    pkg
  } = options;
  let external = ['dns', 'fs', 'path', 'url'].concat(options.entries.filter(e => e !== entry));
  let outputAliases = {};

  if (options.multipleEntries) {
    outputAliases['.'] = './' + path.basename(options.output);
  }

  const moduleAliases = options.alias ? parseMappingArgumentAlias(options.alias) : [];
  const peerDeps = Object.keys(pkg.peerDependencies || {});

  if (options.external === 'none') ; else if (options.external) {
    external = external.concat(peerDeps).concat(options.external.split(','));
  } else {
    external = external.concat(peerDeps).concat(Object.keys(pkg.dependencies || {}));
  }

  let globals = external.reduce((globals, name) => {
    if (name.match(/^[a-z_$][a-z0-9_$]*$/)) {
      globals[name] = name;
    }

    return globals;
  }, {});

  if (options.globals && options.globals !== 'none') {
    globals = Object.assign(globals, parseMappingArgument(options.globals));
  }

  let defines = {};

  if (options.define) {
    defines = Object.assign(defines, parseMappingArgument(options.define, toReplacementExpression));
  }

  function replaceName(filename, name) {
    return path.resolve(path.dirname(filename), name + path.basename(filename).replace(/^[^.]+/, ''));
  }

  let mainNoExtension = options.output;

  if (options.multipleEntries) {
    let name = entry.match(/([\\/])index(\.(umd|cjs|es|m))?\.m?js$/) ? mainNoExtension : entry;
    mainNoExtension = path.resolve(path.dirname(mainNoExtension), path.basename(name));
  }

  mainNoExtension = mainNoExtension.replace(/(\.(umd|cjs|es|m))?\.m?js$/, '');
  let moduleMain = replaceName(pkg.module && !pkg.module.match(/src\//) ? pkg.module : pkg['jsnext:main'] || 'x.esm.js', mainNoExtension);
  let modernMain = replaceName(pkg.syntax && pkg.syntax.esmodules || pkg.esmodule || 'x.modern.js', mainNoExtension);
  let cjsMain = replaceName(pkg['cjs:main'] || 'x.js', mainNoExtension);
  let umdMain = replaceName(pkg['umd:main'] || 'x.umd.js', mainNoExtension);
  const modern = format === 'modern';
  let nameCache = {};
  const bareNameCache = nameCache;
  const rawMinifyValue = options.pkg.minify || options.pkg.mangle || {};
  let minifyOptions = typeof rawMinifyValue === 'string' ? {} : rawMinifyValue;
  const getNameCachePath = typeof rawMinifyValue === 'string' ? () => path.resolve(options.cwd, rawMinifyValue) : () => path.resolve(options.cwd, 'mangle.json');
  const useTypescript = path.extname(entry) === '.ts' || path.extname(entry) === '.tsx';
  const externalPredicate = new RegExp(`^(${external.join('|')})($|/)`);
  const externalTest = external.length === 0 ? id => false : id => externalPredicate.test(id);

  function loadNameCache() {
    try {
      nameCache = JSON.parse(fs.readFileSync(getNameCachePath(), 'utf8'));

      if (nameCache.minify) {
        minifyOptions = Object.assign({}, minifyOptions || {}, nameCache.minify);
      }
    } catch (e) {}
  }

  loadNameCache();
  normalizeMinifyOptions(minifyOptions);
  if (nameCache === bareNameCache) nameCache = null;
  let config = {
    inputOptions: {
      input: entry,
      external: id => {
        if (id === 'babel-plugin-transform-async-to-promises/helpers') {
          return false;
        }

        if (options.multipleEntries && id === '.') {
          return true;
        }

        return externalTest(id);
      },
      treeshake: {
        propertyReadSideEffects: false
      },
      plugins: [].concat(postcss({
        plugins: [autoprefixer(), options.compress !== false && cssnano({
          preset: 'default'
        }), postcssCopy({
          dest: options.output,
          template: 'assets/[hash].[ext][query]'
        })].filter(Boolean),
        autoModules: shouldCssModules(options),
        modules: cssModulesConfig(options),
        inject: false,
        extract: !!writeMeta
      }), moduleAliases.length > 0 && alias({
        resolve: EXTENSIONS,
        entries: moduleAliases
      }), nodeResolve({
        mainFields: ['module', 'jsnext', 'main'],
        browser: options.target !== 'node',
        extensions: ['.mjs', '.js', '.jsx', '.json', '.node']
      }), commonjs({
        include: /\/node_modules\//
      }), json(), smartAsset({
        url: 'copy',
        useHash: true,
        keepName: true,
        keepImport: true
      }), svgr(), {
        transform: code => ({
          code: code.replace(/^#![^\n]*/, bang => {
            shebang[options.name] = bang;
          }),
          map: null
        })
      }, useTypescript && typescript({
        typescript: require('typescript'),
        cacheRoot: `./node_modules/.cache/.rts2_cache_${format}`,
        objectHashIgnoreUnknownHack: true,
        tsconfigDefaults: {
          compilerOptions: {
            sourceMap: options.sourcemap,
            declaration: true,
            jsx: 'react',
            jsxFactory: options.jsx || 'React.createElement'
          }
        },
        tsconfig: options.tsconfig,
        tsconfigOverride: {
          compilerOptions: {
            target: 'esnext'
          }
        }
      }), isTruthy(defines) && babelPlugin({
        babelrc: false,
        configFile: false,
        compact: false,
        include: 'node_modules/**',
        plugins: [[require.resolve('babel-plugin-transform-replace-expressions'), {
          replace: defines
        }]]
      }), customBabel()({
        extensions: EXTENSIONS,
        exclude: 'node_modules/**',
        passPerPreset: true,
        custom: {
          defines,
          modern,
          compress: options.compress !== false,
          targets: options.target === 'node' ? {
            node: '8'
          } : undefined,
          pragma: options.jsx || 'React.createElement',
          pragmaFrag: options.jsxFragment || 'Fragment',
          typescript: !!useTypescript
        }
      }), options.compress !== false && [rollupPluginTerser.terser({
        sourcemap: true,
        compress: Object.assign({
          keep_infinity: true,
          pure_getters: true,
          passes: 10
        }, minifyOptions.compress || {}),
        output: {
          wrap_func_args: false
        },
        warnings: true,
        ecma: modern ? 9 : 5,
        toplevel: modern || format === 'cjs' || format === 'es',
        mangle: Object.assign({}, minifyOptions.mangle || {}),
        nameCache
      }), nameCache && {
        options: loadNameCache,

        writeBundle() {
          if (writeMeta && nameCache) {
            fs.writeFile(getNameCachePath(), JSON.stringify(nameCache, null, 2), () => {});
          }
        }

      }], {
        writeBundle(bundle) {
          config._sizeInfo = Promise.all(Object.values(bundle).map(({
            code,
            fileName
          }) => {
            if (code) {
              return getSizeInfo(code, fileName, options.raw);
            }
          })).then(results => results.filter(Boolean).join('\n'));
        }

      }).filter(Boolean)
    },
    outputOptions: {
      paths: outputAliases,
      globals,
      strict: options.strict === true,
      legacy: true,
      freeze: false,
      esModule: false,
      sourcemap: options.sourcemap,

      get banner() {
        return shebang[options.name];
      },

      format: modern ? 'es' : format,
      name: options.name,
      file: path.resolve(options.cwd, {
        modern: modernMain,
        es: moduleMain,
        umd: umdMain
      }[format] || cjsMain)
    }
  };
  return config;
}

function shouldCssModules(options) {
  const passedInOption = processCssmodulesArgument(options);
  const moduleAllCss = passedInOption === true;
  const allowOnlySuffixModule = passedInOption === null;
  return moduleAllCss || allowOnlySuffixModule;
}

function cssModulesConfig(options) {
  const passedInOption = processCssmodulesArgument(options);
  const isWatchMode = options.watch;
  const hasPassedInScopeName = !(typeof passedInOption === 'boolean' || passedInOption === null);

  if (shouldCssModules(options) || hasPassedInScopeName) {
    let generateScopedName = isWatchMode ? '_[name]__[local]__[hash:base64:5]' : '_[hash:base64:5]';

    if (hasPassedInScopeName) {
      generateScopedName = passedInOption;
    }

    return {
      generateScopedName
    };
  }

  return false;
}

function processCssmodulesArgument(options) {
  if (options['css-modules'] === 'true' || options['css-modules'] === true) return true;
  if (options['css-modules'] === 'false' || options['css-modules'] === false) return false;
  if (options['css-modules'] === 'null' || options['css-modules'] === null) return null;
  return options['css-modules'];
}

module.exports = microbundle;
//# sourceMappingURL=microbundle.js.map
