// Development preview only. Production output is the static dist/ directory.
import http from 'node:http';
import {readFileSync} from 'node:fs';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const files=new Map([['/','index.html'],...['index.html','style.css','app.js','framing.js','loading.js','worker.js','engine.js','asset-cache.js','opencv.js','manifest.json','OpenCV-LICENSE.txt','index-FR.json','index-EN.json','index-JP.json'].map(n=>['/'+n,n])]);
const types={html:'text/html; charset=utf-8',css:'text/css',js:'text/javascript',json:'application/json',txt:'text/plain'};
export function encodingFor(header=''){
  const values=new Map(header.toLowerCase().split(',').map(part=>{const [name,...params]=part.trim().split(';');const q=params.find(v=>v.trim().startsWith('q='));return [name,q?Number(q.trim().slice(2)):1];}));
  return ['br','gzip'].map(name=>({name,q:values.get(name)??values.get('*')??0})).filter(v=>v.q>0&&v.q<=1).sort((a,b)=>b.q-a.q)[0]?.name||null;
}
function builtAsset(path){
  if(!/^\/(?:index-(?:FR|EN|JP)|opencv|engine|worker|asset-cache)\.[a-f0-9]{64}\.(?:js|json)$/.test(path))return null;
  const manifest=JSON.parse(readFileSync(new URL('dist/manifest.json',import.meta.url)));
  return [...Object.values(manifest.assets||{}),...Object.values(manifest.languages||{})].find(a=>'/'+a.file===path)||null;
}
export function createPhoneServer({token=randomBytes(24).toString('hex')}={}){
  const equal=value=>{const a=Buffer.from(value||''),b=Buffer.from(token);return a.length===b.length&&timingSafeEqual(a,b);};
  const server=http.createServer((req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Permissions-Policy','camera=(self), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' blob:; media-src 'self' blob:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    const end=(status,text)=>{res.setHeader('Cache-Control','no-store');res.writeHead(status,{'Content-Type':'text/plain'});res.end(text);};
    try{
      const host=(req.headers.host||'').split(':')[0];
      if(!['localhost','127.0.0.1'].includes(host)&&!/^[a-z0-9-]+\.trycloudflare\.com$/.test(host))return end(403,'Host interdit');
      if(req.method!=='GET'&&req.method!=='HEAD')return end(405,'Aucun upload accepté');
      const url=new URL(req.url,'http://localhost');
      if(url.pathname==='/'&&equal(url.searchParams.get('access'))){res.writeHead(303,{Location:'/', 'Set-Cookie':`phone_access=${token}; HttpOnly; SameSite=Lax; Path=/${host.endsWith('.trycloudflare.com')?'; Secure':''}`});res.end();return;}
      const cookie=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('phone_access='))?.slice(13);
      if(!equal(cookie))return end(401,'Lien de test requis');
      const asset=builtAsset(url.pathname),file=asset?.file||files.get(url.pathname);if(!file)return end(404,'Introuvable');
      const encoding=asset?encodingFor(req.headers['accept-encoding']):null;
      const suffix=encoding==='br'?'.br':encoding==='gzip'?'.gz':'';
      if(asset){
        res.setHeader('Vary','Accept-Encoding');
        // Private browser cache for code; reference persistence is explicitly
        // managed and verified by asset-cache.js. Never cache auth or HTML.
        res.setHeader('Cache-Control',file.endsWith('.js')?'private, max-age=31536000, immutable':'private, no-store');
        const etag=`"${asset.sha256}-${encoding||'identity'}"`;res.setHeader('ETag',etag);
        if(req.headers['if-none-match']===etag&&file.endsWith('.js')){res.writeHead(304);res.end();return;}
      }
      const bytes=readFileSync(new URL(`dist/${file}${suffix}`,import.meta.url));
      if(encoding)res.setHeader('Content-Encoding',encoding);
      res.writeHead(200,{'Content-Type':types[file.split('.').at(-1)],'Content-Length':bytes.length});res.end(req.method==='HEAD'?undefined:bytes);
    }catch{return end(503,'Construire le labo avec npm run phone:build');}
  });return {server,token};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
  const {server,token}=createPhoneServer();server.listen(8791,'127.0.0.1',()=>console.log(`Labo statique : http://localhost:8791/?access=${token}`));
}
