// Content-based filename hashing for cache-invalidation only of files that have undergone changes
import esbuild from 'esbuild';
import * as sass from 'sass';
import path from 'path';
import fs from 'fs';
import fsp from 'fs/promises';
import crypto from 'crypto';

const CONFIG = {
  PUBLIC_PATH: '/',
  SRC_DIR: 'src',
  BUILD_DIR: 'dist',
  HASH_LENGTH: 6,
};

if(fs.existsSync(CONFIG.BUILD_DIR)) fs.rmSync(CONFIG.BUILD_DIR, { recursive: true });
fs.mkdirSync(CONFIG.BUILD_DIR, { recursive: true });

const hashContent = (content) => {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 6);
};

const writeHashedFile = async (inputPath, outputDir, content, ext) => {
  const hash = hashContent(content);
  const baseName = path.basename(inputPath, path.extname(inputPath));
  const hashedName = `${baseName}.${hash}${ext}`;

  const relDir = path.dirname(inputPath);
  const fullOutputDir = path.join(outputDir, relDir);
  await fsp.mkdir(fullOutputDir, { recursive: true });

  const outputPath = path.join(fullOutputDir, hashedName);
  await fsp.writeFile(outputPath, content);
  return hashedName;
};

const copyAndHashAsset = async (relPath) => {
  const fullPath = path.join(CONFIG.SRC_DIR, relPath);
  const content = await fsp.readFile(fullPath);
  const hashedName = await writeHashedFile(relPath, CONFIG.BUILD_DIR, content, path.extname(relPath));
  console.log(`Copied asset to ${hashedName}`);
  return hashedName;
};

const rewriteAssetRefs = (content, assetMap, pathMap) => {
  for(const [relPath, hashedName] of Object.entries(assetMap)) {
    const originalPath = '/' + relPath.replace(/\\/g, '/');
    const escapedOriginalPath = originalPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const regex = new RegExp(`(href|src)=["']${escapedOriginalPath}(#[^"']*)?["']`, 'g');

    // if(!pathMap[relPath]) {
    //   console.log('No relative path, using root (`/`)');
    // }
    const dir = pathMap[relPath] || '/';
    const rewrittenPath = path.posix.join(CONFIG.PUBLIC_PATH, dir, hashedName); //posix to prevent double slash in case of no relPath

    content = content.replace(regex, (_, attr, fragment = '') => {
      return `${attr}="${rewrittenPath}${fragment}"`;
    });
  }

  return content;
};

const htmlRewriteWithCSSandJS = (content) => {
  content = rewriteAssetRefs(content, assetMap, pathMap);

  content = content.replace(
    /<link rel="stylesheet" href="\/index\.css">/g,
    `<link rel="stylesheet" href="${CONFIG.PUBLIC_PATH}${cssName}">`
  );

  content = content.replace(
    /<script src="\/js\/scripts\.js" defer><\/script>/g,
    `<script src="${CONFIG.PUBLIC_PATH}${jsName}" defer></script>`
  );

  return content;
};

// Maps source filenames to output directories for hashed filename versions of files to be written
// add assets as needed. one point of hardcoding is acceptable in a small codebase
const pathMap = {
  'favicon.ico': '/',
  'icon.svg': '/',
  'apple-touch-icon.png': '/',
  'svg/ball.min.svg': '/svg/',
  'svg/ball_bm.min.svg': '/svg/',
  'svg/monster.min.svg': '/svg/',
  'svg/types-min.svg': '/svg/',
  'svg/icons.svg': '/svg/',
  'json/exceptions.json': '/json/',
  'json/gen1_mon_search.json': '/json/',
  'json/gen1_move_search.json': '/json/',
  'json/gen1.json': '/json/',
  'json/gen2-5_mon_search.json': '/json/',
  'json/gen2-5_move_search.json': '/json/',
  'json/gen2-5.json': '/json/',
  'json/gen6+_mon_search.json': '/json/',
  'json/gen6+_move_search.json': '/json/',
  'json/gen6+.json': '/json/',
  // 'js/class-tools.min.js': '/js/',
  'js/third_party/fuse.min.js': '/js/third_party/',
  'js/third_party/htmx.min.js': '/js/third_party/',
  'js/third_party/preload.min.js': '/js/third_party/',
};

const assetMap = {};
for(const asset of Object.keys(pathMap)) {
  const srcPath = path.join(CONFIG.SRC_DIR, asset);
  if(!fs.existsSync(srcPath)) {
    console.warn(`Warning: Asset '${asset}' not found at ${srcPath}`);
    continue;
  }

  const hashed = await copyAndHashAsset(asset);
  assetMap[asset] = hashed;
};

const jsRes = await esbuild.build({
  entryPoints: [path.join(CONFIG.SRC_DIR, '/js/scripts.js')],
  bundle: true,
  minify: true,
  write: false, // replacing asset links with hashed versions before write
  sourcemap: false,
  target: 'es2017',
});

const jsFile = jsRes.outputFiles.find(f => f.path === '<stdout>');
let jsOutput = jsFile.text;

for(const [relPath, hashedName] of Object.entries(assetMap)) {
  const originalWebPath = '/' + relPath.replace(/\\/g, '/'); // normalize slashes
  const escapedOriginalWebPath = originalWebPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const regex = new RegExp(`(?<![\\w-])${escapedOriginalWebPath}(?![\\w-])`, 'g');

  // prepend directory (from pathMap) to hashed file
  const folder = pathMap[relPath] || '/';
  const finalHashedPath = path.posix.join(CONFIG.PUBLIC_PATH, folder, hashedName);

  jsOutput = jsOutput.replace(regex, finalHashedPath);
}
// need to convert back to Buffer for JS case in writing hashed file
const jsBuffer = Buffer.from(jsOutput);
const jsName = await writeHashedFile('js/scripts.js', CONFIG.BUILD_DIR, jsBuffer, '.js');
console.log(`Bundled JS to ${jsName}`);

const scssResult = sass.compile(path.join(CONFIG.SRC_DIR, 'scss/index.scss'), { style: 'compressed' });
const cssName = await writeHashedFile('index.scss', CONFIG.BUILD_DIR, scssResult.css, '.css');
console.log(`SCSS compiled to CSS as '${cssName}'`);

assetMap['scss/index.scss'] = cssName;
assetMap['js/scripts.js'] = path.posix.join('js', jsName);

// add `more.html` later when assets are added to it
const htmlFiles = [
  'index.html',
  'pages/offense.html',
  'pages/defense.html',
  'pages/more.html'
];

for (const file of htmlFiles) {
  const fullPath = path.join(CONFIG.SRC_DIR, file);
  let content = await fsp.readFile(fullPath, 'utf-8');
  content = htmlRewriteWithCSSandJS(content);

  const outputPath = path.join(CONFIG.BUILD_DIR, file);
  await fsp.mkdir(path.dirname(outputPath), { recursive: true }); // ensure directory exists for `offense.html` and `defense.html`
  await fsp.writeFile(outputPath, content);
  console.log(`Updated and wrote ${file}`);
};

// console.log('Asset map output:', assetMap);