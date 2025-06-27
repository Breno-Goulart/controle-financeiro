// Importa as funções necessárias do Firebase SDK (versões modulares padrão)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, 
    signInAnonymously, 
    signInWithCustomToken, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    onSnapshot, 
    addDoc, 
    setDoc, 
    doc, 
    deleteDoc, 
    query, 
    where, 
    getDocs 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Credenciais do Firebase (certifique-se de que correspondem às suas configurações do Firebase Project)
const firebaseConfig = {
    apiKey: "AIzaSyD998NH9Vco8Yfk-7n3XgMjLW-LkQkAgLA", // Sua chave de API
    authDomain: "controle-financeiro-c1a0b.firebaseapp.com",
    projectId: "controle-financeiro-c1a0b",
    storageBucket: "controle-financeiro-c1a0b.firebaseapp.com",
    messagingSenderId: "471645962387",
    appId: "1:471645962387:web:fd500fdeb62475596c0d66"
};

// Variáveis globais do ambiente Canvas/CodePen (usando o projectId como appId para esta demonstração)
const appId = firebaseConfig.projectId; 
// __initial_auth_token é uma variável injetada pelo ambiente Canvas/Google
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

let app; // Instância do Firebase App
let db;  // Instância do Firestore
let auth; // Instância do Auth
let userId = null; // ID de autenticação individual do utilizador
let currentHouseholdId = null; // O ID do grupo/família que está a ser usado para os lançamentos
let lancamentosCollection; // Referência à coleção Firestore para lançamentos
let isAuthReady = false; // Flag para indicar se a autenticação foi concluída

const RECURRING_MONTHS_AHEAD = 11; // Gerar para o mês atual + 11 meses à frente (total de 12)

// Referências aos elementos do DOM (serão atribuídas em initializeUI)
let lancamentoForm; 
let diaInput;
let mesInput;
let anoInput;
let descricaoInput;
let valorInput;
let categoriaSelect;
let tipoEntradaRadio;
let tipoSaidaRadio;
let addGastoBtn;
let gastosTableBody;
let totalEntradasSpan;
let totalSaidasSpan;
let mediaDiariaSpan;
let saldoMesSpan;

// Elementos para o filtro de mês e ano
let filterMesGroup; // A div que contém os checkboxes de mês
let filterMesAll; // Checkbox "Todos os Meses"
let monthFilterCheckboxes; // NodeList dos checkboxes individuais de mês
let filterAnoSelect; // Select para filtrar por ano

// Mensagem de "nenhum lançamento"
let noExpensesMessage;

// Campos de parcelamento
let parcelaAtualSelect;
let totalParcelasSelect;
let parcelaFieldsDiv;

// Elementos para seleção e exclusão em massa
let userIdDisplay;
let joinHouseholdIdInput;
let setHouseholdIdBtn;
let selectAllCheckbox;
let deleteSelectedBtn;
let selectedLancamentosIds = new Set(); // Conjunto para armazenar IDs de lançamentos selecionados

// Campo de cobrança recorrente
let isRecurringCheckbox;

// Variável para armazenar os lançamentos do Firestore (cache local)
let lancamentos = [];

// Elementos do resumo redesenhado
let saldoStatusBar;
let saldoStatusText;

// Referências para o modal de parar recorrência
let stopRecurringMonthsModalOverlay;
let stopFromCurrentMonthCheckbox;
let currentMonthAndYearSpan;
let specificMonthsSelectionDiv;
let monthStopCheckboxes; // NodeList dos checkboxes de mês dentro do modal de parada de recorrência
let stopRecurringYearSelect;
let cancelStopRecurringBtn;
let confirmStopRecurringBtn;
let currentRecurringGroupId = null; // Para armazenar o ID do grupo de recorrência que está a ser parado

// Variável para armazenar a data original de uma série de parcelas
let originalInstallmentDate = {
    day: null,
    month: null,
    year: null
};

// Campo de busca
let searchBarInput;

// Elementos para feedback de categorização automática
let categoryLoadingIndicator;

// Elementos para o modal de escolha de edição recorrente/parcelada
let editRecurringChoiceModalOverlay;
let editRecurringChoiceMessage;
let applyToThisBtn;
let applyToFutureBtn;
let cancelEditRecurringBtn;
let pendingEditData = null; // Objeto para armazenar o estado da edição antes de abrir o modal de escolha

/**
 * Exibe uma caixa de mensagem modal personalizada.
 * @param {string} title O título da mensagem.
 * @param {string} message O conteúdo da mensagem.
 */
function showMessageBox(title, message) {
    const messageBoxOverlay = document.getElementById('messageBoxOverlay');
    const messageBoxTitle = document.getElementById('messageBoxTitle');
    const messageBoxMessage = document.getElementById('messageBoxMessage');
    const messageBoxOkBtn = document.getElementById('messageBoxOkBtn');

    if (!messageBoxOverlay || !messageBoxTitle || !messageBoxMessage || !messageBoxOkBtn) {
        console.error("Elementos do modal de mensagem não encontrados. Não é possível exibir a mensagem.");
        alert(`${title}\n\n${message}`); // Fallback para alert
        return;
    }

    messageBoxTitle.textContent = title;
    messageBoxMessage.textContent = message;
    messageBoxOverlay.classList.remove('hidden');

    // Remove qualquer listener anterior para evitar múltiplas execuções
    const oldBtn = messageBoxOkBtn.cloneNode(true);
    messageBoxOkBtn.parentNode.replaceChild(oldBtn, messageBoxOkBtn);
    document.getElementById('messageBoxOkBtn').addEventListener('click', () => {
        messageBoxOverlay.classList.add('hidden');
    });
}

/**
 * Exibe uma caixa de confirmação modal personalizada.
 * @param {string} title O título da confirmação.
 * @param {string} message O conteúdo da confirmação.
 * @returns {Promise<boolean>} Uma promessa que resolve para true se 'Sim' for clicado, false caso contrário.
 */
function showConfirmBox(title, message) {
    return new Promise((resolve) => {
        const confirmBoxOverlay = document.getElementById('confirmBoxOverlay');
        const confirmBoxTitle = document.getElementById('confirmBoxTitle');
        const confirmBoxMessage = document.getElementById('confirmBoxMessage');
        const confirmBoxYesBtn = document.getElementById('confirmBoxYesBtn');
        const confirmBoxNoBtn = document.getElementById('confirmBoxNoBtn');

        if (!confirmBoxOverlay || !confirmBoxTitle || !confirmBoxMessage || !confirmBoxYesBtn || !confirmBoxNoBtn) {
            console.error("Elementos do modal de confirmação não encontrados. Não é possível exibir a confirmação.");
            resolve(confirm(`${title}\n\n${message}`)); // Fallback para confirm
            return;
        }

        confirmBoxTitle.textContent = title;
        confirmBoxMessage.textContent = message;
        confirmBoxOverlay.classList.remove('hidden');

        // Remove listeners anteriores para evitar múltiplas execuções
        const oldYesBtn = confirmBoxYesBtn.cloneNode(true);
        const oldNoBtn = confirmBoxNoBtn.cloneNode(true);
        confirmBoxYesBtn.parentNode.replaceChild(oldYesBtn, confirmBoxYesBtn);
        confirmBoxNoBtn.parentNode.replaceChild(oldNoBtn, confirmBoxNoBtn);

        document.getElementById('confirmBoxYesBtn').addEventListener('click', () => {
            confirmBoxOverlay.classList.add('hidden');
            resolve(true);
        });

        document.getElementById('confirmBoxNoBtn').addEventListener('click', () => {
            confirmBoxOverlay.classList.add('hidden');
            resolve(false);
        });
    });
}

/**
 * Lida com a mudança no checkbox "Todos os Meses" no filtro.
 * @param {Event} event O objeto do evento de mudança.
 */
function handleFilterMesAllChange(event) {
    const isChecked = event.target.checked;
    monthFilterCheckboxes.forEach(checkbox => {
        checkbox.checked = isChecked;
    });
    // Dispara a atualização do resumo e da renderização após a seleção
    updateSummary();
    renderLancamentos();
}

/**
 * Lida com a mudança em um checkbox de mês individual no filtro.
 * @param {Event} event O objeto do evento de mudança.
 */
function handleMonthFilterCheckboxChange(event) {
    updateMonthFilterCheckboxesState(); // Atualiza o estado do "Todos os Meses"
    // Dispara a atualização do resumo e da renderização
    updateSummary();
    renderLancamentos();
}

/**
 * Atualiza o estado do checkbox "Todos os Meses" (marcado/indeterminado/desmarcado).
 */
function updateMonthFilterCheckboxesState() {
    const allMonthCheckboxes = Array.from(monthFilterCheckboxes);
    const checkedMonthCheckboxes = allMonthCheckboxes.filter(cb => cb.checked);

    if (filterMesAll) {
        if (checkedMonthCheckboxes.length === 0) {
            filterMesAll.checked = false;
            filterMesAll.indeterminate = false;
        } else if (checkedMonthCheckboxes.length === allMonthCheckboxes.length) {
            filterMesAll.checked = true;
            filterMesAll.indeterminate = false;
        } else {
            filterMesAll.checked = false;
            filterMesAll.indeterminate = true;
        }
    }
}

/**
 * Retorna o nome do mês a partir do número.
 * @param {number} monthNumber O número do mês (1-12).
 * @returns {string} O nome do mês em português.
 */
function getMonthName(monthNumber) {
    const date = new Date();
    date.setMonth(monthNumber - 1); // Meses em JS são 0-11
    return date.toLocaleString('pt-BR', { month: 'long' });
}

/**
 * Permite a edição de uma célula na tabela.
 * Cria um campo de input/select no lugar do texto para edição.
 * @param {HTMLElement} cellElement O elemento TD clicado para edição.
 */
async function handleEditCellClick(cellElement) {
    if (!isAuthReady) {
        showMessageBox('Aguarde', 'Aplicação ainda carregando, por favor, aguarde.');
        return;
    }

    const lancamentoId = cellElement.dataset.id;
    const field = cellElement.dataset.field;
    const currentLancamento = lancamentos.find(l => l.id === lancamentoId);

    if (!currentLancamento) return;
    if (cellElement.querySelector('input, select')) return; // Já está em modo de edição

    let inputElement;

    // Lógica para criar o input/select apropriado
    if (field === 'dataCompleta') {
        inputElement = document.createElement('input');
        inputElement.type = 'date';
        const editYear = currentLancamento.originalPurchaseAno || currentLancamento.ano;
        const editMonth = currentLancamento.originalPurchaseMes || currentLancamento.mes;
        const editDay = currentLancamento.originalPurchaseDia || currentLancamento.dia;

        const fullDateForEdit = new Date(editYear, editMonth - 1, editDay);
        inputElement.value = isNaN(fullDateForEdit.getTime()) ? '' : fullDateForEdit.toISOString().split('T')[0];
        inputElement.className = 'w-full p-1 border rounded-md text-sm';
    } else {
        const originalValue = currentLancamento[field];
        switch (field) {
            case 'descricao':
                inputElement = document.createElement('input');
                inputElement.type = 'text';
                const baseDesc = currentLancamento.descricao.split(' (')[0]; // Pega a descrição base (sem "(X/Y)")
                inputElement.value = baseDesc;
                inputElement.className = 'w-full p-1 border rounded-md text-sm';
                break;
            case 'valor':
                inputElement = document.createElement('input');
                inputElement.type = 'number';
                inputElement.value = originalValue;
                inputElement.step = '0.01';
                inputElement.className = 'w-full p-1 border rounded-md text-sm';
                break;
            case 'categoria':
                inputElement = document.createElement('select');
                inputElement.className = 'w-full p-1 border rounded-md text-sm';
                const categories = ["Salário", "Renda Extra", "Investimento", "Alimentação", "Transporte", "Lazer", "Moradia", "Contas", "Educação", "Saúde", "Outros"];
                categories.forEach(cat => {
                    const option = document.createElement('option');
                    option.value = cat;
                    option.textContent = cat;
                    if (originalValue === cat) {
                        option.selected = true;
                    }
                    inputElement.appendChild(option);
                });
                break;
            case 'tipo':
                inputElement = document.createElement('select');
                inputElement.className = 'w-full p-1 border rounded-md text-sm';
                const types = [{ value: 'entrada', text: 'Entrada' }, { value: 'saida', text: 'Saída' }];
                types.forEach(type => {
                    const option = document.createElement('option');
                    option.value = type.value;
                    option.textContent = type.text;
                    if (originalValue === type.value) {
                        option.selected = true;
                    }
                    inputElement.appendChild(option);
                });
                break;
            case 'parcelaAtual':
            case 'totalParcelas':
                inputElement = document.createElement('select');
                inputElement.className = 'w-full p-1 border rounded-md text-sm';
                inputElement.innerHTML = '<option value="0">-</option>'; // Opção para "não aplicável"
                for (let i = 1; i <= 12; i++) {
                    const option = document.createElement('option');
                    option.value = i;
                    option.textContent = i;
                    if (originalValue === i) {
                        option.selected = true;
                    }
                    inputElement.appendChild(option);
                }
                break;
            default:
                return; // Não editar campos não mapeados
        }
    }

    const originalCellContent = cellElement.innerHTML; // Salva o conteúdo original da célula
    cellElement.innerHTML = ''; // Limpa a célula
    cellElement.appendChild(inputElement); // Adiciona o campo de input/select
    inputElement.focus(); // Coloca o foco no novo campo

    const saveChanges = async () => {
        let newValue;
        let updateData = {}; // Objeto para armazenar as atualizações
        let isValid = true; // Flag para validação

        if (field === 'dataCompleta') {
            if (!inputElement.value) {
                showMessageBox('Erro de Validação', 'A data não pode ser vazia. Por favor, selecione uma data.');
                isValid = false;
            } else {
                const dateObj = new Date(inputElement.value + 'T00:00:00');
                if (isNaN(dateObj.getTime())) {
                    showMessageBox('Erro de Validação', 'Data inválida. Por favor, selecione uma data válida.');
                    isValid = false;
                } else {
                    updateData.originalPurchaseDia = dateObj.getDate();
                    updateData.originalPurchaseMes = dateObj.getMonth() + 1;
                    updateData.originalPurchaseAno = dateObj.getFullYear();
                    // Atualiza dia, mês, ano do lançamento para refletir a nova data (se não for parcelado)
                    if (!currentLancamento.parcelaAtual || currentLancamento.parcelaAtual === 0) {
                        updateData.dia = dateObj.getDate();
                        updateData.mes = dateObj.getMonth() + 1;
                        updateData.ano = dateObj.getFullYear();
                    }
                }
            }
        } else {
            // Lógica para determinar o novo valor com base no tipo de campo
            if (inputElement.value === '0' || inputElement.value === '') {
                newValue = null; // Para '0' ou vazio em selects de parcela
            } else if (field === 'parcelaAtual' || field === 'totalParcelas') {
                newValue = parseInt(inputElement.value);
            } else if (field === 'valor') {
                newValue = parseFloat(inputElement.value);
            } else {
                newValue = inputElement.value.trim();
            }

            // Validações básicas
            if (field === 'valor') {
                if (isNaN(newValue) || (newValue !== null && newValue <= 0)) {
                    showMessageBox('Erro de Validação', 'Valor inválido. Por favor, insira um número positivo.');
                    isValid = false;
                }
            } else if (field === 'parcelaAtual' || field === 'totalParcelas') {
                if (newValue !== null && (isNaN(newValue) || newValue < 0)) {
                    showMessageBox('Erro de Validação', 'Parcela inválida. Por favor, insira um número positivo ou "-".');
                    isValid = false;
                }
            } else if (!newValue && (field === 'descricao' || field === 'categoria' || field === 'tipo')) {
                showMessageBox('Erro de Validação', 'O campo não pode ser vazio.');
                isValid = false;
            }
            updateData[field] = newValue;
        }

        // Se o valor não é válido, exibe mensagem e restaura a célula
        if (!isValid) {
            cellElement.innerHTML = originalCellContent;
            return;
        }

        // Verifica se houve mudança real no valor do campo
        const hasChanged = Object.keys(updateData).some(key => {
            // Comparação para 'descricao' precisa ser inteligente para lidar com "(X/Y)"
            if (key === 'descricao' && currentLancamento.parcelaAtual && currentLancamento.totalParcelas) {
                const currentBaseDesc = currentLancamento.descricao.split(' (')[0];
                return updateData[key] !== currentBaseDesc;
            }
            return updateData[key] !== currentLancamento[key];
        });

        if (!hasChanged) {
            cellElement.innerHTML = originalCellContent; // Restaura o conteúdo original
            return; // Sai da função
        }

        // Se o valor é válido e houve alguma mudança
        if (hasChanged) {
            // Lógica para ajustar outros campos se o tipo mudar
            if (field === 'tipo') {
                if (updateData.tipo === 'entrada') {
                    updateData.parcelaAtual = null;
                    updateData.totalParcelas = null;
                    updateData.isRecurring = false;
                    updateData.recurringGroupId = null;
                    updateData.originalPurchaseDia = null;
                    updateData.originalPurchaseMes = null;
                    updateData.originalPurchaseAno = null;
                } else if (updateData.tipo === 'saida' && !currentLancamento.isRecurring && currentLancamento.parcelaAtual === null && currentLancamento.totalParcelas === null) {
                    // Para itens que não eram recorrentes/parcelados e se tornam saída, define como 1/1
                    updateData.parcelaAtual = 1;
                    updateData.totalParcelas = 1;
                    if (!currentLancamento.originalPurchaseDia) {
                        updateData.originalPurchaseDia = currentLancamento.dia;
                        updateData.originalPurchaseMes = currentLancamento.mes;
                        updateData.originalPurchaseAno = currentLancamento.ano;
                    }
                }
            }
            // Garante que isRecurring seja false se parcelaAtual ou totalParcelas são definidos
            if (field === 'parcelaAtual' || field === 'totalParcelas') {
                if (updateData[field] !== null && updateData[field] !== 0) {
                    updateData.isRecurring = false;
                    updateData.recurringGroupId = null;
                } else {
                    updateData.originalPurchaseDia = null;
                    updateData.originalPurchaseMes = null;
                    updateData.originalPurchaseAno = null;
                }
            }

            // Se o lançamento é recorrente OU parcelado E o campo editado NÃO É A DATA
            if ((currentLancamento.isRecurring && currentLancamento.recurringGroupId || (currentLancamento.parcelaAtual && currentLancamento.totalParcelas && currentLancamento.originalPurchaseAno)) && field !== 'dataCompleta') {
                pendingEditData = {
                    id: lancamentoId,
                    field,
                    newValue: updateData[field],
                    currentLancamento, // Passa o lançamento atual completo
                    type: currentLancamento.isRecurring ? 'recurring' : 'installment'
                };
                // Atualiza a mensagem do modal
                editRecurringChoiceMessage.textContent = `Este é um lançamento ${pendingEditData.type === 'recurring' ? 'recorrente' : 'parcelado'}. Como você gostaria de aplicar esta edição?`;
                editRecurringChoiceModalOverlay.classList.remove('hidden'); // Mostra o modal de escolha
            } else {
                // Se não for recorrente, nem parcelado, ou se a data for editada (que não propaga em massa)
                try {
                    const docRef = doc(db, lancamentosCollection.path, lancamentoId);
                    await setDoc(docRef, updateData, { merge: true });
                    showMessageBox('Sucesso', 'Lançamento atualizado com sucesso!');
                } catch (e) {
                    console.error("Erro ao atualizar documento: ", e);
                    showMessageBox('Erro', 'Erro ao atualizar lançamento. Por favor, tente novamente.');
                }
            }
        } else {
            cellElement.innerHTML = originalCellContent; // Restaura o conteúdo original da célula
        }
    };

    // Event listeners para salvar as mudanças ao perder o foco ou pressionar Enter
    inputElement.addEventListener('blur', saveChanges);
    inputElement.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            inputElement.blur();
        }
    });
}

/**
 * Aplica a edição a um único lançamento.
 * @param {string} id O ID do lançamento.
 * @param {string} field O campo a ser atualizado.
 * @param {*} newValue O novo valor do campo.
 * @param {object} currentLancamento O objeto do lançamento atual.
 */
async function applyEditToSingleLancamento(id, field, newValue, currentLancamento) {
    const updateData = {};
    // Lógica para ajustar a descrição de parcelas se o campo for 'descricao'
    if (field === 'descricao' && currentLancamento.parcelaAtual && currentLancamento.totalParcelas) {
        const installmentPartMatch = currentLancamento.descricao.match(/\s\((\d+\/\d+)\)$/);
        const installmentPart = installmentPartMatch ? installmentPartMatch[0] : '';
        updateData[field] = `${newValue.trim()}${installmentPart}`;
    } else {
        updateData[field] = newValue;
    }
    // Lógica para ajustar outros campos se o tipo mudar (copiado da lógica original de saveChanges)
    if (field === 'tipo') {
        if (newValue === 'entrada') {
            updateData.parcelaAtual = null;
            updateData.totalParcelas = null;
            updateData.isRecurring = false;
            updateData.recurringGroupId = null;
            updateData.originalPurchaseDia = null;
            updateData.originalPurchaseMes = null;
            updateData.originalPurchaseAno = null;
        } else if (newValue === 'saida' && !currentLancamento.isRecurring && currentLancamento.parcelaAtual === null && currentLancamento.totalParcelas === null) {
            updateData.parcelaAtual = 1;
            updateData.totalParcelas = 1;
            if (!currentLancamento.originalPurchaseDia) {
                updateData.originalPurchaseDia = currentLancamento.dia;
                updateData.originalPurchaseMes = currentLancamento.mes;
                updateData.originalPurchaseAno = currentLancamento.ano;
            }
        }
    }
    if (field === 'parcelaAtual' || field === 'totalParcelas') {
        if (newValue !== null && newValue !== 0) {
            updateData.isRecurring = false;
            updateData.recurringGroupId = null;
        } else {
            updateData.originalPurchaseDia = null;
            updateData.originalPurchaseMes = null;
            updateData.originalPurchaseAno = null;
        }
    }
    try {
        const docRef = doc(db, lancamentosCollection.path, id);
        await setDoc(docRef, updateData, { merge: true });
        showMessageBox('Sucesso', 'Lançamento atualizado com sucesso!');
    } catch (e) {
        console.error("Erro ao atualizar documento: ", e);
        showMessageBox('Erro', 'Erro ao atualizar lançamento. Por favor, tente novamente.');
    }
}

/**
 * Aplica a edição a todos os lançamentos futuros do mesmo grupo recorrente ou série de parcelas.
 * @param {string} idToUpdate O ID do lançamento que foi editado.
 * @param {string} field O campo a ser atualizado.
 * @param {*} newValue O novo valor do campo.
 * @param {object} baseLancamento O objeto do lançamento base (o que foi editado para iniciar a propagação).
 * @param {string} editType O tipo de edição: 'recurring' ou 'installment'.
 */
async function applyEditToSeriesLancamentos(idToUpdate, field, newValue, baseLancamento, editType) {
    if (!baseLancamento) {
        showMessageBox('Erro', 'Dados do lançamento base não fornecidos.');
        return;
    }
    const confirmation = await showConfirmBox('Confirmar Edição em Massa', 'Esta ação irá atualizar TODOS os lançamentos futuros (ou da série) desta categoria. Tem certeza?');
    if (!confirmation) {
        return;
    }
    showMessageBox('Aguarde', 'Atualizando lançamentos em massa...');
    document.getElementById('messageBoxOkBtn').classList.add('hidden'); // Esconde o botão OK durante o processamento
    try {
        const batchUpdates = [];
        let q;
        console.log(`[applyEditToSeriesLancamentos] Iniciando edição em massa para:`);
        console.log(`[applyEditToSeriesLancamentos] ID do lançamento base (editado): ${idToUpdate}`);
        console.log(`[applyEditToSeriesLancamentos] Campo a ser atualizado: ${field}`);
        console.log(`[applyEditToSeriesLancamentos] Novo valor (base): ${newValue}`);
        console.log(`[applyEditToSeriesLancamentos] Tipo de edição: ${editType}`);

        if (editType === 'recurring' && baseLancamento.recurringGroupId) {
            // Para lançamentos recorrentes, atualiza todos com o mesmo recurringGroupId
            q = query(lancamentosCollection, 
                      where("recurringGroupId", "==", baseLancamento.recurringGroupId),
                      where("dia", ">=", baseLancamento.dia),
                      where("mes", ">=", baseLancamento.mes),
                      where("ano", ">=", baseLancamento.ano)
                     );
            console.log(`[applyEditToSeriesLancamentos] Consulta para recorrentes com recurringGroupId: ${baseLancamento.recurringGroupId}`);
            // Se o campo for a descrição, precisamos garantir que o formato (X/Y) seja preservado para as parcelas existentes
            if (field === 'descricao' && baseLancamento.parcelaAtual && baseLancamento.totalParcelas) {
                const installmentPartMatch = baseLancamento.descricao.match(/\s\((\d+\/\d+)\)$/);
                const installmentPart = installmentPartMatch ? installmentPartMatch[0] : '';
                newValue = `${newValue.trim()}${installmentPart}`;
            }
        } else if (editType === 'installment' && baseLancamento.originalPurchaseAno) {
            // Para lançamentos parcelados, atualiza todos da mesma série
            q = query(lancamentosCollection, 
                      where("originalPurchaseDia", "==", baseLancamento.originalPurchaseDia),
                      where("originalPurchaseMes", "==", baseLancamento.originalPurchaseMes),
                      where("originalPurchaseAno", "==", baseLancamento.originalPurchaseAno),
                      where("descricao", "==", baseLancamento.descricao.split(' (')[0]) // Busca pela descrição base
                     );
            console.log(`[applyEditToSeriesLancamentos] Consulta para parcelados com originalPurchaseDate: ${baseLancamento.originalPurchaseDia}/${baseLancamento.originalPurchaseMes}/${baseLancamento.originalPurchaseAno}`);
            // Se o campo for a descrição, precisamos reconstruir a descrição para cada parcela (X/Y)
            if (field === 'descricao') {
                const querySnapshot = await getDocs(q);
                for (const docSnapshot of querySnapshot.docs) {
                    const existingLancamento = docSnapshot.data();
                    const installmentPartMatch = existingLancamento.descricao.match(/\s\((\d+\/\d+)\)$/);
                    const installmentPart = installmentPartMatch ? installmentPartMatch[0] : '';
                    const updatedDescription = `${newValue.trim()}${installmentPart}`;
                    batchUpdates.push({ id: docSnapshot.id, data: { [field]: updatedDescription } });
                    console.log(`[applyEditToSeriesLancamentos] Atualizando parcela: ${docSnapshot.id}, descrição: ${updatedDescription}`);
                }
            }
        } else {
            showMessageBox('Erro', 'Tipo de edição ou dados do lançamento base inválidos.');
            document.getElementById('messageBoxOkBtn').classList.remove('hidden');
            return;
        }

        // Se o campo editado for a data de compra original, precisamos atualizar as datas de cada parcela
        if (field === 'dataCompleta' && editType === 'installment') {
            const dateObj = new Date(newValue + 'T00:00:00');
            const newOriginalPurchaseDia = dateObj.getDate();
            const newOriginalPurchaseMes = dateObj.getMonth() + 1;
            const newOriginalPurchaseAno = dateObj.getFullYear();

            const querySnapshot = await getDocs(q);
            querySnapshot.forEach(docSnapshot => {
                const existingLancamento = docSnapshot.data();
                const currentParcelaAtual = existingLancamento.parcelaAtual || 1; // Assume 1 se não definido
                
                // Calcula a nova data para cada parcela com base na nova data de compra original
                const newParcelaDate = new Date(newOriginalPurchaseAno, newOriginalPurchaseMes - 1 + currentParcelaAtual - 1, newOriginalPurchaseDia);
                
                batchUpdates.push({ 
                    id: docSnapshot.id, 
                    data: { 
                        originalPurchaseDia: newOriginalPurchaseDia,
                        originalPurchaseMes: newOriginalPurchaseMes,
                        originalPurchaseAno: newOriginalPurchaseAno,
                        dia: newParcelaDate.getDate(),
                        mes: newParcelaDate.getMonth() + 1,
                        ano: newParcelaDate.getFullYear()
                    } 
                });
            });

        } else if (field === 'valor' && editType === 'installment') {
            // Se o valor de uma parcela é alterado, recalcula o valor de todas as futuras parcelas
            const newValorParcela = parseFloat(newValue);
            if (isNaN(newValorParcela) || newValorParcela <= 0) {
                showMessageBox('Erro de Validação', 'Valor da parcela inválido. Por favor, insira um número positivo.');
                document.getElementById('messageBoxOkBtn').classList.remove('hidden');
                return;
            }

            const querySnapshot = await getDocs(q);
            querySnapshot.forEach(docSnapshot => {
                batchUpdates.push({ id: docSnapshot.id, data: { [field]: newValorParcela } });
            });

        } else if (field === 'parcelaAtual' || field === 'totalParcelas') {
             // Não propaga parcelas individuais. Essa edição é apenas para o item específico.
             // Já é tratado em applyEditToSingleLancamento
             showMessageBox('Atenção', 'Alterações de "Parcela Atual" ou "Total de Parcelas" só se aplicam a este lançamento individual.');
             document.getElementById('messageBoxOkBtn').classList.remove('hidden');
             return;

        } else {
            // Aplica a atualização simples para outros campos que não a data em recorrentes/parcelados
            const querySnapshot = await getDocs(q);
            querySnapshot.forEach(docSnapshot => {
                if (docSnapshot.id !== idToUpdate || editType === 'recurring') { // Atualiza todos, exceto o original se for parcela
                    batchUpdates.push({ id: docSnapshot.id, data: { [field]: newValue } });
                }
            });
        }
        
        // Executa as atualizações em lote
        for (const update of batchUpdates) {
            const docRef = doc(db, lancamentosCollection.path, update.id);
            await setDoc(docRef, update.data, { merge: true });
        }

        showMessageBox('Sucesso', 'Lançamentos atualizados em massa com sucesso!');

    } catch (e) {
        console.error("Erro ao atualizar lançamentos em massa: ", e);
        showMessageBox('Erro', 'Erro ao atualizar lançamentos em massa. Por favor, tente novamente.');
    } finally {
        document.getElementById('messageBoxOkBtn').classList.remove('hidden');
    }
}

// Inicializa o Firebase e configura os listeners quando o DOM estiver completamente carregado
document.addEventListener('DOMContentLoaded', async () => {
    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);

        // Inicialização de autenticação (permanece a mesma)
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                userId = user.uid;
                console.log("Usuário autenticado:", userId);
            } else {
                try {
                    // Tenta autenticação anônima se não houver token ou usuário
                    const anonymousUserCredential = await signInAnonymously(auth);
                    userId = anonymousUserCredential.user.uid;
                    console.log("Autenticação anônima bem-sucedida:", userId);
                } catch (error) {
                    console.error("Erro na autenticação anônima:", error);
                    showMessageBox("Erro de Autenticação", `Não foi possível autenticar o utilizador. Usando um ID temporário. Erro: ${error.message}`);
                }
            }

            const savedHouseholdId = localStorage.getItem('savedHouseholdId');
            if (savedHouseholdId) {
                currentHouseholdId = savedHouseholdId;
            } else {
                currentHouseholdId = userId;
                localStorage.setItem('savedHouseholdId', currentHouseholdId);
            }

            initializeUI(); // Chama a função para atribuir elementos e configurar listeners

            if (userIdDisplay) userIdDisplay.textContent = `ID do Usuário: ${userId}`;
            // Remove a linha que preenche o input automaticamente. O input começará em branco.
            // if (joinHouseholdIdInput) joinHouseholdIdInput.value = currentHouseholdId; 

            lancamentosCollection = collection(db, `artifacts/${appId}/public/data/lancamentos`);
            isAuthReady = true;

            setupFirestoreListener();
        });

    } catch (error) {
        console.error("Erro fatal ao inicializar aplicação:", error);
        const userIdDisplayFallback = document.getElementById('user-id-display');
        if (userIdDisplayFallback) userIdDisplayFallback.textContent = `Erro ao carregar ID do Usuário.`;
        showMessageBox("Erro Crítico", 'Erro ao carregar a aplicação. Por favor, tente novamente mais tarde. Verifique o console do navegador para mais detalhes.');
    }
});

// Outras funções (initializeUI, setupFirestoreListener, etc.) permanecem inalteradas
// ... (mantenha o restante do seu script.js aqui)

/**
 * Atribui elementos do DOM a variáveis e configura os event listeners.
 */
function initializeUI() {
    // Atribuição de elementos do formulário de lançamento
    lancamentoForm = document.getElementById('lancamentoForm');
    diaInput = document.getElementById('dia');
    mesInput = document.getElementById('mes');
    anoInput = document.getElementById('ano');
    descricaoInput = document.getElementById('descricao');
    valorInput = document.getElementById('valor');
    categoriaSelect = document.getElementById('categoria');
    tipoEntradaRadio = document.getElementById('tipoEntrada');
    tipoSaidaRadio = document.getElementById('tipoSaida');
    addGastoBtn = document.getElementById('addLancamentoBtn');
    
    // Elementos da tabela e resumo
    gastosTableBody = document.getElementById('gastosTableBody');
    totalEntradasSpan = document.getElementById('totalEntradas');
    totalSaidasSpan = document.getElementById('totalSaidas');
    mediaDiariaSpan = document.getElementById('mediaDiaria');
    saldoMesSpan = document.getElementById('saldoMes'); // Adicionado
    saldoStatusBar = document.getElementById('saldoStatusBar'); // Adicionado
    saldoStatusText = document.getElementById('saldoStatusText'); // Adicionado

    // Elementos de parcelamento
    parcelaAtualSelect = document.getElementById('parcelaAtual');
    totalParcelasSelect = document.getElementById('totalParcelas');
    parcelaFieldsDiv = document.getElementById('parcelaFields');

    // Preenche as opções de parcela (1 a 12)
    for (let i = 1; i <= 12; i++) {
        const optionAtual = document.createElement('option');
        optionAtual.value = i;
        optionAtual.textContent = i;
        parcelaAtualSelect.appendChild(optionAtual);

        const optionTotal = document.createElement('option');
        optionTotal.value = i;
        optionTotal.textContent = i;
        totalParcelasSelect.appendChild(optionTotal);
    }
    
    // Elementos de seleção em massa
    userIdDisplay = document.getElementById('user-id-display');
    joinHouseholdIdInput = document.getElementById('joinHouseholdIdInput');
    setHouseholdIdBtn = document.getElementById('setHouseholdIdBtn');
    selectAllCheckbox = document.getElementById('selectAllCheckbox');
    deleteSelectedBtn = document.getElementById('deleteSelectedBtn');

    // Campo de recorrência
    isRecurringCheckbox = document.getElementById('isRecurring');

    // Elementos do filtro de mês e ano
    filterMesGroup = document.getElementById('filterMesGroup');
    filterMesAll = document.getElementById('filterMesAll');
    filterAnoSelect = document.getElementById('filterAno');

    // Mensagem de nenhum lançamento
    noExpensesMessage = document.getElementById('noExpensesMessage');

    // Campo de busca
    searchBarInput = document.getElementById('searchBar');

    // Elementos para feedback de categorização automática
    categoryLoadingIndicator = document.getElementById('categoryLoadingIndicator'); // Certifique-se de ter este elemento no seu HTML se for usá-lo

    // Elementos do modal de parada de recorrência
    stopRecurringMonthsModalOverlay = document.getElementById('stopRecurringMonthsModalOverlay');
    stopFromCurrentMonthCheckbox = document.getElementById('stopFromCurrentMonthCheckbox');
    currentMonthAndYearSpan = document.getElementById('currentMonthAndYearSpan');
    specificMonthsSelectionDiv = document.getElementById('specificMonthsSelectionDiv');
    stopRecurringYearSelect = document.getElementById('stopRecurringYearSelect');
    cancelStopRecurringBtn = document.getElementById('cancelStopRecurringBtn');
    confirmStopRecurringBtn = document.getElementById('confirmStopRecurringBtn');

    // Preenche os anos no select de filtro e no modal de parada de recorrência
    const currentYear = new Date().getFullYear();
    for (let i = currentYear - 5; i <= currentYear + 5; i++) {
        const optionFilter = document.createElement('option');
        optionFilter.value = i;
        optionFilter.textContent = i;
        filterAnoSelect.appendChild(optionFilter);
        if (i === currentYear) {
            optionFilter.selected = true; // Seleciona o ano atual por padrão
        }

        const optionStop = document.createElement('option');
        optionStop.value = i;
        optionStop.textContent = i;
        stopRecurringYearSelect.appendChild(optionStop);
        if (i === currentYear) {
            optionStop.selected = true; // Seleciona o ano atual por padrão no modal
        }
    }

    // Preenche os checkboxes de mês para filtro e no modal de parada de recorrência
    for (let i = 1; i <= 12; i++) {
        // Filtro principal
        const label = document.createElement('label');
        label.className = 'flex items-center';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.name = 'monthFilter';
        checkbox.value = i;
        checkbox.className = 'form-checkbox h-4 w-4 text-purple-600 rounded';
        checkbox.checked = true; // Todos os meses selecionados por padrão
        checkbox.addEventListener('change', handleMonthFilterCheckboxChange); // Adiciona listener
        const span = document.createElement('span');
        span.className = 'ml-2 text-gray-700';
        span.textContent = getMonthName(i).substring(0, 3).toUpperCase(); // Ex: JAN, FEV
        label.appendChild(checkbox);
        label.appendChild(span);
        filterMesGroup.appendChild(label);
    }
    monthFilterCheckboxes = document.querySelectorAll('input[name="monthFilter"]'); // Atualiza a NodeList

    // Preenche os meses no modal de parada de recorrência (específico)
    for (let i = 1; i <= 12; i++) {
        const label = document.createElement('label');
        label.className = 'flex items-center';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.name = 'stopMonthFilter';
        checkbox.value = i;
        checkbox.className = 'form-checkbox h-4 w-4 text-blue-600 rounded';
        const span = document.createElement('span');
        span.className = 'ml-2 text-gray-700';
        span.textContent = getMonthName(i).substring(0, 3).toUpperCase();
        label.appendChild(checkbox);
        label.appendChild(span);
        specificMonthsSelectionDiv.appendChild(label);
    }
    monthStopCheckboxes = document.querySelectorAll('input[name="stopMonthFilter"]');

    // Elementos do modal de escolha de edição
    editRecurringChoiceModalOverlay = document.getElementById('editRecurringChoiceModalOverlay');
    editRecurringChoiceMessage = document.getElementById('editRecurringChoiceMessage');
    applyToThisBtn = document.getElementById('applyToThisBtn');
    applyToFutureBtn = document.getElementById('applyToFutureBtn');
    cancelEditRecurringBtn = document.getElementById('cancelEditRecurringBtn');
    
    // Configurações iniciais do UI
    updateMonthFilterCheckboxesState(); // Garante que "Todos os Meses" esteja correto no carregamento
    updateCurrentMonthAndYearSpan(); // Atualiza a exibição do mês/ano atual no modal de parada

    // Event Listeners
    if (lancamentoForm) {
        lancamentoForm.addEventListener('submit', addLancamento);
    }

    if (filterAnoSelect) {
        filterAnoSelect.addEventListener('change', () => {
            updateSummary();
            renderLancamentos();
        });
    }

    if (filterMesAll) {
        filterMesAll.addEventListener('change', handleFilterMesAllChange);
    }

    if (tipoSaidaRadio) {
        tipoSaidaRadio.addEventListener('change', () => {
            if (tipoSaidaRadio.checked) {
                parcelaFieldsDiv.classList.remove('hidden');
                isRecurringCheckbox.checked = false; // Desmarcar "Recorrente" se for parcelado/saída
            }
        });
    }

    if (tipoEntradaRadio) {
        tipoEntradaRadio.addEventListener('change', () => {
            if (tipoEntradaRadio.checked) {
                parcelaFieldsDiv.classList.add('hidden');
                isRecurringCheckbox.checked = false; // Desmarcar "Recorrente" se for entrada
                // Limpa os valores de parcela quando o tipo é "entrada"
                parcelaAtualSelect.value = "0";
                totalParcelasSelect.value = "0";
            }
        });
    }

    if (isRecurringCheckbox) {
        isRecurringCheckbox.addEventListener('change', () => {
            if (isRecurringCheckbox.checked) {
                parcelaFieldsDiv.classList.add('hidden'); // Esconde campos de parcela
                tipoSaidaRadio.checked = true; // Recorrente implica em Saída
            } else {
                // Se desmarcado, re-exibe campos de parcela se o tipo for saída
                if (tipoSaidaRadio.checked) {
                    parcelaFieldsDiv.classList.remove('hidden');
                }
            }
            // Limpa os valores de parcela se for marcado/desmarcado
            parcelaAtualSelect.value = "0";
            totalParcelasSelect.value = "0";
        });
    }

    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', handleSelectAllChange);
    }
    if (deleteSelectedBtn) {
        deleteSelectedBtn.addEventListener('click', handleDeleteSelected);
    }

    if (setHouseholdIdBtn) {
        setHouseholdIdBtn.addEventListener('click', setHouseholdId);
    }

    // Event listeners para o modal de parada de recorrência
    if (stopFromCurrentMonthCheckbox) {
        stopFromCurrentMonthCheckbox.addEventListener('change', () => {
            if (stopFromCurrentMonthCheckbox.checked) {
                monthStopCheckboxes.forEach(cb => cb.checked = false); // Desmarca meses específicos
                stopRecurringYearSelect.value = new Date().getFullYear(); // Volta para o ano atual
            }
        });
    }

    monthStopCheckboxes.forEach(cb => {
        cb.addEventListener('change', () => {
            if (cb.checked) {
                stopFromCurrentMonthCheckbox.checked = false; // Desmarca "a partir do mês atual"
            }
        });
    });

    if (cancelStopRecurringBtn) {
        cancelStopRecurringBtn.addEventListener('click', () => {
            stopRecurringMonthsModalOverlay.classList.add('hidden');
            resetStopRecurringModal();
        });
    }

    if (confirmStopRecurringBtn) {
        confirmStopRecurringBtn.addEventListener('click', confirmStopRecurring);
    }

    // Event listeners para o modal de escolha de edição recorrente/parcelada
    if (applyToThisBtn) {
        applyToThisBtn.addEventListener('click', () => {
            editRecurringChoiceModalOverlay.classList.add('hidden');
            if (pendingEditData) {
                applyEditToSingleLancamento(pendingEditData.id, pendingEditData.field, pendingEditData.newValue, pendingEditData.currentLancamento);
                pendingEditData = null; // Limpa os dados pendentes
            }
        });
    }

    if (applyToFutureBtn) {
        applyToFutureBtn.addEventListener('click', () => {
            editRecurringChoiceModalOverlay.classList.add('hidden');
            if (pendingEditData) {
                applyEditToSeriesLancamentos(pendingEditData.id, pendingEditData.field, pendingEditData.newValue, pendingEditData.currentLancamento, pendingEditData.type);
                pendingEditData = null; // Limpa os dados pendentes
            }
        });
    }

    if (cancelEditRecurringBtn) {
        cancelEditRecurringBtn.addEventListener('click', () => {
            editRecurringChoiceModalOverlay.classList.add('hidden');
            // Reverte a célula editada se a edição for cancelada
            if (pendingEditData && pendingEditData.currentLancamento) {
                const cellElement = document.querySelector(`[data-id="${pendingEditData.id}"][data-field="${pendingEditData.field}"]`);
                if (cellElement) {
                    renderLancamentos(); // Melhor recarregar para garantir o estado correto
                }
            }
            pendingEditData = null; // Limpa os dados pendentes
        });
    }

    // Listener para o campo de busca
    if (searchBarInput) {
        searchBarInput.addEventListener('input', () => {
            renderLancamentos(); // Re-renderiza a tabela com o filtro de busca aplicado
        });
    }
}

/**
 * Configura o listener em tempo real para a coleção Firestore de lançamentos.
 */
function setupFirestoreListener() {
    if (!lancamentosCollection) {
        console.error("Coleção de lançamentos não inicializada.");
        return;
    }

    // Cria uma query que filtra pelo householdId
    const q = query(lancamentosCollection, where("householdId", "==", currentHouseholdId));

    onSnapshot(q, (snapshot) => {
        lancamentos = []; // Limpa o array para reconstruir
        snapshot.forEach((doc) => {
            lancamentos.push({ id: doc.id, ...doc.data() });
        });
        
        // Ordena os lançamentos por ano, mês e dia para exibição
        lancamentos.sort((a, b) => {
            const dateA = new Date(a.ano, a.mes - 1, a.dia);
            const dateB = new Date(b.ano, b.mes - 1, b.dia);
            return dateB - dateA; // Mais recente primeiro
        });

        console.log("Lançamentos atualizados:", lancamentos);
        updateSummary();
        renderLancamentos();
    }, (error) => {
        console.error("Erro ao obter lançamentos: ", error);
        showMessageBox("Erro de Dados", "Não foi possível carregar os lançamentos. Verifique sua conexão ou tente novamente.");
    });
}

/**
 * Adiciona um novo lançamento ao Firestore.
 * @param {Event} event O objeto do evento de submissão do formulário.
 */
async function addLancamento(event) {
    event.preventDefault(); // Impede o envio padrão do formulário
    
    if (!isAuthReady) {
        showMessageBox('Aguarde', 'Aplicação ainda carregando, por favor, aguarde.');
        return;
    }

    const dia = parseInt(diaInput.value);
    const mes = parseInt(mesInput.value);
    const ano = parseInt(anoInput.value);
    const descricao = descricaoInput.value.trim();
    const valor = parseFloat(valorInput.value);
    const categoria = categoriaSelect.value;
    const tipo = tipoEntradaRadio.checked ? 'entrada' : 'saida';
    const isRecurring = isRecurringCheckbox.checked;

    let parcelaAtual = null;
    let totalParcelas = null;
    let originalPurchaseDia = null;
    let originalPurchaseMes = null;
    let originalPurchaseAno = null;
    let recurringGroupId = null; // Para agrupar lançamentos recorrentes

    // Lógica para parcelamento
    if (tipo === 'saida' && !isRecurring) {
        parcelaAtual = parseInt(parcelaAtualSelect.value);
        totalParcelas = parseInt(totalParcelasSelect.value);
        if (parcelaAtual === 0 || totalParcelas === 0 || isNaN(parcelaAtual) || isNaN(totalParcelas)) {
            parcelaAtual = null;
            totalParcelas = null;
        } else if (parcelaAtual > totalParcelas) {
            showMessageBox('Erro de Validação', 'Parcela atual não pode ser maior que o total de parcelas.');
            return;
        } else {
             // Se for parcelado, a data original de compra é a data do primeiro lançamento
            originalPurchaseDia = dia;
            originalPurchaseMes = mes;
            originalPurchaseAno = ano;
        }
    }

    // Validações básicas
    if (isNaN(valor) || valor <= 0) {
        showMessageBox('Erro de Validação', 'Valor inválido. Por favor, insira um número positivo.');
        return;
    }
    if (!descricao) {
        showMessageBox('Erro de Validação', 'A descrição não pode ser vazia.');
        return;
    }
    if (!categoria) {
        showMessageBox('Erro de Validação', 'Por favor, selecione uma categoria.');
        return;
    }
    if (isNaN(dia) || dia < 1 || dia > 31 || isNaN(mes) || mes < 1 || mes > 12 || isNaN(ano) || ano < 2000) {
        showMessageBox('Erro de Validação', 'Data inválida. Por favor, verifique o dia, mês e ano.');
        return;
    }

    showMessageBox('Processando', 'Adicionando lançamento...');
    document.getElementById('messageBoxOkBtn').classList.add('hidden'); // Esconde o botão OK durante o processamento

    try {
        if (isRecurring) {
            recurringGroupId = doc(lancamentosCollection).id; // Gera um ID único para o grupo recorrente
            const confirmation = await showConfirmBox('Confirmar Lançamento Recorrente', `Você deseja adicionar este lançamento (${descricao} - R$ ${valor.toFixed(2)}) como recorrente para os próximos ${RECURRING_MONTHS_AHEAD + 1} meses?`);
            if (!confirmation) {
                document.getElementById('messageBoxOkBtn').classList.remove('hidden');
                showMessageBox('Ação Cancelada', 'Lançamento recorrente cancelado.');
                return;
            }

            // Gera lançamentos para os próximos 12 meses
            for (let i = 0; i <= RECURRING_MONTHS_AHEAD; i++) {
                const currentDate = new Date(ano, mes - 1 + i, dia);
                const newDay = currentDate.getDate();
                const newMonth = currentDate.getMonth() + 1;
                const newYear = currentDate.getFullYear();

                const newLancamento = {
                    dia: newDay,
                    mes: newMonth,
                    ano: newYear,
                    descricao: descricao,
                    valor: valor,
                    categoria: categoria,
                    tipo: tipo,
                    isRecurring: true,
                    recurringGroupId: recurringGroupId,
                    householdId: currentHouseholdId,
                    createdAt: new Date() // Adiciona timestamp para ordenação
                };
                await addDoc(lancamentosCollection, newLancamento);
            }
            showMessageBox('Sucesso', 'Lançamentos recorrentes adicionados com sucesso!');
        } else if (parcelaAtual !== null && totalParcelas !== null) {
            const confirmation = await showConfirmBox('Confirmar Lançamento Parcelado', `Você deseja adicionar este lançamento (${descricao} - R$ ${valor.toFixed(2)}) como parcelado (${parcelaAtual}/${totalParcelas})?`);
            if (!confirmation) {
                document.getElementById('messageBoxOkBtn').classList.remove('hidden');
                showMessageBox('Ação Cancelada', 'Lançamento parcelado cancelado.');
                return;
            }

            // Para lançamentos parcelados, adiciona apenas o lançamento atual
            const lancamentoData = {
                dia: dia,
                mes: mes,
                ano: ano,
                descricao: `${descricao} (${parcelaAtual}/${totalParcelas})`, // Adiciona (X/Y) à descrição
                valor: valor,
                categoria: categoria,
                tipo: tipo,
                parcelaAtual: parcelaAtual,
                totalParcelas: totalParcelas,
                originalPurchaseDia: originalPurchaseDia,
                originalPurchaseMes: originalPurchaseMes,
                originalPurchaseAno: originalPurchaseAno,
                isRecurring: false, // Não é recorrente, mas sim parcelado
                householdId: currentHouseholdId,
                createdAt: new Date()
            };
            await addDoc(lancamentosCollection, lancamentoData);
            showMessageBox('Sucesso', `Lançamento parcelado ${parcelaAtual}/${totalParcelas} adicionado com sucesso!`);
        } else {
            // Lançamento único (não recorrente, não parcelado)
            const lancamentoData = {
                dia: dia,
                mes: mes,
                ano: ano,
                descricao: descricao,
                valor: valor,
                categoria: categoria,
                tipo: tipo,
                isRecurring: false, // Garante que não é recorrente
                parcelaAtual: null,
                totalParcelas: null,
                originalPurchaseDia: null,
                originalPurchaseMes: null,
                originalPurchaseAno: null,
                householdId: currentHouseholdId,
                createdAt: new Date()
            };
            await addDoc(lancamentosCollection, lancamentoData);
            showMessageBox('Sucesso', 'Lançamento adicionado com sucesso!');
        }

        lancamentoForm.reset(); // Limpa o formulário após adicionar
        // Garante que os campos de parcela estejam ocultos após o reset, se o tipo for entrada
        if (tipoEntradaRadio.checked) {
            parcelaFieldsDiv.classList.add('hidden');
        }

    } catch (e) {
        console.error("Erro ao adicionar documento: ", e);
        showMessageBox('Erro', 'Erro ao adicionar lançamento. Por favor, tente novamente.');
    } finally {
        document.getElementById('messageBoxOkBtn').classList.remove('hidden');
    }
}

/**
 * Atualiza os totais de entradas, saídas, saldo e média diária.
 */
function updateSummary() {
    const selectedMonths = Array.from(monthFilterCheckboxes)
                               .filter(cb => cb.checked)
                               .map(cb => parseInt(cb.value));
    const selectedYear = parseInt(filterAnoSelect.value);
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    let totalEntradas = 0;
    let totalSaidas = 0;
    let lancamentosNoPeriodo = 0;
    const daysInMonth = new Date(selectedYear, currentMonth, 0).getDate(); // Dias no mês atual do ano selecionado

    lancamentos.forEach(lancamento => {
        // Aplica o filtro de ano e mês
        const matchesYear = lancamento.ano === selectedYear;
        const matchesMonth = selectedMonths.includes(lancamento.mes);

        if (matchesYear && matchesMonth) {
            if (lancamento.tipo === 'entrada') {
                totalEntradas += lancamento.valor;
            } else {
                totalSaidas += lancamento.valor;
            }
            lancamentosNoPeriodo++;
        }
    });

    const saldo = totalEntradas - totalSaidas;
    const mediaDiaria = lancamentosNoPeriodo > 0 ? totalSaidas / daysInMonth : 0; // Média baseada apenas em saídas

    totalEntradasSpan.textContent = `R$ ${totalEntradas.toFixed(2)}`;
    totalSaidasSpan.textContent = `R$ ${totalSaidas.toFixed(2)}`;
    mediaDiariaSpan.textContent = `R$ ${mediaDiaria.toFixed(2)}`;
    saldoMesSpan.textContent = `Saldo: R$ ${saldo.toFixed(2)}`; // O elemento saldoMesSpan não está no HTML corrigido. Certifique-se de adicioná-lo se quiser exibi-lo separadamente.

    // Atualiza a barra de status do saldo
    const total = totalEntradas + totalSaidas;
    let percentage = 50; // Valor padrão para um saldo neutro
    if (total > 0) {
        // Se houver saldo positivo, a barra se move para a direita (verde)
        // Se houver saldo negativo, a barra se move para a esquerda (vermelho)
        percentage = (totalEntradas / total) * 100;
    } else if (totalEntradas === 0 && totalSaidas === 0) {
        percentage = 50; // Se não houver lançamentos, mantém no meio
    } else if (totalEntradas === 0 && totalSaidas > 0) {
        percentage = 0; // Apenas saídas, vai para 0% (vermelho total)
    } else if (totalEntradas > 0 && totalSaidas === 0) {
        percentage = 100; // Apenas entradas, vai para 100% (verde total)
    }

    if (saldoStatusBar) {
        const saldoStatusElement = saldoStatusBar.querySelector('#saldoStatus');
        if (saldoStatusElement) {
            saldoStatusElement.style.width = `${percentage}%`;
            if (saldo > 0) {
                saldoStatusElement.style.backgroundColor = '#10B981'; // Verde para saldo positivo
            } else if (saldo < 0) {
                saldoStatusElement.style.backgroundColor = '#EF4444'; // Vermelho para saldo negativo
            } else {
                saldoStatusElement.style.backgroundColor = '#6366F1'; // Roxo para saldo neutro
            }
        }
    }
    if (saldoStatusText) {
        saldoStatusText.textContent = `Saldo: R$ ${saldo.toFixed(2)}`;
    }
}

/**
 * Renderiza os lançamentos na tabela, aplicando filtros e busca.
 */
function renderLancamentos() {
    gastosTableBody.innerHTML = ''; // Limpa a tabela antes de renderizar
    selectedLancamentosIds.clear(); // Limpa a seleção
    updateDeleteSelectedButton(); // Atualiza o botão de exclusão

    const selectedMonths = Array.from(monthFilterCheckboxes)
                               .filter(cb => cb.checked)
                               .map(cb => parseInt(cb.value));
    const selectedYear = parseInt(filterAnoSelect.value);
    const searchTerm = searchBarInput.value.toLowerCase().trim();

    const filteredLancamentos = lancamentos.filter(lancamento => {
        const matchesYear = lancamento.ano === selectedYear;
        const matchesMonth = selectedMonths.includes(lancamento.mes);
        const matchesSearch = searchTerm === '' || 
                              lancamento.descricao.toLowerCase().includes(searchTerm) ||
                              lancamento.categoria.toLowerCase().includes(searchTerm);
        return matchesYear && matchesMonth && matchesSearch;
    });

    if (filteredLancamentos.length === 0) {
        noExpensesMessage.style.display = 'block';
    } else {
        noExpensesMessage.style.display = 'none';
    }

    filteredLancamentos.forEach(lancamento => {
        const row = gastosTableBody.insertRow();
        row.className = 'hover:bg-gray-50'; // Efeito de hover

        // Checkbox de seleção
        const selectCell = row.insertCell();
        selectCell.className = 'px-3 py-2 whitespace-nowrap text-center';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'form-checkbox h-4 w-4 text-blue-600 rounded';
        checkbox.dataset.id = lancamento.id; // Armazena o ID do lançamento no dataset do checkbox
        checkbox.addEventListener('change', handleIndividualCheckboxChange);
        selectCell.appendChild(checkbox);

        // Célula de Data
        const dateCell = row.insertCell();
        dateCell.className = 'px-3 py-2 whitespace-nowrap text-sm text-gray-900 cursor-pointer';
        dateCell.dataset.id = lancamento.id;
        dateCell.dataset.field = 'dataCompleta';
        const displayDay = lancamento.dia < 10 ? `0${lancamento.dia}` : lancamento.dia;
        const displayMonth = lancamento.mes < 10 ? `0${lancamento.mes}` : lancamento.mes;
        dateCell.textContent = `${displayDay}/${displayMonth}/${lancamento.ano}`;
        dateCell.addEventListener('click', () => handleEditCellClick(dateCell));

        // Célula de Descrição
        const descricaoCell = row.insertCell();
        descricaoCell.className = 'px-3 py-2 text-sm text-gray-900 cursor-pointer';
        descricaoCell.dataset.id = lancamento.id;
        descricaoCell.dataset.field = 'descricao';
        descricaoCell.textContent = lancamento.descricao;
        descricaoCell.addEventListener('click', () => handleEditCellClick(descricaoCell));

        // Célula de Valor
        const valorCell = row.insertCell();
        valorCell.className = `px-3 py-2 whitespace-nowrap text-sm font-medium ${lancamento.tipo === 'entrada' ? 'text-income' : 'text-expense'} cursor-pointer`;
        valorCell.dataset.id = lancamento.id;
        valorCell.dataset.field = 'valor';
        valorCell.textContent = `R$ ${lancamento.valor.toFixed(2)}`;
        valorCell.addEventListener('click', () => handleEditCellClick(valorCell));

        // Célula de Categoria
        const categoriaCell = row.insertCell();
        categoriaCell.className = 'px-3 py-2 whitespace-nowrap text-sm text-gray-700 cursor-pointer';
        categoriaCell.dataset.id = lancamento.id;
        categoriaCell.dataset.field = 'categoria';
        categoriaCell.textContent = lancamento.categoria;
        categoriaCell.addEventListener('click', () => handleEditCellClick(categoriaCell));

        // Célula de Tipo
        const tipoCell = row.insertCell();
        tipoCell.className = `px-3 py-2 whitespace-nowrap text-sm font-semibold ${lancamento.tipo === 'entrada' ? 'text-income' : 'text-expense'} cursor-pointer`;
        tipoCell.dataset.id = lancamento.id;
        tipoCell.dataset.field = 'tipo';
        tipoCell.textContent = lancamento.tipo === 'entrada' ? 'Entrada' : 'Saída';
        tipoCell.addEventListener('click', () => handleEditCellClick(tipoCell));

        // Célula de Ações (Botões de Editar e Excluir)
        const actionsCell = row.insertCell();
        actionsCell.className = 'px-3 py-2 whitespace-nowrap text-right text-sm font-medium';
        
        const deleteButton = document.createElement('button');
        deleteButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-red-500 hover:text-red-700 mx-1 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>`;
        deleteButton.title = 'Excluir Lançamento';
        deleteButton.onclick = () => confirmDeleteLancamento(lancamento.id, lancamento.isRecurring, lancamento.recurringGroupId, lancamento.parcelaAtual, lancamento.totalParcelas, lancamento.originalPurchaseAno, lancamento.descricao.split(' (')[0]);
        actionsCell.appendChild(deleteButton);
    });
}

/**
 * Lida com a mudança do checkbox "Selecionar Todos".
 * @param {Event} event O objeto do evento.
 */
function handleSelectAllChange(event) {
    const isChecked = event.target.checked;
    const checkboxes = gastosTableBody.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = isChecked;
        handleIndividualCheckboxChange({ target: cb }); // Chama o handler individual para atualizar o set
    });
}

/**
 * Lida com a mudança de um checkbox individual de lançamento.
 * @param {Event} event O objeto do evento.
 */
function handleIndividualCheckboxChange(event) {
    const lancamentoId = event.target.dataset.id;
    if (event.target.checked) {
        selectedLancamentosIds.add(lancamentoId);
    } else {
        selectedLancamentosIds.delete(lancamentoId);
    }
    updateDeleteSelectedButton();
    updateSelectAllCheckboxState();
}

/**
 * Atualiza o estado do checkbox "Selecionar Todos" (marcado/indeterminado/desmarcado).
 */
function updateSelectAllCheckboxState() {
    const totalCheckboxes = gastosTableBody.querySelectorAll('input[type="checkbox"]').length;
    const checkedCheckboxes = selectedLancamentosIds.size;

    if (selectAllCheckbox) {
        if (checkedCheckboxes === 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        } else if (checkedCheckboxes === totalCheckboxes) {
            selectAllCheckbox.checked = true;
            selectAllCheckbox.indeterminate = false;
        } else {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = true;
        }
    }
}

/**
 * Atualiza a visibilidade e o texto do botão "Excluir Selecionados".
 */
function updateDeleteSelectedButton() {
    const selectedCountSpan = document.getElementById('selectedCount');
    if (selectedCountSpan) {
        selectedCountSpan.textContent = selectedLancamentosIds.size;
    }
    if (deleteSelectedBtn) {
        if (selectedLancamentosIds.size > 0) {
            deleteSelectedBtn.style.display = 'flex';
        } else {
            deleteSelectedBtn.style.display = 'none';
        }
    }
}

/**
 * Confirma a exclusão de lançamentos selecionados.
 */
async function handleDeleteSelected() {
    if (selectedLancamentosIds.size === 0) {
        showMessageBox('Nenhum Selecionado', 'Por favor, selecione lançamentos para excluir.');
        return;
    }

    const confirmation = await showConfirmBox('Confirmar Exclusão', `Você tem certeza que deseja excluir ${selectedLancamentosIds.size} lançamento(s) selecionado(s)?`);
    if (!confirmation) {
        return;
    }

    showMessageBox('Processando', 'Excluindo lançamentos...');
    document.getElementById('messageBoxOkBtn').classList.add('hidden'); // Esconde o botão OK durante o processamento

    try {
        for (const id of selectedLancamentosIds) {
            await deleteDoc(doc(lancamentosCollection, id));
        }
        showMessageBox('Sucesso', 'Lançamentos excluídos com sucesso!');
        selectedLancamentosIds.clear(); // Limpa a seleção após a exclusão
        selectAllCheckbox.checked = false; // Desmarca o "Selecionar Todos"
        updateDeleteSelectedButton(); // Atualiza o botão
    } catch (e) {
        console.error("Erro ao excluir lançamentos: ", e);
        showMessageBox('Erro', 'Erro ao excluir lançamentos. Por favor, tente novamente.');
    } finally {
        document.getElementById('messageBoxOkBtn').classList.remove('hidden');
    }
}

/**
 * Confirma a exclusão de um único lançamento, com lógica para recorrentes/parcelados.
 * @param {string} id O ID do lançamento a ser excluído.
 * @param {boolean} isRecurring Indica se o lançamento é recorrente.
 * @param {string} recurringGroupId O ID do grupo recorrente, se aplicável.
 * @param {number} parcelaAtual A parcela atual, se aplicável.
 * @param {number} totalParcelas O total de parcelas, se aplicável.
 * @param {number} originalPurchaseAno O ano da compra original para parcelados.
 * @param {string} baseDescription A descrição base para lançamentos parcelados.
 */
async function confirmDeleteLancamento(id, isRecurring, recurringGroupId, parcelaAtual, totalParcelas, originalPurchaseAno, baseDescription) {
    let confirmationMessage = 'Você tem certeza que deseja excluir este lançamento?';
    let seriesAction = false; // Flag para indicar se a ação se estende à série

    if (isRecurring && recurringGroupId) {
        confirmationMessage = 'Este é um lançamento recorrente. Deseja excluir apenas este lançamento ou todos os futuros lançamentos desta série?';
        seriesAction = true;
    } else if (parcelaAtual && totalParcelas && originalPurchaseAno) {
        confirmationMessage = `Este é um lançamento parcelado (${parcelaAtual}/${totalParcelas}). Deseja excluir apenas esta parcela ou todas as parcelas restantes da série "${baseDescription}"?`;
        seriesAction = true;
    }

    const confirmation = await showConfirmBox('Confirmar Exclusão', confirmationMessage);
    if (!confirmation) {
        return;
    }

    if (seriesAction) {
        if (isRecurring && recurringGroupId) {
            const deleteSeriesConfirmation = await showConfirmBox('Excluir Série Recorrente', 'Deseja excluir TODOS os lançamentos futuros desta série recorrente? (Se não, apenas este será excluído)');
            if (deleteSeriesConfirmation) {
                await deleteRecurringSeries(id, recurringGroupId);
            } else {
                await deleteSingleLancamento(id);
            }
        } else if (parcelaAtual && totalParcelas && originalPurchaseAno) {
            const deleteSeriesConfirmation = await showConfirmBox('Excluir Série Parcelada', `Deseja excluir todas as parcelas RESTANTES da série "${baseDescription}"? (Se não, apenas esta parcela será excluída)`);
            if (deleteSeriesConfirmation) {
                await deleteInstallmentSeries(id, originalPurchaseAno, originalPurchaseMes, originalPurchaseDia, baseDescription);
            } else {
                await deleteSingleLancamento(id);
            }
        }
    } else {
        await deleteSingleLancamento(id);
    }
}

/**
 * Exclui um único lançamento do Firestore.
 * @param {string} id O ID do lançamento a ser excluído.
 */
async function deleteSingleLancamento(id) {
    showMessageBox('Processando', 'Excluindo lançamento...');
    document.getElementById('messageBoxOkBtn').classList.add('hidden');
    try {
        await deleteDoc(doc(lancamentosCollection, id));
        showMessageBox('Sucesso', 'Lançamento excluído com sucesso!');
    } catch (e) {
        console.error("Erro ao excluir lançamento: ", e);
        showMessageBox('Erro', 'Erro ao excluir lançamento. Por favor, tente novamente.');
    } finally {
        document.getElementById('messageBoxOkBtn').classList.remove('hidden');
    }
}

/**
 * Exclui todos os lançamentos futuros de uma série recorrente.
 * @param {string} baseId O ID do lançamento que iniciou a exclusão (para determinar a data inicial).
 * @param {string} recurringGroupId O ID do grupo recorrente.
 */
async function deleteRecurringSeries(baseId, recurringGroupId) {
    showMessageBox('Processando', 'Excluindo série recorrente...');
    document.getElementById('messageBoxOkBtn').classList.add('hidden');
    try {
        const baseLancamento = lancamentos.find(l => l.id === baseId);
        if (!baseLancamento) {
            showMessageBox('Erro', 'Lançamento base não encontrado.');
            return;
        }

        // Query para obter todos os lançamentos recorrentes com o mesmo grupo a partir da data do lançamento base
        const q = query(lancamentosCollection, 
                        where("recurringGroupId", "==", recurringGroupId),
                        where("ano", ">=", baseLancamento.ano),
                        where("mes", ">=", baseLancamento.mes),
                        where("dia", ">=", baseLancamento.dia)
                    );
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            showMessageBox('Informação', 'Nenhum lançamento futuro encontrado para esta série.');
            return;
        }

        for (const docSnapshot of querySnapshot.docs) {
            await deleteDoc(doc(lancamentosCollection, docSnapshot.id));
        }
        showMessageBox('Sucesso', 'Série recorrente excluída com sucesso!');
    } catch (e) {
        console.error("Erro ao excluir série recorrente: ", e);
        showMessageBox('Erro', 'Erro ao excluir série recorrente. Por favor, tente novamente.');
    } finally {
        document.getElementById('messageBoxOkBtn').classList.remove('hidden');
    }
}

/**
 * Exclui as parcelas restantes de uma série de lançamentos parcelados.
 * @param {string} baseId O ID da parcela que iniciou a exclusão.
 * @param {number} originalPurchaseAno O ano da compra original.
 * @param {number} originalPurchaseMes O mês da compra original.
 * @param {number} originalPurchaseDia O dia da compra original.
 * @param {string} baseDescription A descrição base da série parcelada.
 */
async function deleteInstallmentSeries(baseId, originalPurchaseAno, originalPurchaseMes, originalPurchaseDia, baseDescription) {
    showMessageBox('Processando', 'Excluindo série parcelada...');
    document.getElementById('messageBoxOkBtn').classList.add('hidden');
    try {
        const baseLancamento = lancamentos.find(l => l.id === baseId);
        if (!baseLancamento) {
            showMessageBox('Erro', 'Lançamento base não encontrado.');
            return;
        }

        // Query para obter todas as parcelas com a mesma data de compra original e descrição base
        const q = query(lancamentosCollection,
                        where("originalPurchaseDia", "==", originalPurchaseDia),
                        where("originalPurchaseMes", "==", originalPurchaseMes),
                        where("originalPurchaseAno", "==", originalPurchaseAno),
                        where("descricao", "==", `${baseDescription} (${baseLancamento.parcelaAtual}/${baseLancamento.totalParcelas})`) // Usa a descrição exata da parcela base
                        // Adicionar filtro para parcelas futuras (maiores que a parcela atual)
                        // ou simplesmente iterar e excluir as parcelas >= currentParcela
                       );
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            showMessageBox('Informação', 'Nenhuma parcela restante encontrada para esta série.');
            return;
        }
        
        // Filtra as parcelas para excluir apenas as a partir da parcela atual (inclusive)
        const lancamentosToDelete = querySnapshot.docs.filter(docSnapshot => {
            const data = docSnapshot.data();
            return data.parcelaAtual >= baseLancamento.parcelaAtual;
        });

        if (lancamentosToDelete.length === 0) {
             showMessageBox('Informação', 'Nenhuma parcela restante a ser excluída a partir desta.');
             return;
        }

        for (const docSnapshot of lancamentosToDelete) {
            await deleteDoc(doc(lancamentosCollection, docSnapshot.id));
        }
        showMessageBox('Sucesso', 'Série parcelada excluída com sucesso!');
    } catch (e) {
        console.error("Erro ao excluir série parcelada: ", e);
        showMessageBox('Erro', 'Erro ao excluir série parcelada. Por favor, tente novamente.');
    } finally {
        document.getElementById('messageBoxOkBtn').classList.remove('hidden');
    }
}

/**
 * Define o ID da família/casa e salva no localStorage.
 */
async function setHouseholdId() {
    const newHouseholdId = joinHouseholdIdInput.value.trim();
    if (newHouseholdId) {
        // Verifica se o ID inserido é diferente do atual
        if (newHouseholdId !== currentHouseholdId) {
            const confirmChange = await showConfirmBox('Mudar ID da Família/Casa', `Você deseja mudar para o ID: ${newHouseholdId}? Isso mudará os lançamentos que você vê.`);
            if (confirmChange) {
                localStorage.setItem('savedHouseholdId', newHouseholdId);
                currentHouseholdId = newHouseholdId;
                userIdDisplay.textContent = `ID da Família/Casa Ativa: ${currentHouseholdId}`;
                setupFirestoreListener(); // Re-configura o listener com o novo ID
                showMessageBox('Sucesso', `ID da Família/Casa alterado para: ${newHouseholdId}`);
            } else {
                // Se o usuário cancelar, restaura o input para o ID atual
                joinHouseholdIdInput.value = currentHouseholdId;
            }
        } else {
            showMessageBox('Informação', 'O ID inserido já é o ID ativo.');
        }
    } else {
        showMessageBox('Erro', 'Por favor, insira um ID de Família/Casa válido.');
    }
}

/**
 * Atualiza a exibição do mês e ano atual no modal de parada de recorrência.
 */
function updateCurrentMonthAndYearSpan() {
    const now = new Date();
    const currentMonth = now.toLocaleString('pt-BR', { month: 'long' });
    const currentYear = now.getFullYear();
    if (currentMonthAndYearSpan) {
        currentMonthAndYearSpan.textContent = `${currentMonth} de ${currentYear}`;
    }
}

/**
 * Confirma a parada de um lançamento recorrente.
 */
async function confirmStopRecurring() {
    if (!currentRecurringGroupId) {
        showMessageBox('Erro', 'Nenhum lançamento recorrente selecionado para parar.');
        return;
    }

    const stopFromCurrent = stopFromCurrentMonthCheckbox.checked;
    const selectedStopMonths = Array.from(monthStopCheckboxes)
                                .filter(cb => cb.checked)
                                .map(cb => parseInt(cb.value));
    const stopYear = parseInt(stopRecurringYearSelect.value);

    if (!stopFromCurrent && selectedStopMonths.length === 0) {
        showMessageBox('Atenção', 'Selecione uma opção para parar a recorrência (a partir do mês atual ou meses específicos).');
        return;
    }

    let confirmationMessage = '';
    if (stopFromCurrent) {
        const now = new Date();
        const currentMonthName = now.toLocaleString('pt-BR', { month: 'long' });
        const currentYear = now.getFullYear();
        confirmationMessage = `Confirma parar a recorrência a partir de ${currentMonthName} de ${currentYear} em diante?`;
    } else if (selectedStopMonths.length > 0) {
        const monthNames = selectedStopMonths.map(getMonthName).join(', ');
        confirmationMessage = `Confirma parar a recorrência nos seguintes meses de ${stopYear}: ${monthNames}?`;
    }

    const confirmation = await showConfirmBox('Confirmar Parada de Recorrência', confirmationMessage);
    if (!confirmation) {
        return;
    }

    showMessageBox('Processando', 'Parando recorrência...');
    document.getElementById('messageBoxOkBtn').classList.add('hidden'); // Esconde o botão OK durante o processamento

    try {
        // Encontra o lançamento base (o que o usuário clicou para parar a recorrência)
        const baseLancamento = lancamentos.find(l => l.recurringGroupId === currentRecurringGroupId);
        if (!baseLancamento) {
            showMessageBox('Erro', 'Lançamento base recorrente não encontrado.');
            return;
        }

        let lancamentosToStopQuery;
        if (stopFromCurrent) {
            const now = new Date();
            const currentMonth = now.getMonth() + 1;
            const currentYear = now.getFullYear();
            // Exclui lançamentos a partir do mês e ano atual, incluindo o atual
            lancamentosToStopQuery = query(lancamentosCollection, 
                                           where("recurringGroupId", "==", currentRecurringGroupId),
                                           where("ano", ">=", currentYear),
                                           where("mes", ">=", currentMonth)
                                          );
        } else {
            // Exclui lançamentos para meses e ano específicos
            lancamentosToStopQuery = query(lancamentosCollection, 
                                           where("recurringGroupId", "==", currentRecurringGroupId),
                                           where("ano", "==", stopYear),
                                           where("mes", "in", selectedStopMonths) // Usar 'in' para múltiplos meses
                                          );
        }

        const querySnapshot = await getDocs(lancamentosToStopQuery);
        if (querySnapshot.empty) {
            showMessageBox('Informação', 'Nenhum lançamento encontrado para parar a recorrência neste período.');
            return;
        }

        for (const docSnapshot of querySnapshot.docs) {
            await deleteDoc(doc(lancamentosCollection, docSnapshot.id));
        }

        showMessageBox('Sucesso', 'Recorrência parada com sucesso!');
        stopRecurringMonthsModalOverlay.classList.add('hidden');
        resetStopRecurringModal();

    } catch (e) {
        console.error("Erro ao parar recorrência: ", e);
        showMessageBox('Erro', 'Erro ao parar recorrência. Por favor, tente novamente.');
    } finally {
        document.getElementById('messageBoxOkBtn').classList.remove('hidden');
    }
}

/**
 * Reseta o estado do modal de parada de recorrência.
 */
function resetStopRecurringModal() {
    stopFromCurrentMonthCheckbox.checked = false;
    monthStopCheckboxes.forEach(cb => cb.checked = false);
    stopRecurringYearSelect.value = new Date().getFullYear();
    currentRecurringGroupId = null;
}
