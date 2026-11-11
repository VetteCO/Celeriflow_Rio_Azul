import assert from "node:assert/strict";
import { test } from "node:test";
import { restoreRuntime } from "./restore-runtime";
test("isolated restore refuses source databases, remote bridges and deployed runtime",()=>{
 const keys=["DATABASE_URL","RESTORE_SQL_ENDPOINT","RESTORE_DATABASE_NAME","RESTORE_STORAGE_ROOT","VERCEL"];
 const before=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
 try{
  delete process.env.RESTORE_SQL_ENDPOINT;delete process.env.RESTORE_STORAGE_ROOT;
  assert.equal(restoreRuntime(),false);
  Object.assign(process.env,{DATABASE_URL:"postgresql://unit:unit@localhost:55449/rio_restore",RESTORE_SQL_ENDPOINT:`http://127.0.0.1:55450/${"a".repeat(64)}`,RESTORE_DATABASE_NAME:"rio_restore",RESTORE_STORAGE_ROOT:"C:\\IsolatedStorage"});delete process.env.VERCEL;
  assert.equal(restoreRuntime(),true);
  process.env.DATABASE_URL="postgresql://unit:unit@source.example/rio_restore";assert.throws(()=>restoreRuntime());
  process.env.DATABASE_URL="postgresql://unit:unit@localhost:55449/production";assert.throws(()=>restoreRuntime());
  process.env.DATABASE_URL="postgresql://unit:unit@localhost:55449/rio_restore";process.env.VERCEL="1";assert.throws(()=>restoreRuntime());delete process.env.VERCEL;
  process.env.RESTORE_SQL_ENDPOINT=`https://remote.example/${"a".repeat(64)}`;assert.throws(()=>restoreRuntime());
  process.env.RESTORE_SQL_ENDPOINT="http://127.0.0.1:55450/sql";assert.throws(()=>restoreRuntime());
 }finally{for(const key of keys){if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key];}}
});
