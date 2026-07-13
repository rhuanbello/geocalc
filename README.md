# GeoCalc

Aplicação educacional para transformar cálculos ambientais de planilhas
técnicas em uma experiência mais clara para aulas, trabalhos e pesquisas.

A primeira versão implementa o módulo de Balanço Hídrico. A ideia é preservar
o rigor dos cálculos originais e, ao mesmo tempo, tornar cada entrada, fator e
resultado mais fácil de explorar por quem não trabalha diretamente com a área.

A base técnica dos cálculos foi fornecida por Edison Dausacker Bidone,
professor titular do Departamento de Geoquímica da Universidade Federal
Fluminense, com atuação em Geoquímica Ambiental, modelagem geoquímica,
análise de risco e gestão ambiental.

## Como funciona

O usuário pode buscar um local, selecionar um ponto no mapa ou preencher os
dados manualmente. A aplicação usa precipitação mensal (`P`) e temperatura
média mensal (`T`) para calcular índice calorimétrico, ETP, ETP corrigida e
saldo de balanço hídrico (`BH`).

Também é possível preencher a tabela com dados climáticos da Open-Meteo,
ajustar hemisfério e latitude de fator, visualizar gráfico mensal, copiar um
relatório didático e exportar uma planilha Excel com resumo, legenda e dados
prontos para gráfico.

## Requisitos

- Bun

## Comandos

```bash
bun install
bun run dev
bun test
bun run build
```

## Fontes externas

- Open-Meteo Geocoding API
- Open-Meteo Historical Weather API
- OpenStreetMap via Leaflet
- Identidade visual do PPG Geoquímica/UFF
- Perfil público de Edison Dausacker Bidone no Escavador:
  https://www.escavador.com/sobre/8523601/edison-dausacker-bidone

## Referência técnica

A planilha original é usada como referência técnica do projeto, mas não deve
ser versionada no repositório. Os dados da planilha não são usados como valores
iniciais da interface; eles servem como caso de regressão nos testes
automatizados.

## Deploy

O projeto é publicado no GitHub Pages a partir da branch `main`:

https://rhuanbello.github.io/geocalc/
