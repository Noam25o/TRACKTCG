import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {cspRuntime} from './csp-runtime.mjs';
import {brotliCompressSync,gzipSync,constants} from 'node:zlib';
const root=new URL('./',import.meta.url),out=new URL('dist/',root);mkdirSync(out,{recursive:true});
const runtime=readFileSync(new URL('../node_modules/@techstark/opencv-js/dist/opencv.js',root));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
if(sha(runtime)!=='bd0c3e6448043de04f6a64a12cb7b759f78c3ab8f7c35c9f2e0f71c88bb17103')throw Error('Runtime OpenCV inattendu');
const raw=readFileSync(new URL('../visual/data/index.json',root)),index=JSON.parse(raw);
const manifest={cacheVersion:1,createdAt:new Date().toISOString(),runtime:'OpenCV.js 4.12.0 via @techstark/opencv-js 4.12.0-release.1',runtimeBytes:runtime.length,runtimeSha256:sha(runtime),indexSha256:sha(raw),languages:{},assets:{}};
function asset(name,bytes){
  bytes=Buffer.from(bytes);const hash=sha(bytes),dot=name.lastIndexOf('.'),file=name.slice(0,dot)+'.'+hash+name.slice(dot);
  const br=brotliCompressSync(bytes,{params:{[constants.BROTLI_PARAM_QUALITY]:5}}),gz=gzipSync(bytes,{level:6});
  writeFileSync(new URL(file,out),bytes);writeFileSync(new URL(file+'.br',out),br);writeFileSync(new URL(file+'.gz',out),gz);
  return {file,bytes:bytes.length,sha256:hash,brBytes:br.length,gzipBytes:gz.length};
}
const prepared=await cspRuntime(runtime.toString('utf8')),patched=Buffer.from(prepared.source);manifest.deliveredRuntimeSha256=sha(patched);manifest.deliveredRuntimeBytes=patched.length;manifest.factoryCount=prepared.factoryCount;manifest.runtimePatch='Emscripten wrapper factories precompiled at build time; no unsafe-eval';
for(const language of ['FR','EN','JP']){
  const entries=index.entries.filter(e=>e.card.language===language).map(e=>({...e,card:{id:e.card.id,name:e.card.name,number:e.card.number,setName:e.card.setName,setCode:e.card.setCode,language}}));
  const bytes=Buffer.from(JSON.stringify({format:index.format,entries}));writeFileSync(new URL(`index-${language}.json`,out),bytes);manifest.languages[language]={count:entries.length,...asset(`index-${language}.json`,bytes)};
}
for(const name of ['index.html','style.css','app.js','framing.js','loading.js','worker.js','engine.js','asset-cache.js'])copyFileSync(new URL(name,root),new URL(name,out));
manifest.assets.runtime=asset('opencv.js',patched);
manifest.assets.engine=asset('engine.js',readFileSync(new URL('engine.js',root)));
manifest.assets.cache=asset('asset-cache.js',readFileSync(new URL('asset-cache.js',root)));
const imports=[manifest.assets.runtime,manifest.assets.engine,manifest.assets.cache].map(a=>JSON.stringify('./'+a.file)).join(',');
const worker=readFileSync(new URL('worker.js',root),'utf8').replace("importScripts('./opencv.js','./engine.js','./asset-cache.js');",`importScripts(${imports});`);
manifest.assets.worker=asset('worker.js',worker);
writeFileSync(new URL('opencv.js',out),patched);mkdirSync(new URL('../.tools/browser-cv/',root),{recursive:true});writeFileSync(new URL('../.tools/browser-cv/opencv.cjs',root),patched);copyFileSync(new URL('../node_modules/@techstark/opencv-js/LICENSE',root),new URL('OpenCV-LICENSE.txt',out));
writeFileSync(new URL('manifest.json',out),JSON.stringify(manifest,null,2));console.log(JSON.stringify(manifest,null,2));
