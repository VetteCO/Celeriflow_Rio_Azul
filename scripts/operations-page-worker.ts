import { measurePages } from '../src/lib/operations/page-worker';
measurePages().catch(e=>{console.error(e instanceof Error?e.message:'Falha ao medir PDFs');process.exitCode=1;});
