#!/usr/bin/env python3
"""Inline the stylesheet, modules and discovery scripts into one self-contained page."""
import json, os, re, sys
ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src'); SCR = os.path.join(ROOT, 'scripts'); OUT = os.path.join(ROOT, 'docs', 'index.html')  # GitHub Pages serves /docs
MODULES = ['kb.js', 'engine.js', 'demo.js', '__SCRIPTS__', 'ui_core.js', 'ui_input.js', 'ui_auto.js', 'ui_results.js', 'ui_validate.js']

def read(p):
    with open(p, encoding='utf-8') as f:
        return f.read()

def safe_js(code, name):
    if re.search(r'</script', code, re.I) or '<!--' in code:
        sys.exit('unsafe sequence in ' + name)
    return code

scripts = {fn: read(os.path.join(SCR, fn)) for fn in sorted(os.listdir(SCR))}
scripts_js = 'window.FMA_SCRIPTS = ' + json.dumps(scripts, ensure_ascii=True).replace('</', '<\\/') + ';'
parts = []
for m in MODULES:
    if m == '__SCRIPTS__':
        parts.append('/* ---- discovery scripts (' + str(len(scripts)) + ' files) ---- */\n' + scripts_js)
    else:
        parts.append('/* ---- ' + m + ' ---- */\n' + safe_js(read(os.path.join(SRC, m)), m))
parts.append('window.FMA_APP.start();')
css = read(os.path.join(SRC, 'styles.css'))
if '</style' in css.lower():
    sys.exit('unsafe sequence in css')
html = read(os.path.join(SRC, 'index.template.html')).replace('/*__CSS__*/', css).replace('/*__JS__*/', '\n'.join(parts))
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'w', encoding='utf-8') as f:
    f.write(html)
open(os.path.join(os.path.dirname(OUT), '.nojekyll'), 'w').close()  # GitHub Pages: serve files as-is
print('wrote', OUT, len(html.encode('utf-8')), 'bytes;', len(scripts), 'scripts')
