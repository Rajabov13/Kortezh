// Сборка игры в один файл: исходники из src/ + three.js → site/index.html
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const order = ['base', 'cars', 'data', 'carvis', 'world', 'actors', 'sys', 'ui', 'game'];
const code = order.map(f => fs.readFileSync(path.join(root, 'src', f + '.js'), 'utf8')).join('\n');
fs.mkdirSync(path.join(root, '.build'), { recursive: true });
const entry = path.join(root, '.build', 'entry.js');
fs.writeFileSync(entry, code);

const out = await build({ entryPoints: [entry], bundle: true, format: 'iife', minify: true, target: 'es2020', write: false, logLevel: 'warning', absWorkingDir: root });
const js = out.outputFiles[0].text.replace(/<\/script/g, '<\\/script');

const meta = `<meta name="theme-color" content="#06090f">
<meta name="description" content="КОРТЕЖ: Успей на работу — браузерная 3D-игра о кортеже госчиновника.">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="manifest" href="manifest.webmanifest">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
`;
const head = fs.readFileSync(path.join(root, 'src', 'head.html'), 'utf8').replace('<canvas id="gl"', '</head><body>\n<canvas id="gl"');
const html = '<!doctype html>\n<html lang="ru"><head><meta charset="utf-8">\n' + meta +
  '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' + head +
  '<script>' + js + '</script>\n</body></html>\n';
fs.writeFileSync(path.join(root, 'site', 'index.html'), html);
console.log('site/index.html', (html.length / 1024).toFixed(0), 'KB');
