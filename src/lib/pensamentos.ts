// Pensamento do dia no Início (um por dia, igual para o time todo). Frases curtas, sem autor.
const PENSAMENTOS = [
  "A consistência vence o talento quando o talento não é consistente.",
  "Feito e publicado vale mais do que perfeito e na gaveta.",
  "Cliente bem informado é cliente tranquilo.",
  "Uma boa pauta economiza três rodadas de ajuste.",
  "Prazo combinado é promessa feita.",
  "Criatividade também é disciplina: aparecer todo dia.",
  "O que não está no Bastidor não está combinado.",
  "Menos retrabalho, mais tempo para ideias boas.",
  "Cada post é a marca do cliente falando. Capricha na voz.",
  "Pergunte antes, ajuste menos.",
  "Organização é o que deixa a criatividade respirar.",
  "Um briefing claro é metade do trabalho pronto.",
  "Antes de entregar, leia como se fosse o cliente.",
  "Pequenas entregas diárias constroem grandes resultados.",
  "Feedback é presente: abra com calma.",
  "Quem cuida do detalhe cuida da marca.",
  "Comece pelo mais difícil enquanto a energia está alta.",
  "Boa comunicação evita a maioria dos incêndios.",
  "Resultado do cliente é o nosso melhor portfólio.",
  "Fazer bem feito da primeira vez é o atalho mais rápido.",
  "Um time que se ajuda entrega mais.",
  "Ideia boa é a que sai do papel.",
  "Clareza no pedido, clareza na entrega.",
  "Hoje é um ótimo dia para surpreender um cliente.",
  "Simples bem feito ganha de complicado mal feito.",
  "Avise cedo, não justifique tarde.",
  "Referência inspira, cópia cansa.",
  "Planejar a semana é ganhar a semana.",
  "Toda marca tem uma história. Nosso trabalho é contar bem.",
  "Conteúdo que conversa vende mais do que conteúdo que grita.",
];

// Mesmo pensamento o dia inteiro: escolhe pelo número do dia ("2026-10-23")
export function pensamentoDoDia(hoje: string) {
  const dia = Math.floor(Date.parse(`${hoje}T12:00:00Z`) / 86_400_000);
  return PENSAMENTOS[dia % PENSAMENTOS.length];
}
