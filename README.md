# SAF-T Analyzer

Aplicação web da [Sogeservi](https://sogeservi.pt) para analisar e validar ficheiros SAF-T (PT) de faturação. Consulte erros, avisos, totais financeiros e registos do ficheiro num único lugar.

URL publico previsto: https://saft.sogeservi.pt (ainda nao disponivel).

## Pré-visualização

![Painel de resultados do SAF-T Analyzer](docs/preview.png)

## Funcionalidades

- Analisa ficheiros SAF-T (PT) de faturação; ficheiros apenas de contabilidade não sao suportados.
- Valida a estrutura XML, dados mestres, documentos, pagamentos, referências e cadeias de hash.
- Apresenta erros e avisos com a respetiva localização, resumos financeiros e dados por secção.
- Exporta relatórios PDF com a marca Sogeservi, folhas de cálculo Excel e propostas de correção em JSON.
- Permite partilhar um relatório através de uma ligação temporária de 24 horas.
- Deteta o idioma do navegador: português para navegadores em português e inglês nos restantes casos.

## Privacidade e limites

Os ficheiros e relatórios são processados sem gravação em disco. A análise fica no navegador e não e guardada pelo servidor depois de concluída. Se o utilizador criar uma ligação de partilha, os dados completos do relatório ficam disponíveis por até 24 horas.

- Cada SAF-T pode ter até 100 MiB. O navegador envia-o em partes de 5 MiB, apenas depois de a análise receber uma vaga na fila.
- São processadas até 10 análises em simultâneo por processo Node.js; as restantes aguardam numa fila com posição apresentada ao utilizador. Cada endereço IP pode ter uma análise ativa de cada vez.
- Relatórios e ligações estão limitados a 5 pedidos por IP por minuto e 100 pedidos por minuto no total. Cada ligação pode conter até 10 MiB e cada IP pode manter até 10 ligações ativas. As ligações expiram após 24 horas.
- O estado da fila, os limites e as ligações são locais ao processo. Esta configuração destina-se a uma única instancia Node.js; várias replicas não partilham esses limites nem as ligações.
- Por predefinição, o IP é obtido de `CF-Connecting-IP`; se faltar ou for inválido, usamos o primeiro endereço válido de `X-Forwarded-For` ou `X-Real-IP`. Sem esses cabeçalhos, usamos o IP disponibilizado pelo runtime. Configure `TRUST_PROXY_HEADERS=false` para ignorar todos os cabeçalhos de proxy. Use apenas proxies que substituam estes valores e restrinja o acesso direto à origem.

Com a Cloudflare, cada pedido de bloco fica muito abaixo do limite documentado de 100 MB por pedido nos planos Free e Pro. O tamanho total do SAF-T pode assim exceder o limite por pedido, desde que cada bloco continue abaixo do limite configurado na zona. Consulte os [limites de carregamento da Cloudflare](https://developers.cloudflare.com/cache/concepts/default-cache-behavior/#upload-limits).

## Executar localmente

Requisitos: Node.js 24 e npm.

```bash
npm ci
npm run dev
```

Abra <http://localhost:3000>.

## Executar com Docker

```bash
docker compose up --build
```

O Compose associa a porta a máquina local. Para uma instalação pública, use HTTPS e um proxy configurado para encaminhar os pedidos sem armazenar respostas da API em cache. Não configure volumes persistentes para ficheiros ou resultados.

## Desenvolvimento

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

As regras de validação estão em [`rules/`](rules/). A aplicação usa Next.js, React, TypeScript e Tailwind CSS.

## Contribuir

Sugestões e contribuições sao bem-vindas através de issues e pull requests. Para reportar um problema, use um exemplo SAF-T sintetico e mínimo; não envie ficheiros reais de empresas nem dados pessoais.

## Licença

Este repositório ainda não tem uma licença definida. Inclua a licença aprovada pelo titular antes de o distribuir como projeto de código aberto.
