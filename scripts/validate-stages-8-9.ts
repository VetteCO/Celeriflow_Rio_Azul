import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve,join } from "node:path";
import { neon } from "@neondatabase/serverless";
async function main(){
 const args=process.argv.slice(2),i=args.indexOf("--base"),base=args[i+1];assert.ok(i>=0&&args.includes("--allow-write")&&(/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)||args.includes("--allow-production")&&base==="https://rioazul.celeriflow.com.br"));
 const dir=join(resolve(process.env.LOCALAPPDATA!,"Temp/opencode"),`stages89-${Date.now()}`);mkdirSync(dir);
 const run=(file:string,flags:string[])=>spawnSync(process.execPath,["--import","tsx","--env-file=.env.local",file,...flags],{stdio:"inherit",env:process.env}).status;
 assert.equal(run("scripts/validate-stages-1-2.ts",["--snapshot","--directory",dir]),0);
 const sql=neon(process.env.DATABASE_URL!),[admin]=await sql("SELECT u.firebase_uid FROM app_user u JOIN user_role ur ON ur.user_id=u.id JOIN role r ON r.id=ur.role_id WHERE u.active AND r.name='ADMIN_GERAL' AND u.firebase_uid IS NOT NULL ORDER BY u.id LIMIT 1");assert.ok(admin);
 const result=run("scripts/validate-integrated.ts",["--allow-write","--base",base,"--admin-uid",admin.firebase_uid,"--intake-department",process.env.DEFAULT_INTAKE_DEPARTMENT_ID!,"--stages89","--directory",dir]);
 const preserved=run("scripts/validate-stages-1-2.ts",["--verify-preserved","--directory",dir]);
 const all=[...JSON.parse(readFileSync(join(dir,"results.redacted.json"),"utf8")).evidence,...JSON.parse(readFileSync(join(dir,"results.json"),"utf8")).results];
 writeFileSync(join(dir,"acceptance.json"),JSON.stringify({complete:result===0&&preserved===0,base,at:new Date().toISOString(),results:all},null,2));console.log(JSON.stringify({directory:dir,passed:all.filter(r=>r.outcome==="PASS").length,failed:all.filter(r=>r.outcome==="FAIL").length,preserved:preserved===0}));process.exitCode=result===0&&preserved===0?0:1;
}void main().catch(()=>{console.error("Stages 8/9 interrupted; inspect private evidence.");process.exitCode=1;});
