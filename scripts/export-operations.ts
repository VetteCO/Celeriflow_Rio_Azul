import { streamExport } from '../src/lib/operations/stream-export';
const directory=process.argv[2];
if(!directory||directory.startsWith('--'))throw new Error('Uso: npx tsx --env-file=.env.local scripts/export-operations.ts <diretório-novo> --authorize-full-export [--with-dump]');
streamExport(directory,process.argv.includes('--with-dump')).catch(e=>{console.error(e instanceof Error?e.message:'Exportação incompleta.');process.exitCode=1;});
