# Prontidão da atualização — 6 de agosto de 2026

## APK auditado

- Aplicativo: Angels Fit (`com.angelsfit.app`)
- Versão: 1.0 (código 1)
- Android mínimo: API 23; alvo: API 35
- Conteúdo remoto: `https://fitlocal-mario.mario-92.chatgpt.site/`
- Plugins Capacitor opcionais: nenhum empacotado
- Assinatura: certificado Android Debug; APK marcado como depurável
- SHA-256: `FA548F30966DA75F16A049F0E85F52596CB07A89787F14A59BB3CD8E9BCA8FDF`

O APK existente receberá esta atualização remota sem reinstalação. Ele não deve ser promovido em uma loja como release de produção enquanto continuar depurável e assinado com certificado de desenvolvimento.

## Versões publicadas

- Aplicativo Android compatível: 1.0
- Conteúdo remoto: 2026.08.06.2
- Schema local: 3
- Cache offline: `angels-fit-v6`

## Cobertura funcional

- sessão ativa persistida e retomável;
- timer e descanso baseados em timestamps absolutos;
- pausa, retomada, +15 segundos e pular descanso;
- check-in de prontidão e ajuste de volume;
- substituição de exercícios, anotações e desconfortos;
- feedback final, histórico e recuperação em 24 horas;
- proteção por checksum, espelho local, snapshot e rollback;
- verificação de compatibilidade antes de atualizar;
- loading, retry e fallback para mídia de exercícios;
- navegação principal com Hoje, Treinos, Progresso e Ajustes;
- fallbacks web para status bar, vibração, wake lock, botão voltar e navegador externo.

## Validação de release

Execute `npm test`, `npm run typecheck` e `npm run lint`. No Android, validar manualmente: criação do perfil; início e retomada após fechar; descanso após segundo plano; substituição; registro de desconforto; término parcial/completo; modo avião; atualização; botão voltar; rotação bloqueada; links externos.

## Pendências para um novo APK

1. Recuperar o projeto Android/Capacitor original.
2. Adicionar plugins nativos necessários e testes em dispositivo.
3. Criar/cofrear chave de assinatura de produção.
4. Desabilitar `debuggable`, revisar `allowBackup` e gerar App Bundle/APK assinado.
5. Incrementar `versionCode` e publicar por um canal de distribuição controlado.
