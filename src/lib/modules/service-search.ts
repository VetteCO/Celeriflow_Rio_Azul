export type PublicService = { id: string; family: string; title: string; body: string; code: string; values: Record<string, string> };
const normalize = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const stopwords = new Set("a o as os de da do das dos e em no na nos nas um uma para por com como quero preciso solicitar servico atendimento".split(" "));
// Local vocabulary is the initial retrieval adapter; it does not claim an external AI service.
const vocabulary = [
  ["lixo", "coleta", "residuos", "limpeza"], ["lampada", "iluminacao", "luz", "poste"],
  ["buraco", "pavimentacao", "asfalto", "via"], ["informacao", "esic", "transparencia"],
  ["denuncia", "ouvidoria", "reclamacao"], ["obra", "construcao", "alvara", "projeto"],
  ["arvore", "poda", "vegetacao"], ["tributo", "imposto", "iptu", "taxa"],
];
export function searchServices(services: PublicService[], query: string, category = "", audience = "") {
  const terms = normalize(query).match(/[a-z0-9]+/g)?.filter(t => !stopwords.has(t)) ?? [];
  return services.filter(s => (!category || s.values.categoria === category) && (!audience || s.values.publico === audience)).map(service => {
    const title = normalize(service.title), text = normalize([service.title, service.body, ...Object.values(service.values)].join(" "));
    const score = terms.reduce((total, term) => {
      if (title.includes(term)) return total + 5;
      if (text.includes(term)) return total + 2;
      const group = vocabulary.find(group => group.includes(term));
      return total + (group?.some(synonym => text.includes(synonym)) ? 1 : 0);
    }, 0);
    return { service, score };
  }).filter(result => !terms.length || result.score > 0).sort((a, b) => b.score - a.score || a.service.title.localeCompare(b.service.title, "pt-BR")).map(result => result.service);
}
