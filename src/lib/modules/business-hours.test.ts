import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateBusinessDeadline, hoursSchema, type Shift } from "./business-hours";

const shifts: Shift[] = [1,2,3,4,5].flatMap(day=>[{day,start:"08:00",end:"12:00"},{day,start:"13:00",end:"17:00"}]);
test("SLA útil preserva intervalo, minutos e segundos", () => {
  assert.equal(calculateBusinessDeadline(new Date("2026-11-13T11:30:15-03:00"), 2, shifts, new Set()), "2026-11-13T17:30:15.000Z");
  assert.equal(calculateBusinessDeadline(new Date("2026-11-13T12:30:00-03:00"), .25, shifts, new Set()), "2026-11-13T16:15:00.000Z");
});
test("SLA útil atravessa fim de semana, feriado e virada do ano", () => {
  assert.equal(calculateBusinessDeadline(new Date("2026-11-13T16:30:00-03:00"), 2, shifts, new Set()), "2026-11-16T12:30:00.000Z");
  assert.equal(calculateBusinessDeadline(new Date("2026-11-13T16:30:00-03:00"), 2, shifts, new Set(["2026-11-16"])), "2026-11-17T12:30:00.000Z");
  assert.equal(calculateBusinessDeadline(new Date("2026-12-31T16:30:00-03:00"), 2, shifts, new Set(["2027-01-01"])), "2027-01-04T12:30:00.000Z");
});
test("Expediente recusa turnos sobrepostos e prazos inválidos", () => {
  const input={departmentId:"11111111-1111-4111-8111-111111111111",revision:0,active:true,note:"Expediente municipal",shifts:[{day:1,start:"08:00",end:"12:00"},{day:1,start:"11:00",end:"17:00"}]};
  assert.equal(hoursSchema.safeParse(input).success,false);
  assert.throws(()=>calculateBusinessDeadline(new Date(),0,shifts,new Set()),/inválido/);
});
