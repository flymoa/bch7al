# Packs the Expo web export into one self-contained HTML page.
import base64, glob, json, os, re, sys
src = '/tmp/web'
html = open(f'{src}/index.html').read()
js = open(glob.glob(f'{src}/_expo/static/js/web/entry-*.js')[0]).read()
mime = {'.ttf': 'font/ttf', '.png': 'image/png'}
def data_uri(m):
    path = m.group(1)
    f = os.path.join(src, path.lstrip('/'))
    if not os.path.exists(f): return m.group(0)
    ext = os.path.splitext(f)[1]
    return '"data:%s;base64,%s"' % (mime.get(ext, 'application/octet-stream'), base64.b64encode(open(f,'rb').read()).decode())
# keep only fonts the app uses (Rubik 400/500/600/700, Ionicons) and small router images
keep = re.compile(r'(Rubik_(400Regular|500Medium|600SemiBold|700Bold)\.|Ionicons|MaterialCommunityIcons|expo-router/assets)')
def repl(m):
    return data_uri(m) if keep.search(m.group(1)) else '""'
js = re.sub(r'"(/assets/[^"]+)"', repl, js)
wasm = base64.b64encode(open('/home/claude/bch7al/node_modules/sql.js/dist/sql-wasm.wasm','rb').read()).decode()
boot = ('<script>try{if(location.pathname!=="/")history.replaceState(null,"","/"+location.hash)}catch(e){}'
        'window.__SQL_WASM_B64__=%s;</script>') % json.dumps(wasm)
js_safe = js.replace('</script', '<\\/script')
html = re.sub(r'<script src="[^"]*"[^>]*></script>\s*', '', html)
html = html.replace('<title>', '<title>', 1)
html = re.sub(r'<title>.*?</title>', '<title>bch7al? — aperçu</title>', html)
html = html.replace('</head>', boot + '</head>', 1)
html = html.replace('</body>', '<script>' + js_safe + '</script></body>', 1)
if not html.lstrip().lower().startswith('<!doctype html>'): html = '<!DOCTYPE html>' + html
open('/home/claude/preview/index.html','w').write(html)
print('size MB', round(len(html)/1e6, 2))
