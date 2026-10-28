import re
logo=open('logo.b64').read().strip()
s=open('src.html').read()
assert '__FOTOS__' not in s
out=s.replace('__LOGO__',logo)
open('asistente-burke.html','w').write(out)
open('app.js','w').write(re.search(r'<script>(.*)</script>',out,re.S).group(1))
open('gas/Index.html','w').write(out)
d=out.replace('<title>Asistente Burke</title>','<title>Asistente Burke Demo</title>',1)
d=d.replace('render(); initDB();','render();',1)
d=d.replace('<span id="appver">En desarrollo','<span id="appver">Demo · En desarrollo',1)
i=d.index('async function initDB(){'); j=d.index('const h=(location.hash',i); d=d[:i]+d[j:]
assert 'claude.use' not in d and 'initDB()' not in d and 'Demo · En desarrollo' in d
open('Asistente_Burke_demo.html','w').write(d)
open('demo.js','w').write(re.search(r'<script>(.*)</script>',d,re.S).group(1))
print(len(out)//1024,'KB')
