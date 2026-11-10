/** Protected scheduler entrypoint. Same streaming snapshot plus pg_dump for rehearsal. */
import { streamExport } from './stream-export';
const directory=process.argv[2];
if(!directory||directory.startsWith('--'))throw new Error('Informe diretório novo e --authorize-full-export; configure a conta operacional.');
streamExport(directory,true).catch(e=>{console.error(e instanceof Error?e.message:'Backup incompleto.');process.exitCode=1;});
