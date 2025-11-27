// js/index.js
// VERSÃO 6.0 (Atualizado para Autenticação Google e caminho 'usuarios/')

import { 
    db, 
    ref, 
    onValue, 
    set, 
    get, 
    off 
} from './firebase-config.js'; // (Imports da v10.7.1, estão corretos)
import { 
    getUserId, 
    formatCurrency, 
    parseCurrency 
} from './main.js';

// ---- Variáveis Globais ----
let userId = null;
let currentYear = new Date().getFullYear();
let currentMonth = (new Date().getMonth() + 1).toString().padStart(2, '0');
let activeListeners = [];

// Estado global do dashboard
let dashboardState = {
    totalEntradas: 0,
    totalDespesas: 0, 
    lucroLiquido: 0,
    saldoAcumulado: 0,
    saldoMesAnterior: 0,
    kmTotal: 0,
    horasTotal: 0, 
    metaEntrada: 0,
    metaGasto: 0, 
    detalheVariaveis: 0, 
    detalheFixas: 0,     
    detalheDividas: 0,    
    totalFaturasMes: 0,  
    totalLimites: 0,
    dadosGraficoCat: {},
    dadosGraficoLinha: {},
    dadosResumoAnual: {}
};

// Instâncias dos Gráficos
let graficoCategorias = null;
let graficoEvolucao = null;

// ---- Elementos DOM (KPIs) ----
const kpiEntradasEl = document.getElementById('kpi-total-entradas');
const kpiDespesasEl = document.getElementById('kpi-total-despesas');
const kpiLucroEl = document.getElementById('kpi-lucro-liquido');
const kpiSaldoEl = document.getElementById('kpi-saldo-acumulado');
const kpiHorasEl = document.getElementById('kpi-total-horas');
const kpiKmEl = document.getElementById('kpi-total-km');

// ---- Elementos DOM (Metas) ----
const metaEntradaProgress = document.getElementById('meta-entrada-progress');
const metaEntradaPercent = document.getElementById('meta-entrada-percent');
const metaEntradaValor = document.getElementById('meta-entrada-valor');
const metaEntradaRestante = document.getElementById('meta-entrada-restante');
const metaGastoProgress = document.getElementById('meta-gasto-progress');
const metaGastoPercent = document.getElementById('meta-gasto-percent');
const metaGastoValor = document.getElementById('meta-gasto-valor');
const metaGastoRestante = document.getElementById('meta-gasto-restante');

// ---- Elementos DOM (Resumos) ----
const tbodyResumoDespesas = document.getElementById('tbody-resumo-despesas');
const tbodyResumoCartoes = document.getElementById('tbody-resumo-cartoes');
const tbodyResumoAnual = document.getElementById('tbody-resumo-anual');

// ---- Modais ----
const modalMetaEntrada = document.getElementById('modal-meta-entrada');
const formMetaEntrada = document.getElementById('form-meta-entrada');
const inputMetaEntrada = document.getElementById('input-meta-entrada');
const modalMetaGasto = document.getElementById('modal-meta-gasto');
const formMetaGasto = document.getElementById('form-meta-gasto');
const inputMetaGasto = document.getElementById('input-meta-gasto');

// ===============================================================
// INICIALIZAÇÃO
// ===============================================================

document.addEventListener('authReady', (e) => {
    userId = e.detail.userId; // Recebe o UID do 'main.js'
    
    // Listener para mudança de mês (vinda do 'main.js')
    document.addEventListener('monthChanged', (e) => {
        currentYear = e.detail.year;
        currentMonth = e.detail.month;
        
        // Limpa listeners antigos para evitar múltiplas execuções
        limparListeners();
        // Recarrega todos os dados do dashboard para o novo mês/ano
        loadAllDashboardData();
    });

    // Carrega os dados do dashboard pela primeira vez
    loadAllDashboardData();

    // Listeners dos Modais
    document.getElementById('btn-definir-meta').addEventListener('click', () => {
        inputMetaEntrada.value = formatCurrency(dashboardState.metaEntrada).replace('R$', '').trim();
        modalMetaEntrada.style.display = 'flex';
    });
    document.getElementById('btn-definir-meta-gasto').addEventListener('click', () => {
        inputMetaGasto.value = formatCurrency(dashboardState.metaGasto).replace('R$', '').trim();
        modalMetaGasto.style.display = 'flex';
    });

    // Fechar Modais
    modalMetaEntrada.querySelector('.btn-cancel').addEventListener('click', () => modalMetaEntrada.style.display = 'none');
    modalMetaGasto.querySelector('.btn-cancel').addEventListener('click', () => modalMetaGasto.style.display = 'none');

    // Salvar Modais
    formMetaEntrada.addEventListener('submit', handleSalvarMeta);
    formMetaGasto.addEventListener('submit', handleSalvarMetaGasto);
});

function limparListeners() {
    activeListeners.forEach(l => off(l.ref, 'value', l.callback));
    activeListeners = [];
}

function listen(path, callback) {
    const dataRef = ref(db, path);
    const listenerCallback = onValue(dataRef, callback);
    activeListeners.push({ ref: dataRef, callback: listenerCallback });
}

// ===============================================================
// 1. CARREGAMENTO GERAL DOS DADOS
// ===============================================================

/**
 * v6.0: ATUALIZADO CAMINHOS PARA 'usuarios/'
 * Busca todos os dados necessários para o dashboard de forma assíncrona.
 */
async function loadAllDashboardData() {
    if (!userId) return;

    // Caminhos para buscar (AGORA EM 'usuarios/')
    const paths = {
        saldoGlobal: `usuarios/${userId}/saldo/global`,
        metas: `usuarios/${userId}/metas`,
        metasGasto: `usuarios/${userId}/metas_gasto`,
        cartoesConfig: `usuarios/${userId}/cartoes/config`,
        cartoesSpecs: `usuarios/${userId}/cartoes_specs`,
        despesasMes: `usuarios/${userId}/despesas/${currentYear}-${currentMonth}`,
        fixosMes: `usuarios/${userId}/fixos/${currentYear}-${currentMonth}`,
        pendenciasMes: `usuarios/${userId}/pendencias/${currentYear}-${currentMonth}`,
        entradasMes: `usuarios/${userId}/entradas/${currentYear}-${currentMonth}`,
        investimentos: `usuarios/${userId}/investimentos/config`,
        
        // Dados anuais (busca o nó 'pai')
        despesasAno: `usuarios/${userId}/despesas`,
        entradasAno: `usuarios/${userId}/entradas`
    };

    // Array de promessas de busca
    const promises = Object.keys(paths).map(key => get(ref(db, paths[key])));

    try {
        const results = await Promise.all(promises);
        
        const dataMap = {
            saldoGlobal: results[0].val() || { saldoAcumulado: 0 },
            metas: results[1].val() || { valor: 0 },
            metasGasto: results[2].val() || { valor: 0 },
            cartoesConfig: results[3].val() || {},
            cartoesSpecs: results[4].val() || {},
            despesasMes: results[5].val() || {},
            fixosMes: results[6].val() || {},
            pendenciasMes: results[7].val() || {},
            entradasMes: results[8].val() || {},
            investimentos: results[9].val() || {},
            despesasAno: results[10].val() || {},
            entradasAno: results[11].val() || {}
        };
        
        // Uma vez que TUDO foi carregado, processa e renderiza
        processarDadosDashboard(dataMap);

    } catch (error) {
        console.error("Erro ao carregar dados do dashboard:", error);
    }
}

/**
 * Calcula todos os KPIs e dados de gráfico a partir dos dados brutos.
 */
function processarDadosDashboard(dataMap) {
    // Zera o estado para recálculo
    dashboardState = {
        ...dashboardState, // Mantém dados que não mudam (como saldo anterior, se houver)
        totalEntradas: 0, totalDespesas: 0, lucroLiquido: 0,
        kmTotal: 0, horasTotal: 0,
        detalheVariaveis: 0, detalheFixas: 0, detalheDividas: 0,
        totalFaturasMes: 0, totalLimites: 0,
        dadosGraficoCat: {}, dadosGraficoLinha: {}, dadosResumoAnual: {}
    };

    // 1. Saldo e Metas
    dashboardState.saldoAcumulado = dataMap.saldoGlobal.saldoAcumulado;
    dashboardState.metaEntrada = dataMap.metas.valor;
    dashboardState.metaGasto = dataMap.metasGasto.valor;
    
    // 2. Processa Entradas do Mês
    const entradasArray = Object.values(dataMap.entradasMes);
    dashboardState.totalEntradas = entradasArray.reduce((sum, e) => sum + e.valor, 0);
    dashboardState.kmTotal = entradasArray.reduce((sum, e) => sum + (e.km || 0), 0);
    dashboardState.horasTotal = entradasArray.reduce((sum, e) => sum + (e.horas || 0), 0);
    
    // 3. Processa Despesas (que afetam o saldo)
    const pagamentosQueAfetamSaldo = ['Saldo em Caixa', 'Pix', 'Dinheiro'];
    
    // 3a. Despesas Variáveis
    Object.values(dataMap.despesasMes).forEach(d => {
        if (pagamentosQueAfetamSaldo.includes(d.formaPagamento)) {
            dashboardState.detalheVariaveis += d.valor;
        }
    });

    // 3b. Despesas Fixas (Apenas pagas)
    Object.values(dataMap.fixosMes).forEach(d => {
        if (d.status === 'pago' && pagamentosQueAfetamSaldo.includes(d.formaPagamento)) {
            dashboardState.detalheFixas += d.valor;
        }
    });

    // 3c. Pendências (Apenas 'euDevo' pagas)
    Object.values(dataMap.pendenciasMes).forEach(d => {
        if (d.tipo === 'euDevo' && d.status === 'pago' && pagamentosQueAfetamSaldo.includes(d.formaPagamento)) {
            dashboardState.detalheDividas += d.valor;
        }
    });

    dashboardState.totalDespesas = dashboardState.detalheVariaveis + dashboardState.detalheFixas + dashboardState.detalheDividas;
    dashboardState.lucroLiquido = dashboardState.totalEntradas - dashboardState.totalDespesas;

    // 4. Processa Cartões
    dashboardState.totalLimites = Object.values(dataMap.cartoesConfig).reduce((sum, c) => sum + (c.limiteTotal || 0), 0);

    // 5. Prepara dados para os gráficos
    dashboardState.dadosGraficoCat = prepararDadosGraficoCategorias(dataMap.despesasMes, dataMap.fixosMes, dataMap.pendenciasMes);
    dashboardState.dadosResumoAnual = prepararDadosResumoAnual(dataMap.entradasAno, dataMap.despesasAno);
    
    // 6. Renderiza todos os componentes
    renderKPIs();
    renderMetas();
    renderResumoDespesas(); 
    renderGraficoCategorias();
    renderResumoAnual(); 
    
    // (Resumo de cartões e gráfico de linha são chamados por renderResumoAnual)
}

// ===============================================================
// 2. RENDERIZAÇÃO DOS COMPONENTES
// ===============================================================

function renderKPIs() {
    kpiEntradasEl.textContent = formatCurrency(dashboardState.totalEntradas);
    kpiDespesasEl.textContent = formatCurrency(dashboardState.totalDespesas);
    kpiLucroEl.textContent = formatCurrency(dashboardState.lucroLiquido);
    kpiSaldoEl.textContent = formatCurrency(dashboardState.saldoAcumulado);
    kpiHorasEl.textContent = formatHoras(dashboardState.horasTotal);
    kpiKmEl.textContent = `${dashboardState.kmTotal.toFixed(1)} km`;

    // Lógica das cores
    kpiLucroEl.className = dashboardState.lucroLiquido < 0 ? 'text-danger' : 'text-success';
    kpiSaldoEl.className = dashboardState.saldoAcumulado < 0 ? 'text-danger' : 'text-success';
}

function renderMetas() {
    // Meta de Entrada
    const percEntrada = (dashboardState.metaEntrada > 0) ? (dashboardState.totalEntradas / dashboardState.metaEntrada) * 100 : 0;
    const restanteEntrada = dashboardState.metaEntrada - dashboardState.totalEntradas;
    metaEntradaProgress.style.width = `${Math.min(percEntrada, 100)}%`;
    metaEntradaPercent.textContent = `${percEntrada.toFixed(1)}%`;
    metaEntradaValor.textContent = formatCurrency(dashboardState.metaEntrada);
    metaEntradaRestante.textContent = (restanteEntrada > 0) ? `${formatCurrency(restanteEntrada)} restantes` : `${formatCurrency(Math.abs(restanteEntrada))} acima`;
    
    // Meta de Gasto
    const percGasto = (dashboardState.metaGasto > 0) ? (dashboardState.totalDespesas / dashboardState.metaGasto) * 100 : 0;
    const restanteGasto = dashboardState.metaGasto - dashboardState.totalDespesas;
    metaGastoProgress.style.width = `${Math.min(percGasto, 100)}%`;
    metaGastoPercent.textContent = `${percGasto.toFixed(1)}%`;
    metaGastoValor.textContent = formatCurrency(dashboardState.metaGasto);
    metaGastoRestante.textContent = (restanteGasto > 0) ? `${formatCurrency(restanteGasto)} restantes` : `${formatCurrency(Math.abs(restanteGasto))} acima`;
    
    // Lógica de Cor da Barra de Gasto
    metaGastoProgress.style.backgroundColor = (percGasto > 100) ? 'var(--danger-color)' : 'var(--success-color)';
}

function renderResumoDespesas() {
    tbodyResumoDespesas.innerHTML = `
        <tr>
            <td><span class="tag info">Variáveis</span></td>
            <td>Pagamentos (Saldo, Pix, Dinheiro)</td>
            <td>${formatCurrency(dashboardState.detalheVariaveis)}</td>
        </tr>
        <tr>
            <td><span class="tag info">Fixas</span></td>
            <td>Contas Pagas (Saldo, Pix, Dinheiro)</td>
            <td>${formatCurrency(dashboardState.detalheFixas)}</td>
        </tr>
        <tr>
            <td><span class="tag info">Dívidas</span></td>
            <td>Pendências Pagas (Saldo, Pix, Dinheiro)</td>
            <td>${formatCurrency(dashboardState.detalheDividas)}</td>
        </tr>
        <tr class="total-geral">
            <td colspan="2">Total Despesas (Débito)</td>
            <td>${formatCurrency(dashboardState.totalDespesas)}</td>
        </tr>
    `;
}

// v6.0: ATUALIZADO CAMINHOS PARA 'usuarios/'
async function handleSalvarMeta(e) {
    e.preventDefault();
    const valor = parseCurrency(inputMetaEntrada.value);
    const metaRef = ref(db, `usuarios/${userId}/metas`);
    try {
        await set(metaRef, { valor: valor });
        dashboardState.metaEntrada = valor;
        renderMetas();
        modalMetaEntrada.style.display = 'none';
    } catch (error) {
        console.error("Erro ao salvar meta:", error);
    }
}

// v6.0: ATUALIZADO CAMINHOS PARA 'usuarios/'
async function handleSalvarMetaGasto(e) {
    e.preventDefault();
    const valor = parseCurrency(inputMetaGasto.value);
    const metaGastoRef = ref(db, `usuarios/${userId}/metas_gasto`);
    try {
        await set(metaGastoRef, { valor: valor });
        dashboardState.metaGasto = valor;
        renderMetas();
        modalMetaGasto.style.display = 'none';
    } catch (error) {
        console.error("Erro ao salvar meta de gasto:", error);
    }
}

// ===============================================================
// 3. LÓGICA DOS GRÁFICOS E RESUMOS
// ===============================================================

// (v5.1) Função de cálculo
function prepararDadosGraficoCategorias(despesasMes, fixosMes, pendenciasMes) {
    const dadosGraficoCat = {};

    // 1. Despesas Variáveis (ignora 'Fatura' pois é só transferência)
    Object.values(despesasMes).forEach(d => {
        if (d.categoria === 'Fatura') return;
        const cat = d.categoria || 'Outros';
        dadosGraficoCat[cat] = (dadosGraficoCat[cat] || 0) + d.valor;
    });

    // 2. Despesas Fixas (todas, pagas ou não, para o gráfico de 'Gastos do Mês')
    Object.values(fixosMes).forEach(d => {
        const cat = d.categoria || 'Outros';
        dadosGraficoCat[cat] = (dadosGraficoCat[cat] || 0) + d.valor;
    });

    // 3. Pendências ('euDevo', todas, pagas ou não)
    Object.values(pendenciasMes).forEach(d => {
        if (d.tipo === 'euDevo') {
            const cat = "Dívidas";
            dadosGraficoCat[cat] = (dadosGraficoCat[cat] || 0) + d.valor;
        }
    });

    return dadosGraficoCat;
}

// (v5.1) Função de renderização
function renderGraficoCategorias() {
    const data = dashboardState.dadosGraficoCat;
    const ctx = document.getElementById('grafico-categorias').getContext('2d');
    const placeholder = document.getElementById('grafico-cat-placeholder');

    if (graficoCategorias) graficoCategorias.destroy();

    const labels = Object.keys(data);
    const valores = Object.values(data);

    if (labels.length === 0) {
        if(placeholder) placeholder.style.display = 'block';
        return;
    }
    if(placeholder) placeholder.style.display = 'none';
    
    // Cores (pode adicionar mais)
    const cores = [
        '#4A90E2', '#50E3C2', '#F5A623', '#D0021B', '#BD10E0', 
        '#9013FE', '#B8E986', '#7ED321', '#417505', '#F8E71C'
    ];

    graficoCategorias = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: valores,
                backgroundColor: cores,
                borderColor: 'rgba(0,0,0,0)' // Bordas transparentes
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: getComputedStyle(document.body).getPropertyValue('--text-color'),
                        boxWidth: 20,
                        padding: 15
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) label += ': ';
                            label += formatCurrency(context.raw);
                            
                            const total = valores.reduce((a, b) => a + b, 0);
                            const percent = ((context.raw / total) * 100).toFixed(1);
                            label += ` (${percent}%)`;
                            return label;
                        }
                    }
                }
            }
        }
    });
}

// (v5.1) Função de cálculo
function prepararDadosResumoAnual(entradasAno, despesasAno) {
    const resumo = {};
    const meses = Array.from({length: 12}, (_, i) => `${currentYear}-${(i + 1).toString().padStart(2, '0')}`);

    meses.forEach(mesKey => {
        resumo[mesKey] = { entradas: 0, despesas: 0, lucro: 0 };
    });

    // Processa Entradas
    Object.keys(entradasAno).forEach(mesKey => {
        if (mesKey.startsWith(currentYear)) {
            const mesData = entradasAno[mesKey];
            const total = Object.values(mesData).reduce((sum, e) => sum + e.valor, 0);
            resumo[mesKey].entradas = total;
        }
    });

    // Processa Despesas (Apenas as que saem do saldo)
    const pagamentosQueAfetamSaldo = ['Saldo em Caixa', 'Pix', 'Dinheiro'];
    Object.keys(despesasAno).forEach(mesKey => {
        if (mesKey.startsWith(currentYear)) {
            const mesData = despesasAno[mesKey];
            const total = Object.values(mesData)
                .filter(d => pagamentosQueAfetamSaldo.includes(d.formaPagamento))
                .reduce((sum, d) => sum + d.valor, 0);
            resumo[mesKey].despesas = total;
        }
    });
    
    // (Ainda precisamos adicionar Fixos e Pendências pagas ao resumo anual,
    // mas isso requer buscar todos os nós 'fixos' e 'pendencias' do ano,
    // o que pode ficar lento. Por agora, 'despesas' é o principal.)

    // Calcula Lucro
    meses.forEach(mesKey => {
        resumo[mesKey].lucro = resumo[mesKey].entradas - resumo[mesKey].despesas;
    });
    
    return resumo;
}

// (v5.1) Função de renderização
function renderResumoAnual() {
    const data = dashboardState.dadosResumoAnual;
    tbodyResumoAnual.innerHTML = '';
    let totalEntradas = 0;
    let totalDespesas = 0;

    const meses = Object.keys(data).sort(); // Garante a ordem

    meses.forEach(mesKey => {
        const [ano, mes] = mesKey.split('-');
        const mesNome = new Date(ano, mes - 1, 1).toLocaleString('pt-BR', { month: 'short' });
        
        const mesData = data[mesKey];
        totalEntradas += mesData.entradas;
        totalDespesas += mesData.despesas;
        
        const lucroClass = mesData.lucro < 0 ? 'text-danger' : 'text-success';
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${mesNome.toUpperCase()}./${ano}</td>
            <td class="text-success">${formatCurrency(mesData.entradas)}</td>
            <td class="text-danger">${formatCurrency(mesData.despesas)}</td>
            <td class="${lucroClass}">${formatCurrency(mesData.lucro)}</td>
        `;
        tbodyResumoAnual.appendChild(tr);
    });

    // Linha Total
    const trTotal = document.createElement('tr');
    trTotal.className = 'total-row'; // (Para estilização de CSS)
    const lucroTotal = totalEntradas - totalDespesas;
    const lucroTotalClass = lucroTotal < 0 ? 'text-danger' : 'text-success';
    trTotal.innerHTML = `
        <td><strong>Total Ano</strong></td>
        <td><strong>${formatCurrency(totalEntradas)}</strong></td>
        <td><strong>${formatCurrency(totalDespesas)}</strong></td>
        <td class="<strong>${lucroTotalClass}</strong>"><strong>${formatCurrency(lucroTotal)}</strong></td>
    `;
    tbodyResumoAnual.appendChild(trTotal);
}


// ---- Funções Utilitárias (Horas e Modais) ----
function formatHoras(totalMinutos) {
    const h = Math.floor(totalMinutos / 60);
    const m = totalMinutos % 60;
    return `${h}h ${m.toString().padStart(2, '0')}m`;
}

function showModal(modalId, confirmFn) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    modal.style.display = 'flex';

    const btnConfirm = document.getElementById('modal-btn-confirm');
    const btnCancel = document.getElementById('modal-btn-cancel');

    const newBtnConfirm = btnConfirm.cloneNode(true);
    const newBtnCancel = btnCancel.cloneNode(true);
    
    newBtnConfirm.onclick = confirmFn;
    newBtnCancel.onclick = () => hideModal(modalId);
    
    btnConfirm.parentNode.replaceChild(newBtnConfirm, btnConfirm);
    btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if(modal) {
        modal.style.display = 'none';
    }
}