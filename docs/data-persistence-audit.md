# Auditoria de persistência

Data: 6 de agosto de 2026
Schema local: 3

## Arquitetura entregue

Todos os registros críticos passam por `CriticalDataRepository`. O JSON compatível continua nas chaves existentes e é espelhado no IndexedDB em um envelope com checksum. Leituras inválidas são colocadas em quarentena e recuperadas do espelho quando possível. Um snapshot íntegro é criado antes de migrações e atualizações.

| Dado | Chave | Proteção |
| --- | --- | --- |
| Perfil e prescrição | `fitlocal.profile.v1` | armazenamento primário + espelho íntegro |
| Histórico | `brasafit.history.v2` | armazenamento primário + espelho íntegro |
| Medições | `brasafit.measurements.v3` | armazenamento primário + espelho íntegro |
| Check-ins | `brasafit.checkins.v1` | armazenamento primário + espelho íntegro |
| Sessão ativa | `angelsfit.active-session.v1` | escrita a cada ação + espelho íntegro |

A sessão ativa guarda timestamps absolutos, exercício atual, séries, cargas, repetições, RIR, descanso, check-in, cardio, anotações, substituições e desconfortos. Ao reabrir o app, o usuário pode continuar ou encerrar a sessão parcial sem perder os registros.

## Compatibilidade e migração

As migrações 1 → 2 → 3 são sequenciais, idempotentes e preservam campos desconhecidos. Sessões gravadas antes da inclusão de anotações, substituições e eventos de dor são normalizadas com coleções vazias. A versão de conteúdo e a versão mínima do contêiner são verificadas antes de recarregar o aplicativo.

## Limites conscientes

- Não há sincronização remota porque o site público e o APK não possuem identidade segura por usuário. Ativar D1 nesse cenário poderia misturar ou expor dados de saúde.
- O IndexedDB reduz falhas e corrupção locais, mas não protege contra limpeza ou perda total do aparelho. O backup exportável continua recomendado.
- O projeto Android/Capacitor não está no repositório. Recursos nativos opcionais usam fallback web até que o código nativo e plugins sejam recuperados.
