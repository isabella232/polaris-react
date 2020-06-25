import fs from 'fs';
import path from 'path';
import {promisify} from 'util';

import {createFilter} from '@rollup/pluginutils';
import glob from 'glob';
import nodeSass from 'node-sass';
import postcss from 'postcss';
import cssModulesExtractImports from 'postcss-modules-extract-imports';
import cssModulesLocalByDefault from 'postcss-modules-local-by-default';
import cssModulesScope from 'postcss-modules-scope';
import cssModulesValues from 'postcss-modules-values';
import Parser from 'postcss-modules-parser';
import postcssShopify from '@shopify/postcss-plugin';

import {getNamespacedClassName} from '../namespaced-classname';

const renderSass = promisify(nodeSass.render);

export function stylesStandalone(options = {}) {
  const filter = createFilter(
    options.include || ['**/*.css', '**/*.scss'],
    options.exclude,
  );

  const {output} = options;
  const cssByFile = {};

  let inputRoot;

  const styleProcessor = postcss([
    cssModulesValues,
    cssModulesLocalByDefault,
    cssModulesExtractImports,
    cssModulesScope({generateScopedName: getNamespacedClassName}),
    new Parser({
      fetch(to, from) {
        const fromDirectoryPath = path.dirname(from);
        const toPath = path.resolve(fromDirectoryPath, to);
        const source = fs.readFileSync(toPath, 'utf8');
        return getPostCSSOutput(styleProcessor, source, toPath);
      },
    }),
    postcssShopify(),
  ]);

  return {
    name: 'styles-standalone',

    buildStart({input}) {
      inputRoot = path.dirname(input);
    },

    async transform(source, id) {
      if (!filter(id)) {
        return null;
      }
      const sassOutput = await renderSass({
        data: source,
        includePaths: [path.dirname(id)],
      }).then((result) => result.css.toString());

      const postCssOutput = await getPostCSSOutput(
        styleProcessor,
        sassOutput,
        id,
      );

      cssByFile[id] = postCssOutput.css;

      const properties = JSON.stringify(postCssOutput.tokens, null, 2);
      return `export default ${properties};`;
    },

    generateBundle(generateOptions, bundles) {
      // generateBundle gets called once per call to bundle.write(). We call
      // that twice - one for the cjs build (polaris.js), one for the esm build
      // (polaris.es.js). We only want to do perform this logic once though
      if (!generateOptions.file.endsWith('/index.js')) {
        return;
      }

      if (typeof output !== 'string') {
        return;
      }

      // Items are added to cssAndTokensByFile in an unspecified order as
      // whatever transform gets resolved first appears first. The contents of
      // the css file should use the order in which scss files were referenced
      // in the compiled javascript file.
      const styleIds = Object.keys(cssByFile);
      const includedStyleIds = Array.from(
        Object.values(bundles).reduce((memo, bundle) => {
          Object.keys(bundle.modules).forEach((moduleName) => {
            if (styleIds.includes(moduleName)) {
              memo.add(moduleName);
            }
          });
          return memo;
        }, new Set()),
      );

      const orderedCssByFile = includedStyleIds.reduce((memo, id) => {
        return memo.set(id, cssByFile[id]);
      }, new Map());

      const css = Array.from(orderedCssByFile.values()).join('\n\n');

      // Regular css file
      this.emitFile({type: 'asset', fileName: output, source: css});

      generateSass(this.emitFile, inputRoot, orderedCssByFile);
    },
  };
}

function getPostCSSOutput(processor, source, fromPath) {
  return processor
    .process(source, {from: fromPath})
    .then(({css, root: {tokens}}) => ({css, tokens}));
}

/**
 * The Sass build - the styles folder.
 * Contains our public Sass API - functions and mixins that consuming apps can use.
 * - _public-api.scss is the entrypoint that consumer should use
 */
function generateSass(emitFile, inputFolder) {
  // Copy scss files in the styles folder into the build output
  // Skip _common.scss as that is a provate API
  const globOptions = {cwd: inputFolder, ignore: 'styles/_common.scss'};

  glob.sync(`styles/**/*.scss`, globOptions).forEach((filePath) => {
    const file = fs.readFileSync(`${inputFolder}/${filePath}`, 'utf8');
    emitFile({type: 'asset', fileName: filePath, source: file});
  });
}
