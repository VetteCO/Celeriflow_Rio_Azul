# Componentes compartilhados

## Tabelas operacionais

Use `DataTable` de `@/components/DataTable` nas páginas de listagem.

```tsx
<DataTable
  id="servidores"
  title="Servidores"
  rows={users}
  rowKey={(user) => user.id}
  columns={[
    { key: "name", label: "Nome", value: (user) => user.name, minWidth: 120 },
    { key: "email", label: "E-mail", value: (user) => user.email, minWidth: 150 },
  ]}
  actions={<button onClick={openForm}>Novo servidor</button>}
/>
```

- Paginação fixa em 20, busca e ordenação antes da paginação; valores usados em filtros ficam em `value`.
- `render` permite links, estados e ações, sem empilhar campos independentes na célula.
- `rows` deve conter o conjunto autorizado completo quando a consulta usa paginação local. Não passar somente os primeiros 100 resultados e apresentar como total.
- `loading` e `error` preservam a estrutura.
- Para paginação no servidor, informar `pagination={{page,total,onPageChange}}`, `onSearch` e `onSort`. Nesse modo, a API aplica busca e ordenação ao conjunto autorizado antes de retornar os 20 registros; a grade não filtra nem recorta novamente o lote. Cancelar/ignorar respostas antigas no consumidor.
- Usar `filters` para filtros adicionais acessíveis pelo botão compacto na faixa de consulta; a sobreposição preserva a altura da grade. Ações de criação/exportação permanecem em `actions`.
- Colunas usam `key`, `label`, `value`, `render?`, `width?`, `minWidth?` e `align?`.
- Preferências de largura são locais, por usuário/tabela, sem armazenar dados dos registros.
- A exceção de rolagem usa identificação conservadora de Android/iOS/iPadOS; largura da janela não é identificação do dispositivo.
- Dimensões abaixo dos mínimos declarados produzem aviso de incompatibilidade, não aprovação de encaixe. A comprovação geométrica será feita no fechamento.
- Listagens devem renderizar a grade como região principal, com formulários abertos em rota própria ou diálogo. Evitar títulos, cartões e formulários acima da grade.

## Campos com máscara

Use `MaskedInput` de `@/components/MaskedInput` com `kind` e `onValueChange`. O valor entregue ao formulário é formatado; o backend deve normalizar e validar o domínio.

| kind | Exibição |
|---|---|
| cpf | 000.000.000-00 |
| cnpj | 00.000.000/0000-00 |
| cpfCnpj | Formato correspondente à quantidade de dígitos |
| cep | 00000-000 |
| phone | (00) 0000-0000 ou (00) 00000-0000 |
| currency | R$ 0,00 |

Uma máscara não substitui validação. Valores monetários devem ser normalizados sem conversão ambígua de separadores e persistidos como centavos inteiros ou decimal exato.

## Migrações

`npm run db:migrate` lista as migrações SQL disponíveis; `npm run db:migrate -- --apply` aplica em ordem, com transação por arquivo, trava de execução e checksum. Node.js 22 ou superior é necessário para o transporte WebSocket. É obrigatória `DIRECT_URL` sem pooling transacional.

Em banco preexistente sem histórico deste executor, revisar previamente o schema e os SQLs incrementais. A primeira aplicação exige `--existing-schema`; a opção autoriza aplicar os incrementos revisados, não registra arquivos antigos como se já tivessem sido executados. O histórico inteiro é verificado antes de qualquer pendência ser aplicada.

`db:generate` continua gerando artefatos Drizzle em `drizzle/`. Revisar e incorporar o SQL aplicável como novo arquivo imutável em `src/db/migrations/` antes de usar este executor; não alternar executores/históricos para aplicar o mesmo incremento.

As migrações SQL não devem conter `BEGIN`/`COMMIT` próprios: o executor controla a transação. Uma migração aplicada não deve ser editada; adicionar nova migração corretiva. Não usar alteração destrutiva automática de schema para instalar módulos sobre dados existentes.
