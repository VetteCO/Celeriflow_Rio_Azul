import assert from "node:assert/strict";
import { test } from "node:test";
import { checkUrbanLimits, inspectionSchema, urbanParameters } from "./territorial";
test("urban allocation rejects impossible footprints and preserves independent total floor area",()=>{
 assert.throws(()=>urbanParameters({areaTerreno:"100",areaProjecao:"80",areaPermeavel:"30"}));
 assert.throws(()=>urbanParameters({areaTerreno:"0"}));
 const result=checkUrbanLimits({areaTerreno:"100",areaConstruida:"300",areaProjecao:"70",areaPermeavel:"20"},{coeficienteMaximo:"2",ocupacaoMaxima:"60"});
 assert.equal(result[0].actual,3);assert.equal(result[0].conforms,false);assert.equal(result[1].conforms,false);assert.equal(result[2].conforms,null);
});
test("inspection operations require bounded GPS and immutable client identifiers",()=>{
 const base={operationId:"1fcac5e4-51ec-44a4-b0c1-826676244dfd",capturedAt:"2026-11-10T18:00:00-03:00",latitude:-18.5,longitude:-43.95,findings:"Imóvel vistoriado."};
 assert.ok(inspectionSchema.safeParse(base).success);
 assert.ok(!inspectionSchema.safeParse({...base,longitude:181}).success);
 assert.ok(!inspectionSchema.safeParse({...base,operationId:"repetido"}).success);
 assert.ok(!inspectionSchema.safeParse({...base,fileIds:["documento-externo"]}).success);
});
