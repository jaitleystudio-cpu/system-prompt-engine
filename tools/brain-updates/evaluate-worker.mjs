// Deliberately receives raw requests only, not test cases or expected fields.
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const requests=JSON.parse(readFileSync(0,'utf8'));
if(!Array.isArray(requests)||!requests.length||requests.length>500||requests.some(x=>typeof x!=='string'||x.length>10000))throw new Error('Invalid raw requests');
const {parseCustomSentence}=await import(pathToFileURL(process.argv[2]).href);
process.stdout.write(JSON.stringify(requests.map(input=>parseCustomSentence(input))));
