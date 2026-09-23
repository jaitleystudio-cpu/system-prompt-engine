import {build} from '../apps/web/node_modules/esbuild/lib/main.js';
import assert from 'node:assert/strict';
class TestWorker extends EventTarget {
 static latest; constructor(){super();TestWorker.latest=this;}
 postMessage(message){this.message=message;}
 terminate(){}
}
globalThis.Worker=TestWorker;
const b=await build({entryPoints:['apps/web/src/engine/client.ts'],bundle:true,write:false,format:'esm',platform:'node',define:{'import.meta.url':JSON.stringify(new URL('../apps/web/src/engine/client.ts',import.meta.url).href)}});
const {EngineClient}=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));
const client=new EngineClient(); const promise=client.compile('{}',()=>{}); const worker=TestWorker.latest;
worker.dispatchEvent(new Event('messageerror'));
await assert.rejects(promise,/unreadable/);
const phases=[];const next=client.compile('{}',p=>phases.push(p)); const id=worker.message.id;
worker.dispatchEvent(new MessageEvent('message',{data:{id:'unrelated',type:'status',phase:'done'}}));
worker.dispatchEvent(new MessageEvent('message',{data:{id,type:'status',phase:'evaluating'}}));
worker.dispatchEvent(new MessageEvent('message',{data:{id,type:'done',error:null,result:{status:'VALID'},phases:['evaluating'],sha256:'test',imports:0}}));
assert.equal((await next).result.status,'VALID');assert.deepEqual(phases,['evaluating']);
console.log('PASS: worker message errors reject promptly; request IDs isolate results and phase notifications.');
const realSetTimeout=globalThis.setTimeout, realClearTimeout=globalThis.clearTimeout;
const callbacks=new Map();let timerId=0;
globalThis.setTimeout=(fn)=>{callbacks.set(++timerId,fn);return timerId;};
globalThis.clearTimeout=(id)=>callbacks.delete(id);
try {
 const timed=new EngineClient(); let terminated=false;TestWorker.latest.terminate=()=>{terminated=true;};
 const first=assert.rejects(timed.compile('{}',()=>{}),/WORKER_TIMEOUT/);
 const second=assert.rejects(timed.compile('{}',()=>{}),/WORKER_TIMEOUT/);
 [...callbacks.values()][0]();
 await Promise.all([first,second]);
 assert(terminated);assert.equal(callbacks.size,0);
 await assert.rejects(timed.compile('{}',()=>{}),/ENGINE_UNAVAILABLE/);
 console.log('PASS: timeout terminates worker, rejects all pending requests and blocks reuse.');
} finally {globalThis.setTimeout=realSetTimeout;globalThis.clearTimeout=realClearTimeout;}
