import { reportWorkerOnce } from '../src/lib/operations/report-worker';
async function main(){const index=process.argv.indexOf('--id');const id=index>=0?process.argv[index+1]:undefined;if(index>=0&&!id)throw new Error('Informe o ID após --id.');do{const result=await reportWorkerOnce(id);console.log(JSON.stringify({at:new Date().toISOString(),...result}));if(!process.argv.includes('--watch'))break;await new Promise(resolve=>setTimeout(resolve,5000));}while(true);}
main().catch(e=>{console.error(e instanceof Error?e.message:'Falha do executor');process.exitCode=1;});
