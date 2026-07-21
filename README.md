# GeoCalc

Aplicação educacional para transformar cálculos ambientais de planilhas
técnicas em uma experiência mais clara para trabalhos, pesquisas e relatórios.

A primeira versão implementa o módulo de Balanço Hídrico. A ideia é preservar
o rigor dos cálculos originais e, ao mesmo tempo, tornar cada entrada, fator e
resultado mais fácil de explorar por quem não trabalha diretamente com a área.

A base técnica dos cálculos foi preparada em colaboração com o PPG
Geoquímica/UFF, preservando a lógica das planilhas originais como referência
metodológica.

## Como funciona

O usuário pode buscar um local, selecionar um ponto no mapa ou preencher os
dados manualmente. A aplicação usa precipitação mensal (`P`) e temperatura
média mensal (`T`) para calcular índice calorimétrico, ETP, ETP corrigida e
saldo de balanço hídrico (`BH`).

Também é possível preencher a tabela com dados climáticos da Open-Meteo,
ajustar hemisfério e latitude de fator, visualizar gráfico mensal, copiar uma
síntese dos resultados e exportar uma planilha Excel com resumo, legenda e
dados prontos para gráfico.

## Requisitos

- Bun

## Comandos

```bash
bun install
bun run dev
bun test
bun run build
bun run build:prod
bun run build:dev-pages
```

## Fontes externas

- Open-Meteo Geocoding API
- Open-Meteo Historical Weather API
- OpenStreetMap via Leaflet
- Identidade visual do PPG Geoquímica/UFF

## Referência técnica

A planilha original é usada como referência técnica do projeto, mas não deve
ser versionada no repositório. Os dados da planilha não são usados como valores
iniciais da interface; eles servem como caso de regressão nos testes
automatizados.

## Deploy

O projeto tem dois ambientes no GitHub Pages:

- produção: https://rhuanbello.github.io/geocalc/
- homologação: https://rhuanbello.github.io/geocalc-dev/

O workflow usa `VITE_BASE_PATH` com base no nome do repositório. Assim, o
mesmo código funciona em `/geocalc/` e `/geocalc-dev/` sem quebrar os assets.

Fluxo sugerido:

```bash
git push dev develop:main
```

Depois da validação:

```bash
git checkout main
git merge develop
git push origin main
```
