# SAF-T Analyzer

Aplicação web da [Sogeservi](https://sogeservi.pt) para analisar e validar ficheiros SAF-T (PT) de faturação. Consulte erros, avisos, totais financeiros e registos do ficheiro num só lugar.

**[Versão web](https://saft.sogeservi.pt)**

## Funcionalidades

- Analisa ficheiros SAF-T (PT) de faturação; ficheiros apenas de contabilidade não são suportados.
- Verifica a estrutura XML, dados mestres, documentos, pagamentos, referências e cadeias de hash.
- Apresenta erros e avisos com a respetiva localização, resumos financeiros e dados por secção.
- Gera relatórios PDF, folhas de cálculo Excel e propostas de correção em JSON no navegador.
- Deteta o idioma do navegador: português para navegadores em português e inglês nos restantes casos.

## Privacidade e limites

A aplicação é estática e não tem API, backend de análise, base de dados ou armazenamento de ficheiros. O SAF-T é lido, analisado e exportado no navegador do utilizador. Os ficheiros e resultados não são enviados para um servidor.

- Cada SAF-T pode ter até 100 MiB. A análise corre num Web Worker para manter a interface responsiva e os ficheiros selecionados são processados sequencialmente.
- O uso de memória depende do tamanho e conteúdo do SAF-T e dos recursos do dispositivo. A aplicação não guarda resultados entre sessões.
- Ligações partilháveis não estão disponíveis, porque exigiriam armazenar o relatório num serviço acessível a outros utilizadores.

## Executar localmente

Requisitos: Node.js 24 e npm.

```bash
npm ci
npm run dev
```

Abra <http://localhost:3000>.

## Produzir ficheiros estáticos

```bash
npm run build
```

O Next.js exporta o site estático para `out/`. Publique esse diretório em qualquer alojamento de ficheiros estáticos. O alojamento serve apenas a aplicação; toda a análise e geração de relatórios ocorre no navegador.

## Executar com Docker

```bash
docker compose up --build
```

A imagem final usa Nginx para servir os ficheiros estáticos em `http://localhost:3000`. O contêiner não executa um servidor de aplicação nem recebe ficheiros SAF-T.

## Desenvolvimento

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

As regras de validação estão em `src/lib/validators/`. A aplicação usa Next.js, React, TypeScript e Tailwind CSS.

## Contribuir

Sugestões e contribuições são bem-vindas através de issues e pull requests. Para reportar um problema, use um exemplo SAF-T sintético e mínimo; não envie ficheiros reais de empresas nem dados pessoais.

## Licença

Este projeto é distribuído ao abrigo da licença MIT. Consulte o ficheiro `LICENSE`.