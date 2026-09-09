# Guia de Identidade Visual e Design System

Este documento especifica os padrões de **identidade visual, paleta de cores, tipografia, componentes de interface e regras de layout** do ecossistema de **Análise de Market Share / Dashboard da SL Distribuidora**.

O objetivo é garantir a reprodução exata da identidade visual em novos componentes, relatórios PDF, dashboards ou extensões do sistema.

---

## 1. Paleta de Cores

A paleta foi desenvolvida para transmitir relevância corporativa, precisão analítica e destaque estratégico para a marca **Santa Lúcia**.

### 1.1. Cores Institucionais Principais

| Aplicação | Nome | Hex | Tailwind CSS | Função Visual |
| :--- | :--- | :--- | :--- | :--- |
| **Primária (Brand)** | Laranja Santa Lúcia | `#F97316` | `orange-500` | Destaque principal, dados da Sta. Lúcia, botões ativos, borda de KPI principal. |
| **Secundária** | Vermelho Corporativo | `#DC2626` | `red-600` | Destaque secundário, posições de ranking, indicadores de alerta. |
| **Escuro Neutro** | Slate Dark | `#1E293B` | `slate-800` | Títulos principais, valores de KPIs, texto de alta ênfase. |
| **Claro Neutro** | Slate Light (Fundo) | `#F8FAFC` | `slate-50` | Fundo geral da aplicação, containers de plotagem de gráficos. |
| **Cinza Neutro** | Slate Gray (Bordas) | `#64748B` | `slate-500` | Subtítulos, rótulos secundários, texto desabilitado/mudo. |
| **Borda/Divisor** | Slate Light Border | `#E2E8F0` | `slate-200` | Linhas de grade de gráficos, divisores de tabelas e cards. |

---

### 1.2. Paleta Específica por Distribuidora (Competidores)

Para facilitar a leitura rápida de gráficos de linha, barras e mapas competitivos, cada distribuidora possui uma cor fixa atribuída:

```javascript
export const distributorColors = {
  santaLucia: '#F97316', // Laranja vibrante (Destaque da marca)
  ipiranga:   '#EAB308', // Amarelo
  raizen:     '#1E3A8A', // Azul Marinho (Shell / Raízen)
  rodoil:     '#DC2626', // Vermelho
  vibra:      '#16A34A', // Verde (Vibra / BR)
  sim:        '#38BDF8', // Azul Claro (SIM Distribuidora)
  charrua:    '#64748B', // Cinza Slate
};
```

> **Fallback de Cores para Outras Distribuidoras:**  
> Quando uma distribuidora não está na lista predefinida, utiliza-se um hash determinístico gerando uma cor HSL com saturação de `55%` e luminosidade de `48%` (`hsl(hue, 55%, 48%)`), garantindo contraste e constância visual sem repetições confusas.

---

### 1.3. Semáforo de Risco e Status (Traffic Light)

Para KPIs, cards de oportunidade e tabelas estratégicas:

* **Positivo / Crescimento / Baixo Risco (Verde):** `#10B981` / `#16A34A` (`emerald-500` / `emerald-600`)  
  * *Uso:* Ganhos de share, desempenho acima do mercado, subida de posição.
* **Atenção / Neutro / Médio Risco (Amarelo/Âmbar):** `#F59E0B` / `#EAB308` (`amber-500` / `yellow-500`)  
  * *Uso:* Variações marginais, estabilidade, mercado estagnado.
* **Perigo / Queda / Alto Risco (Vermelho):** `#EF4444` / `#DC2626` (`red-500` / `red-600`)  
  * *Uso:* Perda de share, desempenho abaixo do mercado, perda de posição.

---

## 2. Tipografia e Hierarquia de Texto

A tipografia utiliza a pilha padrão sans-serif do sistema (`Inter`, `system-ui`, `-apple-system`, `sans-serif`), priorizando legibilidade de números e dados estatísticos.

### 2.1. Hierarquia de Estilos

```css
/* Título Principal da Página / Header */
.text-page-title {
  font-size: 1.875rem; /* 30px / text-3xl */
  font-weight: 900;    /* font-black */
  color: #1E293B;      /* text-slate-800 */
}

/* Valor Principal dos Cards de KPI */
.text-kpi-value {
  font-size: 1.875rem; /* 30px / text-3xl */
  font-weight: 900;    /* font-black */
  color: #1E293B;      /* text-slate-800 */
}

/* Rótulo / Subtítulo dos Cards de KPI */
.text-kpi-label {
  font-size: 0.75rem;  /* 12px / text-xs */
  font-weight: 700;    /* font-bold */
  color: #64748B;      /* text-slate-500 */
  text-transform: uppercase;
  letter-spacing: 0.05em; /* tracking-wider */
}

/* Texto Secundário e Informações Complementares */
.text-meta {
  font-size: 0.75rem;  /* 12px / text-xs */
  font-weight: 500;    /* font-medium */
  color: #64748B;      /* text-slate-500 */
}

/* Cabeçalho de Tabelas */
.text-table-header {
  font-size: 0.75rem;  /* 12px / text-xs */
  font-weight: 700;    /* font-bold */
  color: #64748B;      /* text-slate-500 */
  text-transform: uppercase;
}
```

---

## 3. Elementos de Interface e Componentes (UI Components)

### 3.1. Cards de KPI (KpiGrid)
* **Estrutura:** Container retangular com fundo branco (`bg-white`), bordas suaves (`border border-slate-200`), cantos arredondados (`rounded-xl`) e sombra discreta (`shadow-sm`).
* **Destaque Lateral (Accent Border):** Borda esquerda de `4px` (`border-l-4`) com cor temática:
  * Laranja (`#F97316`) no Card de Market Share Sta. Lúcia.
  * Vermelho (`#DC2626`) no Card de Posição no Ranking.
  * Cinza (`#64748B`) no Card de Performance Relativa.
* **Ícone Indicador:** Ícone posicionado no canto superior direito dentro de um badge com fundo suave (`bg-blue-50`, `bg-orange-50`, `bg-slate-50`).

### 3.2. Semáforo de Risco & Oportunidade (TrafficLight)
* Layout em grid de 3 colunas (`grid-cols-1 md:grid-cols-3 gap-3`).
* Exibe a trilha analítica (`item.track`), valor atual em destaque (`text-lg font-black text-slate-800`) e ícone indicador de status (`CheckCircle2`, `MinusCircle`, `AlertTriangle` da biblioteca `lucide-react`).

### 3.3. Tabelas de Dados
* **Estilo Visual:** Design limpo com linhas separadas por bordas `border-slate-200`.
* **Cabeçalho:** Fundo `bg-slate-50` ou `bg-slate-100`, texto em maiúsculas com alinhamento rigoroso (números alinhados à direita, textos à esquerda).
* **Hover de Linhas:** Efeito `hover:bg-slate-50` para legibilidade em grandes tabelas de origem/destino e crescimento.
* **Badges / Chips:** Posições em ranking e semáforos em formato de pílula (`rounded-full px-2 py-0.5 text-xs font-semibold`).

### 3.4. Gráficos e Data Visualization
* **Linhas de Grade:** Sutis, pontilhadas (`strokeDasharray="3 3"`), cor `#E2E8F0`.
* **Tooltips de Gráficos:** Card flutuante com fundo branco, cantos arredondados (`borderRadius: '8px'`), sombra e borda leve.
* **Rótulos nas Barras (`BarValueLabel`):**
  * Texto interno à barra: Branco (`#FFFFFF`) quando há espaço.
  * Texto externo à barra: Slate Dark (`#334155`) quando a barra for curta.

### 3.5. Filtros e Controles de Interface
* **Botões de Modo de Análise (YoY / MoM / YTD):** Botão selecionado possui fundo escuro/laranja com texto em negrito; botões inativos mantêm fundo neutro `bg-slate-100 text-slate-600`.
* **Selects e Dropdowns (`MultiSelect` / `DateRangeFilterTree`):** Estilo limpo com contorno `border-slate-300`, ícones de expansão e tags/chips para opções selecionadas.

---

## 4. Padrões de Layout e Geometria

| Propriedade | Valor Padrão | Classe Tailwind |
| :--- | :--- | :--- |
| **Raio de Borda de Cards** | `12px` | `rounded-xl` |
| **Raio de Borda de Botões/Badges** | `8px` ou Total | `rounded-lg` / `rounded-full` |
| **Sombras** | Elevação leve | `shadow-sm` |
| **Padding de Cards** | `16px` | `p-4` |
| **Espaçamento entre Cards (Grid Gap)** | `16px` | `gap-4` |
| **Margem Inferior entre Seções** | `24px` | `mb-6` |

---

## 5. Exemplo de Código para Componente Respeitando a Identidade

```jsx
import React from 'react';
import { PieChart } from 'lucide-react';
import { theme } from '../styles/theme';

export function KpiCardExemplo({ titulo, valor, percentual, subtitulo }) {
  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 border-l-4" style={{ borderLeftColor: theme.primary }}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            {titulo}
          </p>
          <h2 className="text-3xl font-black text-slate-800 mt-2">{valor}</h2>
        </div>
        <div className="p-2 bg-orange-50 rounded-lg">
          <PieChart className="w-5 h-5 text-orange-500" />
        </div>
      </div>
      <div className="mt-2 text-xs text-slate-500 flex items-center">
        <span className="font-semibold text-emerald-600 mr-2">{percentual}</span>
        <span className="text-slate-400">{subtitulo}</span>
      </div>
    </div>
  );
}
```
