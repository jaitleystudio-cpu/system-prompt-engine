import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const handlers={};let matches=[],writes=0,offline=false;
const shell={shell:true},network={ok:true};
const context={self:{location:{origin:'https://spe.test'},addEventListener:(k,f)=>handlers[k]=f},URL,Response,
 caches:{open:async()=>({match:async(req,options)=>{matches.push([req,options]);return req==='/index.html'?shell:undefined;},put:async()=>{writes++;}})},
 fetch:async()=>{if(offline)throw Error('offline');return network;}};
vm.runInNewContext(readFileSync('apps/web/public/sw.js','utf8'),context);
async function dispatch(request){let promise;handlers.fetch({request,respondWith:p=>promise=p});return promise;}
const navigation={url:'https://spe.test/private',mode:'navigate',method:'GET',destination:'document'};
assert.equal(await dispatch(navigation),network);assert.equal(writes,0);
offline=true;assert.equal(await dispatch(navigation),shell);assert.equal(writes,0);
assert.equal(await dispatch({...navigation,method:'POST'}),undefined);
assert.equal(await dispatch({...navigation,url:'https://other.test/'}),undefined);
assert(matches.every(([,options])=>!options?.ignoreVary));
console.log('PASS: fresh navigation, offline shell, no navigation caching, POST/external bypass, Vary respected.');
