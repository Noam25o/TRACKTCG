const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

// Exercise the actual pure service modules without loading React Native.
module.exports = function loadTypescript(relativePath) {
  return compile(path.resolve(__dirname, '..', relativePath), new Map());
};

function compile(filename, cache) {
  if (cache.has(filename)) return cache.get(filename).exports;
  const source = fs.readFileSync(filename, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  });
  const instance = new Module(filename, module);
  instance.filename = filename;
  instance.paths = Module._nodeModulePaths(path.dirname(filename));
  cache.set(filename, instance);
  const requireOriginal = instance.require.bind(instance);
  instance.require = (id) => {
    const dependency = id.startsWith('.') ? path.resolve(path.dirname(filename), id + '.ts') : null;
    return dependency && fs.existsSync(dependency) ? compile(dependency, cache) : requireOriginal(id);
  };
  instance._compile(outputText, filename);
  return instance.exports;
}
