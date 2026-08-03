export type PostpartumPrescription = {
  exerciseId: string;
  sets: number;
  reps: string;
  rest: number;
  rpe: string;
  note: string;
};

export type PostpartumSessionTemplate = {
  name: string;
  focus: string;
  kind: "strength" | "aerobic" | "recovery";
  minutes: number;
  warmupIds: string[];
  main: PostpartumPrescription[];
};

export type PostpartumBlock = {
  block: number;
  weeks: string;
  totalDays: number;
  strengthDays: number;
  rpe: string;
  objective: string;
  secondWeekRule: string;
  sessions: PostpartumSessionTemplate[];
};

const p = (exerciseId: string, sets: number, reps: string, rest: number, rpe: string, note: string): PostpartumPrescription => ({ exerciseId, sets, reps, rest, rpe, note });

const breathingWarmup = ["breathing_360", "walk"];
const aerobicWarmup = ["breathing_360", "bike"];

export const POSTPARTUM_BLOCKS: PostpartumBlock[] = [
  {
    block: 1, weeks: "10-11", totalDays: 2, strengthDays: 2, rpe: "RPE 4-5",
    objective: "Reconstruir tolerância, coordenação respiratória e técnica sem precipitar sintomas.",
    secondWeekRule: "Adicionar 1-2 repetições por série; não aumentar carga se houver sintomas.",
    sessions: [
      { name: "Força A - corpo inteiro", focus: "Reconexão e técnica", kind: "strength", minutes: 38, warmupIds: breathingWarmup, main: [p("box_squat",2,"10-12",75,"RPE 4-5","Expirar ao subir; banco alto se necessário."),p("seated_row",2,"10-12",60,"RPE 4-5","Tronco apoiado ou neutro."),p("glute_bridge",2,"10-12",60,"RPE 4","Sem arquear a lombar."),p("chest_press",2,"10-12",75,"RPE 4-5","Reduzir amplitude se houver pressão na cicatriz."),p("calf_raise",2,"12-15",45,"RPE 4","Usar apoio estável."),p("pallof_press",2,"8 por lado",45,"RPE 4","Resistir à rotação sem prender o ar.")] },
      { name: "Força B - corpo inteiro", focus: "Estabilidade e padrões básicos", kind: "strength", minutes: 38, warmupIds: breathingWarmup, main: [p("step_up",2,"8 por lado",75,"RPE 4-5","Degrau baixo e descida controlada."),p("romanian_deadlift_db",2,"10",75,"RPE 4-5","Halteres leves e coluna neutra."),p("assisted_lunge",2,"8 por lado",75,"RPE 4","Amplitude sem dor ou pressão pélvica."),p("half_kneeling_landmine",2,"10",60,"RPE 4-5","Costelas alinhadas sobre a pelve."),p("bird_dog",2,"6 por lado",45,"RPE 4","Pausa de 2 segundos sem girar o quadril."),p("suitcase_carry",3,"20 m por lado",45,"RPE 4-5","Começar leve e caminhar ereta.")] },
    ],
  },
  {
    block: 2, weeks: "12-13", totalDays: 2, strengthDays: 2, rpe: "RPE 5-6",
    objective: "Consolidar duas sessões e aumentar o volume apenas com resposta de 24 horas estável.",
    secondWeekRule: "Usar 3 séries nos 4 primeiros movimentos somente se a primeira semana estiver assintomática.",
    sessions: [
      { name: "Força A - base", focus: "Força global estável", kind: "strength", minutes: 43, warmupIds: aerobicWarmup, main: [p("goblet_squat",3,"8-10",90,"RPE 5-6","Carga junto ao peito e expirar ao subir."),p("seated_row",3,"8-12",75,"RPE 5-6","Pausa curta com escápulas para trás."),p("hip_thrust_machine",3,"10-12",75,"RPE 5-6","Banco baixo; sem hiperextender a lombar."),p("chest_press",3,"8-12",90,"RPE 5-6","Sem prender o ar."),p("step_up",2,"10 por lado",75,"RPE 5","Controle na descida."),p("pallof_press",2,"10 por lado",45,"RPE 5","Expirar ao afastar as mãos."),p("side_plank_knees",2,"15-20 s por lado",45,"RPE 4-5","Interromper com abaulamento ou pressão.")] },
      { name: "Força B - base", focus: "Cadeia posterior e controle", kind: "strength", minutes: 42, warmupIds: breathingWarmup, main: [p("leg_press",3,"10-12",90,"RPE 5-6","Pés estáveis e amplitude confortável."),p("lat_pulldown",3,"8-12",75,"RPE 5-6","Sem balançar o tronco."),p("romanian_deadlift_db",3,"8-10",90,"RPE 5-6","Expirar ao estender o quadril."),p("landmine_press",2,"10 por lado",60,"RPE 5","Base estável e costelas alinhadas."),p("assisted_lunge",2,"8 por lado",75,"RPE 5","Amplitude progressiva."),p("dead_bug",2,"6-8 por lado",45,"RPE 4-5","Parar antes de perder o controle abdominal."),p("farmer_carry",3,"25 m",60,"RPE 5-6","Passos curtos e respiração normal.")] },
    ],
  },
  {
    block: 3, weeks: "14-15", totalDays: 3, strengthDays: 2, rpe: "RPE 5-6",
    objective: "Adicionar um terceiro dia leve sem aumentar simultaneamente carga e frequência.",
    secondWeekRule: "Acrescentar 5 minutos ao aeróbico ou 1 série em um exercício de core, nunca ambos.",
    sessions: [
      { name: "Força A", focus: "Corpo inteiro", kind: "strength", minutes: 43, warmupIds: breathingWarmup, main: [p("goblet_squat",3,"8-12",90,"RPE 5-6","Amplitude sem abaulamento."),p("chest_supported_row",3,"8-12",75,"RPE 5-6","Evitar compensação lombar."),p("hip_thrust_machine",3,"8-12",90,"RPE 5-6","Pausa de 1 segundo no topo."),p("chest_press",3,"8-12",90,"RPE 5-6","Técnica estável."),p("step_up",2,"10 por lado",75,"RPE 5","Controle excêntrico."),p("pallof_press",3,"8 por lado",45,"RPE 5","Sem rodar o tronco.")] },
      { name: "Aeróbico e core", focus: "Condicionamento leve", kind: "aerobic", minutes: 32, warmupIds: aerobicWarmup, main: [p("bike",1,"20-25 min",0,"RPE 3-4","Talk test: frases completas."),p("bird_dog",2,"8 por lado",45,"RPE 4","Pausa de 2 segundos."),p("dead_bug",2,"8 por lado",45,"RPE 4-5","Sem abaulamento."),p("side_plank_knees",2,"20 s por lado",45,"RPE 5","Respiração contínua.")] },
      { name: "Força B", focus: "Cadeia posterior", kind: "strength", minutes: 43, warmupIds: breathingWarmup, main: [p("leg_press",3,"10-12",90,"RPE 5-6","Amplitude confortável."),p("lat_pulldown",3,"8-12",75,"RPE 5-6","Sem inclinar excessivamente."),p("romanian_deadlift_db",3,"8-10",90,"RPE 5-6","Quadril para trás."),p("landmine_press",3,"8-10 por lado",75,"RPE 5-6","Expirar ao empurrar."),p("assisted_lunge",2,"10 por lado",75,"RPE 5","Joelho e pé alinhados."),p("suitcase_carry",3,"25-30 m por lado",60,"RPE 5-6","Sem inclinação lateral.")] },
    ],
  },
  {
    block: 4, weeks: "16-17", totalDays: 4, strengthDays: 3, rpe: "RPE 6",
    objective: "Primeiro contato com quatro dias totais, preservando uma sessão curta e de menor volume.",
    secondWeekRule: "Acrescentar 1 série em um exercício principal de apenas um dia; manter a sessão curta.",
    sessions: [
      { name: "Inferiores e empurrar", focus: "Força", kind: "strength", minutes: 45, warmupIds: breathingWarmup, main: [p("leg_press",3,"8-12",90,"RPE 6","Sem prender o ar."),p("hip_thrust_machine",3,"8-12",90,"RPE 6","Pausa no topo."),p("chest_press",3,"8-12",90,"RPE 6","Costelas estáveis."),p("step_up",3,"8 por lado",75,"RPE 5-6","Degrau controlado."),p("calf_raise",3,"12-15",60,"RPE 5-6","Controle total."),p("pallof_press",3,"10 por lado",45,"RPE 5","Respiração contínua.")] },
      { name: "Aeróbico leve e mobilidade", focus: "Recuperação", kind: "aerobic", minutes: 32, warmupIds: ["breathing_360"], main: [p("bike",1,"25-30 min",0,"RPE 3-4","Sem corrida ou salto."),p("thoracic_rotation",2,"8 por lado",30,"RPE 2","Movimento suave."),p("hip_flexor_stretch",2,"8 por lado",30,"RPE 2","Amplitude confortável.")] },
      { name: "Puxar e cadeia posterior", focus: "Força", kind: "strength", minutes: 45, warmupIds: breathingWarmup, main: [p("romanian_deadlift_db",3,"8-10",90,"RPE 6","Carga moderada e coluna neutra."),p("lat_pulldown",3,"8-12",75,"RPE 6","Escápulas controladas."),p("goblet_squat",3,"10",90,"RPE 6","Sem abaulamento."),p("seated_row",3,"10",75,"RPE 6","Pausa curta."),p("assisted_lunge",2,"10 por lado",75,"RPE 5-6","Progressão de amplitude."),p("side_plank_knees",3,"20-25 s por lado",45,"RPE 5-6","Sem pressão pélvica.")] },
      { name: "Força global curta", focus: "Técnica e consistência", kind: "strength", minutes: 33, warmupIds: breathingWarmup, main: [p("box_squat",2,"12",75,"RPE 5","Carga leve."),p("wall_pushup",2,"10-12",60,"RPE 5","Altura que permita controle."),p("chest_supported_row",2,"12",60,"RPE 5","Sem fadiga lombar."),p("glute_bridge",2,"12",60,"RPE 5","Pausa de 2 segundos."),p("bird_dog",2,"8 por lado",45,"RPE 4","Quadril nivelado."),p("farmer_carry",2,"30 m",60,"RPE 5-6","Respiração normal.")] },
    ],
  },
  {
    block: 5, weeks: "18-19", totalDays: 4, strengthDays: 3, rpe: "RPE 6-7",
    objective: "Aumentar gradualmente a sobrecarga mantendo três sessões de força e uma aeróbica.",
    secondWeekRule: "Se todas as séries alcançarem o topo da faixa sem sintomas, aumentar a carga em 2,5-5%.",
    sessions: [],
  },
  {
    block: 6, weeks: "20-21", totalDays: 4, strengthDays: 3, rpe: "RPE 6-7",
    objective: "Consolidar cargas e tolerância, com uma semana de recuperação planejada.",
    secondWeekRule: "Retirar 1 série dos exercícios com 3 séries e manter as cargas.",
    sessions: [],
  },
  {
    block: 7, weeks: "22-23", totalDays: 5, strengthDays: 3, rpe: "RPE 6-7",
    objective: "Introduzir cinco dias totais sem transformar a semana em cinco estímulos difíceis.",
    secondWeekRule: "Aumentar apenas a duração do aeróbico ou do domingo; não aumentar carga nesta adaptação.",
    sessions: [],
  },
  {
    block: 8, weeks: "24-25", totalDays: 5, strengthDays: 3, rpe: "RPE 7 máximo",
    objective: "Consolidar a rotina e chegar descansada à reavaliação de seis meses.",
    secondWeekRule: "Manter as cargas e reduzir uma série dos exercícios principais antes da reavaliação.",
    sessions: [],
  },
];

const block4 = POSTPARTUM_BLOCKS[3].sessions;
POSTPARTUM_BLOCKS[4].sessions = [block4[0], block4[1], block4[2], block4[3]].map((session, index) => ({ ...session, name: index === 0 ? "Força A" : index === 1 ? "Aeróbico e core" : index === 2 ? "Força B" : "Força C global", focus: index === 1 ? "Condicionamento contínuo" : "Sobrecarga progressiva" }));
POSTPARTUM_BLOCKS[5].sessions = [block4[0], block4[2], { ...block4[1], name: "Aeróbico intervalado de baixo impacto", focus: "Intervalos controlados" }, block4[3]];
POSTPARTUM_BLOCKS[6].sessions = [block4[0], block4[2], { ...block4[1], name: "Aeróbico", minutes: 38 }, block4[3], { name: "Recuperação ativa", focus: "Core, mobilidade e caminhada", kind: "recovery", minutes: 25, warmupIds: ["breathing_360"], main: [p("walk",1,"15-20 min",0,"RPE 2-3","Sem meta de velocidade."),p("bird_dog",2,"8 por lado",45,"RPE 4","Controle."),p("thoracic_rotation",2,"8 por lado",30,"RPE 2","Movimento suave.")] }];
POSTPARTUM_BLOCKS[7].sessions = POSTPARTUM_BLOCKS[6].sessions.map((session, index) => ({ ...session, name: index === 0 ? "Inferiores progressivos" : index === 1 ? "Superiores progressivos" : session.name, focus: index < 2 ? "Consolidação antes da reavaliação" : session.focus }));

export const POSTPARTUM_BLOCK_TOTAL = POSTPARTUM_BLOCKS.length;
