import esbuild from 'esbuild';
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