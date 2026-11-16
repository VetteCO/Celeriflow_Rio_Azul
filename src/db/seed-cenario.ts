// Cenário do ensaio (fictício, realista) — popula todas as tabelas de movimento.
// Idempotente por verificações: pula o que já existe (e-mail, protocolo, número).
import { config } from "dotenv";
config({ path: ".env.local" });

import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import { createDocumentWithNumber, formatNumber, nextProtocolNumber } from "../lib/numbering";
import { processInbound } from "../lib/inbound";
import { uploadAttachment } from "../lib/blob";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });
const year = new Date().getFullYear();
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600 * 1000);

async function userByEmail(email: string) {
  return (await db.select().from(schema.appUser).where(eq(schema.appUser.email, email)))[0];
}

async function audit(action: string, entityType: string, entityId: string | null, metadata: unknown) {
  await db.insert(schema.auditLog).values({
    actorType: "SYSTEM",
    actorId: null,
    action,
    entityType,
    entityId,
    metadata: metadata as Record<string, unknown>,
  });
}

async function main() {
  const depts = await db.select().from(schema.department);
  const dept = (ac: string) => depts.find((d) => d.acronym === ac)!;
  const joao = await userByEmail("joaodasilva@email.com");
  const maria = await userByEmail("mariaoliveira@email.com");
  const carlos = await userByEmail("carlossouza@email.com");
  if (!joao || !maria || !carlos)
    throw new Error("rode admin:bootstrap antes (elenco ausente)");

  // 1. MEMORANDO ADM → CPL com 2 prazos, anexo e tramitação completa
  const memExists = await db
    .select()
    .from(schema.document)
    .then((r) => r.find((d) => d.type === "MEMORANDUM" && d.subject.includes("material de escritório")));
  if (!memExists) {
    const mem = await createDocumentWithNumber({
      type: "MEMORANDUM",
      subject: "Aquisição de material de escritório",
      body: "<p>Solicito a aquisição de <b>material de escritório</b> para o setor administrativo, conforme lista anexa.</p>",
      originDepartmentId: dept("ADM").id,
      createdById: joao.id,
    });
    await db.insert(schema.documentDeadline).values([
      { documentId: mem.id, title: "Enviar lista de itens", dueAt: hoursAgo(-48), status: "PENDING" },
      { documentId: mem.id, title: "Concluir compra", dueAt: hoursAgo(-168), status: "PENDING" },
    ]);
    await db.insert(schema.documentRecipient).values({
      documentId: mem.id,
      departmentId: dept("CPL").id,
      userId: maria.id,
      recipientType: "TO",
    });
    await db.insert(schema.documentMovement).values([
      { documentId: mem.id, fromDepartmentId: dept("ADM").id, toDepartmentId: dept("CPL").id, action: "CREATED", note: null, actorUserId: joao.id, createdAt: hoursAgo(26) },
      { documentId: mem.id, fromDepartmentId: dept("ADM").id, toDepartmentId: dept("CPL").id, action: "FORWARDED", note: "Segue para providências de compra.", actorUserId: joao.id, createdAt: hoursAgo(25) },
      { documentId: mem.id, fromDepartmentId: dept("ADM").id, toDepartmentId: null, action: "RECEIVED", note: null, actorUserId: maria.id, createdAt: hoursAgo(24) },
    ]);
    await db.update(schema.document).set({ status: "OPEN" }).where(eq(schema.document.id, mem.id));
    try {
      const content = Buffer.from("Lista de materiais de escritório: papel A4, canetas, pastas.", "utf-8");
      const url = await uploadAttachment("lista-materiais.txt", content);
      await db.insert(schema.attachment).values({
        documentId: mem.id,
        filename: "lista-materiais.txt",
        mimeType: "text/plain",
        storageKey: url,
        size: content.length,
      });
    } catch {
      console.log("WARN anexo Blob pulado (token?)");
    }
    await audit("DOCUMENT_CREATED", "document", mem.id, {
      displayNumber: formatNumber(mem.type, mem.number, mem.year),
      seeded: true,
    });
    console.log("OK", formatNumber(mem.type, mem.number, mem.year));
  }

  // 2. OFÍCIO ADM → JUR
  const ofiExists = await db
    .select()
    .from(schema.document)
    .then((r) => r.find((d) => d.type === "OFICIO"));
  if (!ofiExists) {
    const ofi = await createDocumentWithNumber({
      type: "OFICIO",
      subject: "Encaminhamento de minuta de contrato",
      body: "<p>Encaminho a minuta de contrato para análise e parecer jurídico.</p>",
      originDepartmentId: dept("ADM").id,
      createdById: joao.id,
    });
    await db.insert(schema.documentMovement).values([
      { documentId: ofi.id, fromDepartmentId: dept("ADM").id, toDepartmentId: dept("JUR").id, action: "CREATED", note: null, actorUserId: joao.id, createdAt: hoursAgo(20) },
      { documentId: ofi.id, fromDepartmentId: dept("ADM").id, toDepartmentId: dept("JUR").id, action: "FORWARDED", note: "Para parecer.", actorUserId: joao.id, createdAt: hoursAgo(19) },
    ]);
    await db.update(schema.document).set({ status: "IN_TRANSIT" }).where(eq(schema.document.id, ofi.id));
    await audit("DOCUMENT_CREATED", "document", ofi.id, {
      displayNumber: formatNumber(ofi.type, ofi.number, ofi.year),
      seeded: true,
    });
    console.log("OK", formatNumber(ofi.type, ofi.number, ofi.year));
  }

  // 3. CIRCULAR informativa p/ 5 setores; João e Maria já leram
  const cirExists = await db
    .select()
    .from(schema.document)
    .then((r) => r.find((d) => d.type === "CIRCULAR" && d.subject.includes("feriado")));
  if (!cirExists) {
    const cir = await createDocumentWithNumber({
      type: "CIRCULAR",
      subject: "Horário de atendimento no feriado",
      body: "<p>Informamos o horário especial de atendimento ao público no próximo feriado municipal.</p>",
      originDepartmentId: dept("ADM").id,
      createdById: joao.id,
    });
    await db.update(schema.document).set({ urgency: "INFORMATIVE" }).where(eq(schema.document.id, cir.id));
    const users = await db.select().from(schema.appUser);
    for (const d of depts) {
      await db.insert(schema.documentRecipient).values({
        documentId: cir.id,
        departmentId: d.id,
        userId: null,
        recipientType: "TO",
      });
    }
    for (const u of users.filter((x) => x.active && x.departmentId)) {
      await db.insert(schema.documentRecipient).values({
        documentId: cir.id,
        departmentId: u.departmentId,
        userId: u.id,
        recipientType: "TO",
      });
    }
    await db.insert(schema.documentMovement).values({
      documentId: cir.id,
      fromDepartmentId: dept("ADM").id,
      toDepartmentId: null,
      action: "CREATED",
      note: "Circular Informativa para 5 setor(es)",
      actorUserId: joao.id,
      createdAt: hoursAgo(10),
    });
    // Leituras já ocorridas (passado = imutáveis e realistas)
    await db.insert(schema.documentReadReceipt).values([
      { documentId: cir.id, userId: joao.id, firstReadAt: hoursAgo(9) },
      { documentId: cir.id, userId: maria.id, firstReadAt: hoursAgo(8) },
    ]);
    await audit("CIRCULAR_CREATED", "document", cir.id, {
      displayNumber: formatNumber(cir.type, cir.number, cir.year),
      seeded: true,
    });
    console.log("OK", formatNumber(cir.type, cir.number, cir.year));
  }

  // 4. CIDADÃO Ricardo Almeida + protocolo + ciclo de e-mail completo
  let ricardo = (
    await db.select().from(schema.citizen).where(eq(schema.citizen.cpfCnpj, "11144477735"))
  )[0];
  if (!ricardo) {
    const ins = await db
      .insert(schema.citizen)
      .values({
        name: "Ricardo Almeida",
        cpfCnpj: "11144477735",
        email: "ricardoalmeida@email.com",
        phone: "(41) 98888-1234",
        cep: "80010180",
        street: "Rua Barão do Rio Branco",
        number: "250",
        complement: "apto 12",
        district: "Centro",
        city: "Curitiba",
        state: "PR",
      })
      .returning();
    ricardo = ins[0]!;
  }
  const existingProtocol = (
    await db
      .select()
      .from(schema.externalRequest)
      .where(eq(schema.externalRequest.citizenId, ricardo.id))
  )[0];
  if (!existingProtocol) {
    const doc = await createDocumentWithNumber({
      type: "EXTERNAL_REQUEST",
      subject: "Solicitação de serviço — Ricardo Almeida",
      body: "Solicito a poda da árvore em frente ao meu endereço, pois os galhos alcançam a fiação.",
      originDepartmentId: null,
      createdById: null,
    });
    const publicKey = doc.publicKey;
    const replyToken = nanoid(21);
    const protocol = await nextProtocolNumber();
    const ers = await db
      .insert(schema.externalRequest)
      .values({
        citizenId: ricardo.id,
        documentId: doc.id,
        protocolNumber: protocol,
        publicKey,
        requestType: "Solicitação de serviço",
      })
      .returning();
    await db.insert(schema.documentMovement).values({
      documentId: doc.id,
      fromDepartmentId: null,
      toDepartmentId: null,
      action: "CREATED",
      note: `Requerimento ${protocol} aberto pelo portal do cidadão`,
      actorUserId: null,
      createdAt: hoursAgo(6),
    });
    await db.insert(schema.emailMessage).values({
      documentId: doc.id,
      direction: "OUTBOUND",
      providerMessageId: null,
      from: "pendente@configurar",
      to: ricardo.email,
      subject: `Protocolo ${protocol} recebido`,
      bodyText: `Protocolo ${protocol}. Chave: ${publicKey}`,
      bodyHtml: null,
      replyToken,
      status: "PENDING",
      sentAt: null,
      receivedAt: null,
    });
    // Resposta do cidadão (mesmo código do webhook real)
    await processInbound({
      to: `processo+${replyToken}@respostas.demo`,
      from: ricardo.email,
      subject: `Re: Protocolo ${protocol}`,
      text: "Segue foto do local para análise da equipe.\n\n> Protocolo recebido (citado, ignorado).",
      messageId: `seed-${protocol}@demo`,
    });
    await audit("EXTERNAL_REQUEST_CREATED", "external_request", ers[0]!.id, {
      protocol,
      seeded: true,
    });
    console.log("OK protocolo", protocol);
  }

  // Garante anexo no memorando (tenta de novo se a primeira vez falhou no Blob)
  const memDoc = await db
    .select()
    .from(schema.document)
    .then((r) => r.find((d) => d.type === "MEMORANDUM" && d.subject.includes("material de escritório")));
  if (memDoc) {
    const has = await db
      .select()
      .from(schema.attachment)
      .where(eq(schema.attachment.documentId, memDoc.id));
    if (has.length === 0) {
      try {
        const url = await uploadAttachment(
          "lista-materiais.txt",
          Buffer.from("Lista de materiais de escritório (demonstração): papel A4, canetas, pastas.", "utf-8")
        );
        await db.insert(schema.attachment).values({
          documentId: memDoc.id,
          filename: "lista-materiais.txt",
          mimeType: "text/plain",
          storageKey: url,
          size: 76,
        });
        console.log("OK anexo lista-materiais.txt");
      } catch {
        console.log("WARN anexo Blob pulado (loja privada? veja src/lib/blob.ts)");
      }
    }
  }

  const counts = {
    users: (await db.select().from(schema.appUser)).length,
    citizens: (await db.select().from(schema.citizen)).length,
    documents: (await db.select().from(schema.document)).length,
    movements: (await db.select().from(schema.documentMovement)).length,
    receipts: (await db.select().from(schema.documentReadReceipt)).length,
    emails: (await db.select().from(schema.emailMessage)).length,
  };
  console.log("CENARIO_OK " + JSON.stringify(counts));
}

main().catch((e) => {
  console.error("CENARIO_FAIL " + (e as Error).message);
  process.exit(1);
});
