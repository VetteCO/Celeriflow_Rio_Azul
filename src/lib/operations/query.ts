import { AsyncLocalStorage } from 'node:async_hooks';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import { db } from '@/db';
type Rows={rows:Record<string,unknown>[]};
type Executor=(statement:SQL)=>Promise<Rows>;
const scope=new AsyncLocalStorage<Executor>();
export const operationsDb={execute(statement:SQL):Promise<Rows>{return scope.getStore()?.(statement)??db.execute(statement) as Promise<Rows>;}};
export function inSnapshot<T>(query:(text:string,values:unknown[])=>Promise<Rows>,work:()=>Promise<T>){
 const dialect=new PgDialect();return scope.run(statement=>{const compiled=dialect.sqlToQuery(statement);return query(compiled.sql,compiled.params);},work);
}
