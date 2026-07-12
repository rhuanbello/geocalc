# Ecocalc

MVP educacional para calculos ambientais. A primeira versao implementa o modulo
de Balanço Hidrico com mapa, importacao de dados climaticos da Open-Meteo,
tabela editavel, grafico, CSV e relatorio didatico.

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

## Observacoes

A planilha original permanece no repositorio como referencia tecnica. Os dados
da planilha nao sao usados como valores iniciais da interface; eles servem como
caso de regressao nos testes automatizados.
