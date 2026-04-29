import esbuild from 'esbuild';
import chokidar from 'chokidar';
import fsp from 'fs/promises';
import path from 'path';

const CONFIG = {
  SRC_DIR: 'src',
  BUILD_DIR: 'dist',
};

const ctx = await esbuild.context({
  entryPoints: [path.join(CONFIG.SRC_DIR, 'js/scripts.js')],
  bundle: true,
  minify: false,
  sourcemap: true,
  target: 'es2017',
  outdir: CONFIG.BUILD_DIR,
});

await ctx.watch();
console.log('esbuild is watching for JS changes...');

const htmlFiles = [
  // 'index.html.tmpl',
  'index.html',
  'pages/offense.html',
  'pages/defense.html',
  'pages/more.html',
  '404.html'
];

chokidar.watch(htmlFiles.map(f => path.join(CONFIG.SRC_DIR, f))).on('change', async (filePath) => {
  const relPath = path.relative(CONFIG.SRC_DIR, filePath);
  const destPath = path.join(CONFIG.BUILD_DIR, relPath);
  await fsp.mkdir(path.dirname(destPath), { recursive: true });
  await fsp.copyFile(filePath, destPath);
  // console.log(`Copied ${relPath} changes to dist`);
});

console.log('chokidar is watching for HTML changes...');