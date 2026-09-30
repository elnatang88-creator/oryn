import sys
import os
S=os.path.dirname(os.path.abspath(__file__))+'/'
url=sys.argv[1] if len(sys.argv)>1 else ''
s=open(S+'src.html').read()
s=s.replace("/*QR_LIB*/", open(S+'qr.js').read().replace('</script','<\\/script')).replace("'/*PUBLIC_URL*/'", repr(url))
open(S+'index.html','w').write(s)
open(S+'preview.html','w').write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>body{margin:0}</style></head><body>'+s+'</body></html>')
print('built', len(s))
