import { generatePreviousMonthReport } from "../src/lib/operations/scheduled";

generatePreviousMonthReport().then(result => console.log(JSON.stringify(result))).catch(error => {
  console.error(error instanceof Error ? error.message : "Falha no relatório contratual.");
  process.exitCode = 1;
});
