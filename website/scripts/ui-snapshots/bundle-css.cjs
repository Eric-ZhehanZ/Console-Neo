/* eslint-disable */
// Flattens the app's controller/projector stylesheets into public/ui/*.css,
// copying every url() asset into public/ui/assets/. Italic faces are dropped
// (the app never sets italic text) and TrueType fonts become WOFF2 when
// PYTHON points at an interpreter with fontTools + brotli.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function toWoff2(src, dest) {
  execFileSync(process.env.PYTHON, ['-c',
    'import sys; from fontTools.ttLib import TTFont; f = TTFont(sys.argv[1]); f.flavor = "woff2"; f.save(sys.argv[2])',
    src, dest]);
}

const REPO = path.resolve(__dirname, '../../..');
const OUT = path.join(REPO, 'website/public/ui');
fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });

function inline(file, seen = new Set()) {
  if(seen.has(file)) return '';
  seen.add(file);
  const dir = path.dirname(file);
  let css = fs.readFileSync(file, 'utf8');
  css = css.replace(/@font-face\s*{[^}]*font-style:\s*italic[^}]*}\s*/g, '');
  css = css.replace(/url\((['"]?)(?!data:|https?:|\/)([^'")]+)\1\)(\s*format\(['"]truetype['"]\))?/g, (m, q, ref, fmt) => {
    const src = path.resolve(dir, ref.split(/[?#]/)[0]);
    if(/\.ttf$/.test(src) && process.env.PYTHON) {
      const name = path.basename(src).replace(/\.ttf$/, '.woff2');
      const dest = path.join(OUT, 'assets', name);
      if(!fs.existsSync(dest)) toWoff2(src, dest);
      return `url('/ui/assets/${name}') format('woff2')`;
    }
    const name = path.basename(src);
    fs.copyFileSync(src, path.join(OUT, 'assets', name));
    return `url('/ui/assets/${name}')${fmt || ''}`;
  });
  return css.replace(/@import\s+(?:url\()?['"]([^'"]+)['"]\)?\s*;/g,
    (m, ref) => `/* ${path.relative(REPO, path.resolve(dir, ref))} */\n${inline(path.resolve(dir, ref), seen)}`);
}

for(const win of ['controller', 'projector']) {
  const css = inline(path.join(REPO, win, 'style.css'));
  fs.writeFileSync(path.join(OUT, `${win}.css`), css);
  console.log(win, css.length);
}
console.log(fs.readdirSync(path.join(OUT, 'assets')).join(' '));
