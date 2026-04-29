/*
- (REMOVED from Dev build) -- Content-based filename hashing for cache-invalidation only of files that have undergone changes
*/
import esbuild from 'esbuild';
import * as sass from 'sass';
import path from 'path';
import fs from 'fs';
import fsp from 'fs/promises';

const CONFIG = {
  SRC_DIR: 'src',
  BUILD_DIR: 'dist',
};

//! DON'T DELETE IN DEV - esbuild holds open
// if(fs.existsSync(CONFIG.BUILD_DIR)) fs.rmSync(CONFIG.BUILD_DIR, { recursive: true });
fs.mkdirSync(CONFIG.BUILD_DIR, { recursive: true });

const copyAsset = async (relPath) => {
  const srcPath = path.join(CONFIG.SRC_DIR, relPath);
  const destPath = path.join(CONFIG.BUILD_DIR, relPath);
  await fsp.mkdir(path.dirname(destPath), { recursive: true });
  await fsp.copyFile(srcPath, destPath);
  // console.log(`Copied ${relPath}`);
};

//* RARELY CHANGE, no hashing needed in dev
const staticAssets = [
  'favicon.ico',
  'icon.svg',
  'apple-touch-icon.png',
  'DMSans-Subset-Regular.woff2',
  'DMSans-Subset-Bold.woff2',
  'svg/ball.min.svg',
  'svg/ball_bm.min.svg',
  'svg/monster.min.svg',
  'svg/types-min.svg',
  'svg/icons.svg',
  'json/exceptions.json',
  'json/gen1_mon_search.json',
  'json/gen1_move_search.json',
  'json/gen1.json',
  'json/gen2-5_mon_search.json',
  'json/gen2-5_move_search.json',
  'json/gen2-5.json',
  'json/gen6+_mon_search.json',
  'json/gen6+_move_search.json',
  'json/gen6+.json',
  // 'js/class-tools.min.js,
  'js/third_party/fuse.min.js',
  'js/third_party/htmx.min.js',
  'js/third_party/preload.min.js',
];

for (const asset of staticAssets) {
  if (fs.existsSync(path.join(CONFIG.SRC_DIR, asset))) {
    await copyAsset(asset);
  } else {
    console.warn(`Warning: Asset '${asset}' not found`);
  }
}

//* Copy template and HTML files once on startup
await fsp.copyFile(
  path.join(CONFIG.SRC_DIR, 'index.html.tmpl'),
  path.join(CONFIG.BUILD_DIR, 'index.html.tmpl')
);

const htmlFiles = [
  'index.html',
  'pages/offense.html',
  'pages/defense.html',
  'pages/more.html',
  '404.html'
];

for (const file of htmlFiles) {
  const outputPath = path.join(CONFIG.BUILD_DIR, file);
  await fsp.mkdir(path.dirname(outputPath), { recursive: true });
  await fsp.copyFile(path.join(CONFIG.SRC_DIR, file), outputPath);
}

//* Write static dev manifest — no hashing in dev
await fsp.copyFile('manifest.dev.json', path.join(CONFIG.BUILD_DIR, 'asset-manifest.json'));
console.log('Copied dev manifest');

//* SCSS — compile once on startup
const compileScss = async () => {
  const result = sass.compile(path.join(CONFIG.SRC_DIR, 'scss/index.scss'), { style: 'compressed' });
  await fsp.writeFile(path.join(CONFIG.BUILD_DIR, 'index.css'), result.css);
  console.log('SCSS compiled');

  const notFound = sass.compile(path.join(CONFIG.SRC_DIR, 'scss/not-found.scss'), { style: 'compressed' });
  await fsp.writeFile(path.join(CONFIG.BUILD_DIR, 'not-found.css'), notFound.css);
  console.log('"not-found" SCSS compiled');
};

await compileScss();

const build = await esbuild.build({
  entryPoints: [path.join(CONFIG.SRC_DIR, '/js/scripts.js')],
  bundle: true,
  minify: false,
  // write: false, // replacing asset links with hashed versions before write
  sourcemap: true,
  target: 'es2017',
  outdir: CONFIG.BUILD_DIR,
});

//* Separated into watch script to prevent execution blocking of Dev web server
// await context.watch();
// console.log('esbuild watching for JS changes...');