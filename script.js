// Importa as funções necessárias do Firebase SDK (versões modulares padrão)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, 
    signInAnonymously, // Ainda mantido para compatibilidade, mas não usado por padrão
    signInWithCustomToken, 
    onAuthStateChanged,
    createUserWithEmailAndPassword, // Novo para registo
    signInWithEmailAndPassword // Novo para login
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

// Elementos do novo modal de autenticação
let authModalOverlay;
let authModalTitle;
let authMessage;
let authEmailInput;
let authPasswordInput;
let registerBtn;
let loginBtn;
let authLoadingIndicator;

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
                return updateData[key] !== baseDesc; // Use baseDesc from inputElement value
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
            }
            else {
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
        console.log(`[applyEditToSeriesLancamentos] Dados do lançamento base:`, baseLancamento);

        if (editType === 'recurring') {
            if (!baseLancamento.isRecurring || !baseLancamento.recurringGroupId) {
                showMessageBox('Erro', 'Este lançamento não é uma cobrança recorrente válida para edição em série.');
                return;
            }
            q = query(
                lancamentosCollection,
                where("recurringGroupId", "==", baseLancamento.recurringGroupId),
                where("householdId", "==", currentHouseholdId)
            );
        } else if (editType === 'installment') {
            if (!(baseLancamento.parcelaAtual && baseLancamento.totalParcelas && baseLancamento.originalPurchaseAno)) {
                showMessageBox('Erro', 'Este lançamento não é uma parcela válida para edição em série.');
                return;
            }
            // Para parcelas, consultamos com base na data da compra original
            q = query(
                lancamentosCollection,
                where("originalPurchaseAno", "==", baseLancamento.originalPurchaseAno),
                where("originalPurchaseMes", "==", baseLancamento.originalPurchaseMes),
                where("originalPurchaseDia", "==", baseLancamento.originalPurchaseDia),
                where("householdId", "==", currentHouseholdId)
            );
        } else {
            showMessageBox('Erro', 'Tipo de edição em série inválido.');
            return;
        }

        const querySnapshot = await getDocs(q);
        console.log(`[applyEditToSeriesLancamentos] Documentos encontrados na query: ${querySnapshot.size}`);

        querySnapshot.forEach((docSnap) => {
            const lancamentoData = docSnap.data();
            let shouldUpdateDoc = false;

            // Lançamento atual sempre deve ser atualizado
            if (docSnap.id === idToUpdate) {
                shouldUpdateDoc = true;
                console.log(`[applyEditToSeriesLancamentos] Incluindo documento editado: ${docSnap.id}`);
            } else {
                // Para outros documentos na série/grupo, verifica se são "futuros"
                if (editType === 'recurring') {
                    const lancamentoDate = new Date(lancamentoData.ano, lancamentoData.mes - 1, lancamentoData.dia);
                    const baseDate = new Date(baseLancamento.ano, baseLancamento.mes - 1, baseLancamento.dia);

                    if (lancamentoDate.getTime() >= baseDate.getTime()) {
                        shouldUpdateDoc = true;
                        console.log(`[applyEditToSeriesLancamentos] Incluindo lançamento recorrente futuro: ${docSnap.id} (Data: ${lancamentoDate.toLocaleDateString()})`);
                    } else {
                        console.log(`[applyEditToSeriesLancamentos] Ignorando lançamento recorrente passado: ${docSnap.id} (Data: ${lancamentoDate.toLocaleDateString()})`);
                    }

                } else if (editType === 'installment') {
                    // Para parcelas, verifica se o número da parcela é igual ou posterior à parcela base
                    if (lancamentoData.parcelaAtual && baseLancamento.parcelaAtual && lancamentoData.parcelaAtual >= baseLancamento.parcelaAtual) {
                        shouldUpdateDoc = true;
                        console.log(`[applyEditToSeriesLancamentos] Incluindo parcela futura: ${docSnap.id} (Parcela: ${lancamentoData.parcelaAtual}/${lancamentoData.totalParcelas})`);
                    } else {
                        console.log(`[applyEditToSeriesLancamentos] Ignorando parcela passada: ${docSnap.id} (Parcela: ${lancamentoData.parcelaAtual}/${lancamentoData.totalParcelas})`);
                    }
                }
            }

            // Apenas procede com a atualização se shouldUpdateDoc for true E o campo não for 'dataCompleta'
            if (shouldUpdateDoc && field !== 'dataCompleta') {
                const docRef = doc(db, lancamentosCollection.path, docSnap.id);
                const updateData = {};

                if (field === 'descricao') {
                    // Para descrição de parcela, atualiza a descrição base e mantém o "(X/Y)"
                    if (editType === 'installment') {
                        const installmentPartMatch = lancamentoData.descricao.match(/\s\((\d+\/\d+)\)$/);
                        const installmentPart = installmentPartMatch ? installmentPartMatch[0] : ''; // CORREÇÃO AQUI
                        updateData[field] = `${newValue.trim()}${installmentPart}`;
                    } 
                    // Para descrição recorrente, apenas o novo valor (sem (X/Y))
                    else if (editType === 'recurring') {
                        updateData[field] = newValue.trim();
                    }
                } else {
                    updateData[field] = newValue;
                }

                // Lógica de ajuste adicional se o 'tipo' mudar
                if (field === 'tipo') {
                    if (newValue === 'entrada') {
                        updateData.parcelaAtual = null;
                        updateData.totalParcelas = null;
                        updateData.isRecurring = false;
                        updateData.recurringGroupId = null;
                        updateData.originalPurchaseDia = null;
                        updateData.originalPurchaseMes = null;
                        updateData.originalPurchaseAno = null;
                    } else if (newValue === 'saida' && !lancamentoData.isRecurring && lancamentoData.parcelaAtual === null && lancamentoData.totalParcelas === null) {
                        updateData.parcelaAtual = 1;
                        updateData.totalParcelas = 1;
                        if (!lancamentoData.originalPurchaseDia) {
                            updateData.originalPurchaseDia = lancamentoData.dia;
                            updateData.originalPurchaseMes = lancamentoData.mes;
                            updateData.originalPurchaseAno = lancamentoData.ano;
                        }
                    }
                }

                batchUpdates.push(setDoc(docRef, updateData, { merge: true }));
            }
        });

        if (batchUpdates.length > 0) {
            await Promise.all(batchUpdates); // Executa todas as atualizações simultaneamente
            showMessageBox('Sucesso', 'Lançamentos em série atualizados com sucesso!');
        } else {
            showMessageBox('Info', 'Nenhum lançamento futuro encontrado para atualização em massa com os critérios selecionados.');
        }
        pendingEditData = null; // Limpa os dados de edição pendentes

    } catch (e) {
        console.error("[applyEditToSeriesLancamentos] Erro ao aplicar edição em série:", e);
        showMessageBox('Erro', `Erro ao atualizar lançamentos em série: ${e.message}. Por favor, tente novamente.`);
    } finally {
        document.getElementById('messageBoxOkBtn').classList.remove('hidden'); // Mostra o botão OK novamente
    }
}

/**
 * Exclui um lançamento específico do Firestore.
 * @param {string} id O ID do documento a ser excluído.
 */
async function deleteLancamento(id) {
    if (!isAuthReady) {
        showMessageBox('Aguarde', 'Aplicação ainda carregando, por favor, aguarde.');
        return;
    }
    try {
        const docRef = doc(db, lancamentosCollection.path, id);
        await deleteDoc(docRef);
        showMessageBox('Sucesso', 'Lançamento excluído com sucesso!');
    } catch (e) {
        console.error("Erro ao excluir documento: ", e);
        showMessageBox('Erro', 'Erro ao excluir lançamento. Por favor, tente novamente.');
    }
}

/**
 * Manipula a seleção/desseleção do checkbox "Selecionar Todos".
 * @param {Event} event O objeto do evento de mudança.
 */
function handleSelectAllChange(event) {
    const isChecked = event.target.checked;
    document.querySelectorAll('.row-checkbox').forEach(checkbox => {
        checkbox.checked = isChecked;
        const id = checkbox.dataset.id;
        if (isChecked) {
            selectedLancamentosIds.add(id);
        } else {
            selectedLancamentosIds.delete(id);
        }
    });
    updateDeleteSelectedButtonVisibility();
}

/**
 * Manipula a seleção/desseleção de um checkbox de linha individual.
 * @param {Event} event O objeto do evento de mudança.
 */
function handleRowCheckboxChange(event) {
    const id = event.target.dataset.id;
    if (event.target.checked) {
        selectedLancamentosIds.add(id);
    } else {
        selectedLancamentosIds.delete(id);
    }
    updateSelectAllCheckboxState();
    updateDeleteSelectedButtonVisibility();
}

/**
 * Atualiza o estado do checkbox "Todos os Meses" (marcado/indeterminado/desmarcado).
 */
function updateSelectAllCheckboxState() {
    const allCheckboxes = document.querySelectorAll('.row-checkbox');
    if (!selectAllCheckbox) return;

    if (allCheckboxes.length === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
        return;
    }

    const checkedCheckboxes = Array.from(allCheckboxes).filter(cb => cb.checked);
    const allChecked = checkedCheckboxes.length === allCheckboxes.length;
    const someChecked = checkedCheckboxes.length > 0 && checkedCheckboxes.length < allCheckboxes.length;

    selectAllCheckbox.checked = allChecked;
    selectAllCheckbox.indeterminate = someChecked;
}

/**
 * Atualiza a visibilidade do botão "Excluir Selecionados".
 */
function updateDeleteSelectedButtonVisibility() {
    if (deleteSelectedBtn) {
        if (selectedLancamentosIds.size > 0) {
            deleteSelectedBtn.classList.remove('hidden');
        } else {
            deleteSelectedBtn.classList.add('hidden');
        }
    }
}

/**
 * Exclui todos os lançamentos atualmente selecionados na tabela.
 */
async function deleteSelectedLancamentos() {
    if (!isAuthReady) {
        showMessageBox('Aguarde', 'Aplicação ainda carregando, por favor, aguarde.');
        return;
    }
    if (selectedLancamentosIds.size === 0) {
        showMessageBox('Info', 'Nenhum lançamento selecionado para exclusão.');
        return;
    }

    const confirmation = await showConfirmBox('Confirmação', `Tem certeza que deseja excluir ${selectedLancamentosIds.size} lançamento(s) selecionado(s)?`);
    if (!confirmation) {
        return;
    }

    const deletePromises = [];
    selectedLancamentosIds.forEach(id => {
        const docRef = doc(db, lancamentosCollection.path, id);
        deletePromises.push(deleteDoc(docRef));
    });

    try {
        await Promise.all(deletePromises);
        showMessageBox('Sucesso', `${selectedLancamentosIds.size} lançamentos excluídos com sucesso!`);
        selectedLancamentosIds.clear(); // Limpa a seleção após a exclusão
    } catch (e) {
        console.error("Erro ao excluir lançamentos selecionados: ", e);
        showMessageBox('Erro', 'Erro ao excluir lançamentos selecionados. Por favor, tente novamente.');
    }
}

/**
 * Exibe o modal para selecionar os meses para parar uma recorrência.
 * @param {string} recurringId O ID do grupo de recorrência a ser parado.
 */
function showStopRecurringMonthsModal(recurringId) {
    currentRecurringGroupId = recurringId;

    // Resetar o estado do modal
    stopFromCurrentMonthCheckbox.checked = false;
    monthStopCheckboxes.forEach(cb => cb.checked = false);
    specificMonthsSelectionDiv.classList.remove('opacity-50', 'pointer-events-none'); // Habilitar a seção de meses

    const today = new Date();
    const currentMonthName = getMonthName(today.getMonth() + 1);
    const currentYear = today.getFullYear();
    currentMonthAndYearSpan.textContent = `${currentMonthName}/${currentYear}`;

    // Preenche as opções de ano no modal
    stopRecurringYearSelect.innerHTML = '';
    // Define um intervalo mais amplo para os anos (ex: 50 anos para trás e 50 para frente)
    const startYear = currentYear - 50;
    const endYear = currentYear + 50;
    for (let y = startYear; y <= endYear; y++) {
        const option = document.createElement('option');
        option.value = y;
        option.textContent = y;
        if (y === currentYear) {
            option.selected = true;
        }
        stopRecurringYearSelect.appendChild(option);
    }

    stopRecurringMonthsModalOverlay.classList.remove('hidden');
}

/**
 * Lida com a confirmação no modal de parar recorrência.
 */
async function handleStopRecurringConfirmation() {
    if (!currentRecurringGroupId) {
        showMessageBox('Erro', 'ID do grupo recorrente não definido.');
        return;
    }

    const stopFromCurrentMonthAndFuture = stopFromCurrentMonthCheckbox.checked;
    let selectedMonthsForStop = [];
    let selectedYearForStop = parseInt(stopRecurringYearSelect.value);

    if (!stopFromCurrentMonthAndFuture) {
        selectedMonthsForStop = Array.from(monthStopCheckboxes)
            .filter(cb => cb.checked)
            .map(cb => parseInt(cb.value));

        if (selectedMonthsForStop.length === 0) {
            showMessageBox('Aviso', 'Por favor, selecione pelo menos um mês ou marque a opção "Parar a partir do mês atual e futuros".');
            return;
        }
    } else {
        monthStopCheckboxes.forEach(cb => cb.checked = false);
        selectedMonthsForStop = []; // Garante que a lista esteja vazia
        selectedYearForStop = new Date().getFullYear(); // Usa o ano atual para a lógica "a partir do mês atual"
    }

    const confirmation = await showConfirmBox('Confirmação', 'Tem certeza que deseja parar esta cobrança recorrente com as opções selecionadas?');
    if (confirmation) {
        const currentMonth = new Date().getMonth() + 1; // Mês atual
        await stopRecurringExpense(currentRecurringGroupId, stopFromCurrentMonthAndFuture, selectedMonthsForStop, selectedYearForStop, currentMonth);
        stopRecurringMonthsModalOverlay.classList.add('hidden');
    }
}


/**
 * Interrompe uma cobrança recorrente, excluindo os lançamentos futuros associados ou meses específicos.
 * @param {string} recurringGroupId O ID do grupo de recorrência.
 * @param {boolean} stopFromCurrentMonthAndFuture Se deve parar a partir do mês atual e futuros.
 * @param {number[]} selectedMonthsForStop Array de números dos meses selecionados para parar (se não for stopFromCurrentMonthAndFuture).
 * @param {number} selectedYearForStop O ano para o qual a parada se aplica.
 * @param {number} currentMonthParameter O mês atual para a lógica "a partir do mês atual".
 */
async function stopRecurringExpense(recurringGroupId, stopFromCurrentMonthAndFuture, selectedMonthsForStop, selectedYearForStop, currentMonthParameter) {
    if (!isAuthReady) {
        showMessageBox('Aguarde', 'Aplicação ainda carregando, por favor, aguarde.');
        return;
    }

    if (!recurringGroupId) {
        showMessageBox('Erro', 'ID do grupo recorrente não encontrado.');
        return;
    }

    try {
        const q = query(
            lancamentosCollection,
            where("recurringGroupId", "==", recurringGroupId),
            where("householdId", "==", currentHouseholdId)
        );
        const querySnapshot = await getDocs(q);

        const deletePromises = [];
        let countDeleted = 0;
        const currentFullYear = new Date().getFullYear();
        const currentFullMonth = new Date().getMonth() + 1;

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            let shouldDelete = false;

            if (stopFromCurrentMonthAndFuture) {
                if (data.ano > currentFullYear || (data.ano === currentFullYear && data.mes >= currentFullMonth)) {
                    shouldDelete = true;
                }
            } else {
                if (data.ano === selectedYearForStop && selectedMonthsForStop.includes(data.mes)) {
                    shouldDelete = true;
                }
            }

            if (shouldDelete) {
                deletePromises.push(deleteDoc(doc(db, lancamentosCollection.path, docSnap.id)));
                countDeleted++;
            }
        });

        if (deletePromises.length > 0) {
            await Promise.all(deletePromises);
            showMessageBox('Sucesso', `${countDeleted} lançamentos recorrentes foram excluídos conforme sua seleção.`);
        } else {
            showMessageBox('Info', 'Nenhum lançamento encontrado para exclusão com os critérios selecionados.');
        }
    }
    catch (e) {
        console.error("Erro ao parar cobrança recorrente:", e);
        if (e.code === 'failed-precondition' && e.message.includes('The query requires an index')) {
            showMessageBox('Erro de Índice do Firestore', 'Sua consulta de parada de recorrência requer um índice no Firestore. Por favor, verifique o console do navegador para o link de criação do índice ou altere a lógica de filtragem.');
        } else {
            showMessageBox('Erro', `Erro ao parar a cobrança recorrente: ${e.message}. Por favor, tente novamente.`);
        }
    }
}

/**
 * Atualiza o resumo mensal com base nos lançamentos filtrados.
 */
function updateSummary() {
    if (!totalEntradasSpan || !totalSaidasSpan || !mediaDiariaSpan || !saldoMesSpan || 
        !filterMesAll || monthFilterCheckboxes.length === 0 || !filterAnoSelect || !searchBarInput) {
        console.warn("Elementos do resumo, filtro ou busca não encontrados (updateSummary). Retornando.");
        return;
    }

    const selectedMonthsFilter = Array.from(monthFilterCheckboxes)
        .filter(checkbox => checkbox.checked)
        .map(checkbox => parseInt(checkbox.value));

    const selectedYearFilter = filterAnoSelect.value;
    const searchTerm = searchBarInput.value.toLowerCase().trim();

    let filteredLancamentos = [...lancamentos];

    if (!filterMesAll.checked && selectedMonthsFilter.length > 0) {
        filteredLancamentos = filteredLancamentos.filter(l => selectedMonthsFilter.includes(l.mes));
    } else if (!filterMesAll.checked && selectedMonthsFilter.length === 0) {
        filteredLancamentos = [];
    }

    if (selectedYearFilter !== 'all') {
        const yearNumber = parseInt(selectedYearFilter);
        filteredLancamentos = filteredLancamentos.filter(l => l.ano === yearNumber);
    }

    if (searchTerm) {
        filteredLancamentos = filteredLancamentos.filter(l => 
            (l.descricao && l.descricao.toLowerCase().includes(searchTerm)) ||
            (l.categoria && l.categoria.toLowerCase().includes(searchTerm)) ||
            (l.valor && l.valor.toString().includes(searchTerm))
        );
    }

    let totalEntradas = 0;
    let totalSaidas = 0;
    let daysInMonth = 0;

    if (!filterMesAll.checked && selectedMonthsFilter.length === 1 && selectedYearFilter !== 'all') {
        const year = parseInt(selectedYearFilter);
        const month = parseInt(selectedMonthsFilter[0]);
        daysInMonth = new Date(year, month, 0).getDate();
    }

    filteredLancamentos.forEach(lancamento => {
        if (lancamento.tipo === 'entrada') {
            totalEntradas += lancamento.valor;
        } else if (lancamento.tipo === 'saida') {
            totalSaidas += lancamento.valor;
        }
    });

    const saldoMes = totalEntradas - totalSaidas;
    const mediaDiaria = daysInMonth > 0 ? totalSaidas / daysInMonth : 0;

    totalEntradasSpan.textContent = `R$ ${totalEntradas.toFixed(2).replace('.', ',')}`;
    totalSaidasSpan.textContent = `R$ ${totalSaidas.toFixed(2).replace('.', ',')}`;
    mediaDiariaSpan.textContent = `R$ ${mediaDiaria.toFixed(2).replace('.', ',')}`;
    saldoMesSpan.textContent = `R$ ${saldoMes.toFixed(2).replace('.', ',')}`;

    if (saldoMesSpan) {
        if (saldoMes >= 0) {
            saldoMesSpan.classList.remove('text-red-700');
            saldoMesSpan.classList.add('text-green-800');
        } else {
            saldoMesSpan.classList.remove('text-green-800');
            saldoMesSpan.classList.add('text-red-700');
        }
    }

    if (saldoStatusBar && saldoStatusText) {
        const totalAbsoluto = totalEntradas + totalSaidas;
        let percentualEntradas = 0;

        if (totalAbsoluto > 0) {
            percentualEntradas = (totalEntradas / totalAbsoluto) * 100;
        }

        saldoStatusBar.style.width = `${Math.min(percentualEntradas, 100)}%`;

        if (saldoMes >= 0) {
            saldoStatusBar.classList.remove('bg-red-500');
            saldoStatusBar.classList.add('bg-green-500');
            saldoStatusText.textContent = 'Saldo Positivo';
            saldoStatusText.classList.remove('text-red-700');
            saldoStatusText.classList.add('text-green-800');
        } else {
            saldoStatusBar.classList.remove('bg-green-500');
            saldoStatusBar.classList.add('bg-red-500');
            saldoStatusText.textContent = 'Saldo Negativo';
            saldoStatusText.classList.remove('text-green-800');
            saldoStatusText.classList.add('text-red-700');
        }
    }
}


/**
 * Função assíncrona para lidar com o envio do formulário de lançamento.
 * @param {Event} event O evento de envio do formulário.
 */
async function addGastoBtnClickHandler(event) {
    event.preventDefault(); // Evita o recarregamento da página

    if (!isAuthReady) {
        showMessageBox('Aguarde', 'Aplicação ainda carregando, por favor, aguarde a autenticação do utilizador.');
        return;
    }
    if (!userId) {
        showMessageBox('Erro', 'ID do utilizador não disponível. Por favor, recarregue a página ou faça login.');
        return;
    }
    if (!currentHouseholdId) {
        showMessageBox('Erro', 'ID da Família/Casa não definido. Por favor, defina um ID de Família/Casa antes de adicionar lançamentos.');
        return;
    }
    if (!lancamentosCollection) {
        showMessageBox('Erro', 'Coleção do Firestore não inicializada. Recarregue a página.');
        return;
    }

    // Coleta os valores do formulário
    const dia = parseInt(diaInput.value.split('-')[2]); // Extrai o dia do input type="date"
    const mes = parseInt(mesInput.value);
    const ano = parseInt(anoInput.value);
    const descricao = descricaoInput.value.trim();
    const valorTotal = parseFloat(valorInput.value);
    const categoria = categoriaSelect.value;
    const tipo = tipoEntradaRadio.checked ? tipoEntradaRadio.value : tipoSaidaRadio.value;
    const parcelaAtual = parseInt(parcelaAtualSelect.value);
    const totalParcelas = parseInt(totalParcelasSelect.value);
    const isRecurring = isRecurringCheckbox.checked;

    // Validações básicas
    if (isNaN(dia) || isNaN(mes) || isNaN(ano) || !descricao || isNaN(valorTotal) || valorTotal <= 0 || !categoria) {
        showMessageBox('Erro de Validação', 'Por favor, preencha todos os campos corretamente (valor deve ser positivo).');
        return;
    }
    if (mes < 1 || mes > 12) {
        showMessageBox('Erro de Validação', 'Mês inválido. Por favor, insira um mês entre 1 e 12.');
        return;
    }
    const currentYear = new Date().getFullYear();
    if (ano < currentYear - 100 || ano > currentYear + 100) {
        showMessageBox('Erro de Validação', `Ano inválido. Por favor, insira um ano entre ${currentYear - 100} e ${currentYear + 100}.`);
        return;
    }
    if (parcelaAtual > totalParcelas && totalParcelas !== 0) {
        showMessageBox('Erro de Validação', 'Parcela atual não pode ser maior que o total de parcelas.');
        return;
    }
    if (parcelaAtual === 0 && totalParcelas > 0) {
        showMessageBox('Erro de Validação', 'Se o total de parcelas for maior que 0, a parcela atual não pode ser "-".');
        return;
    }
    if (parcelaAtual > 0 && totalParcelas === 0) {
        showMessageBox('Erro de Validação', 'Se a parcela atual for maior que 0, o total de parcelas não pode ser "-".');
        return;
    }

    let recurringGroupId = null;
    if (isRecurring) {
        recurringGroupId = `${currentHouseholdId}-${Date.now()}`;
    }

    try {
        if (isRecurring) {
            for (let i = 0; i <= RECURRING_MONTHS_AHEAD; i++) {
                const futureDate = new Date(ano, mes - 1 + i, dia);
                const futureDay = futureDate.getDate();
                const futureMonth = futureDate.getMonth() + 1;
                const futureYear = futureDate.getFullYear();

                const newLancamento = {
                    dia: futureDay,
                    mes: futureMonth,
                    ano: futureYear,
                    descricao: descricao, 
                    valor: valorTotal,
                    categoria: categoria,
                    tipo: tipo,
                    isRecurring: true,
                    recurringGroupId: recurringGroupId,
                    createdAt: Date.now(),
                    userId: userId,
                    householdId: currentHouseholdId,
                    parcelaAtual: null,
                    totalParcelas: null,
                    originalPurchaseDia: null,
                    originalPurchaseMes: null,
                    originalPurchaseAno: null,
                };
                await addDoc(lancamentosCollection, newLancamento);
            }
            showMessageBox('Sucesso', `Cobrança recorrente adicionada para ${RECURRING_MONTHS_AHEAD + 1} meses!`);

        } else if (parcelaAtual === 1 && totalParcelas > 1) { // Geração automática de parcelas
            const originalPurchaseDay = dia;
            const originalPurchaseMonth = mes;
            const originalPurchaseYear = ano;
            const valorParcela = parseFloat((valorTotal / totalParcelas).toFixed(2));

            for (let i = 0; i < totalParcelas; i++) {
                const installmentNumber = i + 1;
                const futureDate = new Date(originalPurchaseYear, originalPurchaseMonth - 1 + i, originalPurchaseDay);
                const futureDay = futureDate.getDate();
                const futureMonth = futureDate.getMonth() + 1;
                const futureYear = futureDate.getFullYear();

                const newLancamento = {
                    dia: futureDay,
                    mes: futureMonth,
                    ano: futureYear,
                    descricao: `${descricao} (${installmentNumber}/${totalParcelas})`,
                    valor: valorParcela,
                    categoria: categoria,
                    tipo: tipo,
                    isRecurring: false,
                    recurringGroupId: null,
                    createdAt: Date.now() + i,
                    userId: userId,
                    householdId: currentHouseholdId,
                    parcelaAtual: installmentNumber,
                    totalParcelas: totalParcelas,
                    originalPurchaseDia: originalPurchaseDay,
                    originalPurchaseMes: originalPurchaseMonth,
                    originalPurchaseAno: originalPurchaseYear,
                };
                await addDoc(lancamentosCollection, newLancamento);
            }
            showMessageBox('Sucesso', `${totalParcelas} parcelas adicionadas com sucesso!`);
        }
        else if (parcelaAtual > 0 && totalParcelas > 0) { // Adiciona parcela única se não for a primeira de uma série
             const newLancamento = {
                dia: dia,
                mes: mes,
                ano: ano,
                descricao: `${descricao} (${parcelaAtual}/${totalParcelas})`,
                valor: valorTotal,
                categoria: categoria,
                tipo: tipo,
                isRecurring: false,
                recurringGroupId: null,
                createdAt: Date.now(),
                userId: userId,
                householdId: currentHouseholdId,
                parcelaAtual: parcelaAtual,
                totalParcelas: totalParcelas,
                originalPurchaseDia: originalInstallmentDate.day,
                originalPurchaseMes: originalInstallmentDate.month,
                originalPurchaseAno: originalInstallmentDate.year,
            };
            await addDoc(lancamentosCollection, newLancamento);
            showMessageBox('Sucesso', 'Lançamento parcelado adicionado com sucesso!');
        }
        else {
            // Lançamento único (não recorrente e não parcelado)
            const newLancamento = {
                dia: dia,
                mes: mes,
                ano: ano,
                descricao: descricao,
                valor: valorTotal,
                categoria: categoria,
                tipo: tipo,
                isRecurring: false,
                recurringGroupId: null,
                createdAt: Date.now(),
                userId: userId,
                householdId: currentHouseholdId,
                parcelaAtual: null,
                totalParcelas: null,
                originalPurchaseDia: null,
                originalPurchaseMes: null,
                originalPurchaseAno: null,
            };
            await addDoc(lancamentosCollection, newLancamento);
            showMessageBox('Sucesso', 'Lançamento adicionado com sucesso!');
        }

        // Limpa o formulário após a adição bem-sucedida, exceto para o dia atual
        descricaoInput.value = '';
        valorInput.value = '';
        categoriaSelect.value = '';
        tipoEntradaRadio.checked = true; // Volta para 'Entrada'
        parcelaAtualSelect.value = '0';
        totalParcelasSelect.value = '0';
        isRecurringCheckbox.checked = false; // Desmarca a recorrência

        // Mantém o dia/mês/ano preenchido para o dia atual após o envio
        // E redefine a data original da parcela para o dia atual
        const resetToday = new Date();
        const resetDay = String(resetToday.getDate()).padStart(2, '0');
        const resetMonth = String(resetToday.getMonth() + 1).padStart(2, '0');
        const resetYear = resetToday.getFullYear();
        diaInput.value = `${resetYear}-${resetMonth}-${resetDay}`;
        mesInput.value = resetToday.getMonth() + 1;
        anoInput.value = resetYear;

        originalInstallmentDate.day = resetToday.getDate();
        originalInstallmentDate.month = resetToday.getMonth() + 1;
        originalInstallmentDate.year = resetToday.getFullYear();

    } catch (e) {
        console.error("Erro ao adicionar lançamento: ", e);
        showMessageBox('Erro', `Erro ao adicionar lançamento: ${e.message}. Por favor, verifique sua conexão ou tente novamente.`);
    }
}

/**
 * Renderiza os lançamentos na tabela, aplicando os filtros selecionados.
 */
function renderLancamentos() {
    if (!gastosTableBody || !noExpensesMessage || !filterMesAll || monthFilterCheckboxes.length === 0 || !filterAnoSelect || !searchBarInput) {
        console.warn("Elementos da tabela, filtros ou busca não encontrados (renderLancamentos). Retornando.");
        return;
    }

    gastosTableBody.innerHTML = ''; // Limpa a tabela

    const selectedMonthsFilter = Array.from(monthFilterCheckboxes)
        .filter(checkbox => checkbox.checked)
        .map(checkbox => parseInt(checkbox.value));

    const selectedYearFilter = filterAnoSelect.value;
    const searchTerm = searchBarInput.value.toLowerCase().trim();

    let filteredLancamentos = [...lancamentos];

    if (!filterMesAll.checked && selectedMonthsFilter.length > 0) {
        filteredLancamentos = filteredLancamentos.filter(l => selectedMonthsFilter.includes(l.mes));
    } else if (!filterMesAll.checked && selectedMonthsFilter.length === 0) {
        filteredLancamentos = [];
    }

    if (selectedYearFilter !== 'all') {
        const yearNumber = parseInt(selectedYearFilter);
        filteredLancamentos = filteredLancamentos.filter(l => l.ano === yearNumber);
    }

    if (searchTerm) {
        filteredLancamentos = filteredLancamentos.filter(l => 
            (l.descricao && l.descricao.toLowerCase().includes(searchTerm)) ||
            (l.categoria && l.categoria.toLowerCase().includes(searchTerm)) ||
            (l.valor && l.valor.toString().includes(searchTerm))
        );
    }

    if (filteredLancamentos.length === 0) {
        noExpensesMessage.classList.remove('hidden');
        gastosTableBody.classList.add('hidden');
    } else {
        noExpensesMessage.classList.add('hidden');
        gastosTableBody.classList.remove('hidden');

        // Ordena os lançamentos: por ano (desc), depois mês (desc), depois dia (desc), depois createdAt (desc)
        filteredLancamentos.sort((a, b) => {
            if (a.ano !== b.ano) return b.ano - a.ano;
            if (a.mes !== b.mes) return b.mes - a.mes;
            if (a.dia !== b.dia) return b.dia - a.dia;
            return b.createdAt - a.createdAt; // Mais recente primeiro
        });

        filteredLancamentos.forEach(lancamento => {
            let displayedDescription = lancamento.descricao;

            // Para lançamentos recorrentes, remove qualquer formatação extra como "(Recorrente X/Y)"
            if (lancamento.isRecurring && displayedDescription.includes('(Recorrente')) {
                displayedDescription = displayedDescription.split(' (Recorrente')[0].trim();
            }
            // Para parcelas, exibe "Descrição (parcelaAtual/totalParcelas)"
            else if (lancamento.parcelaAtual && lancamento.totalParcelas && lancamento.parcelaAtual > 0 && lancamento.totalParcelas > 0) {
                displayedDescription = `${lancamento.descricao.split(' (')[0]} (${lancamento.parcelaAtual}/${lancamento.totalParcelas})`;
            }

            // Determina qual data exibir para parcelas vs. outros lançamentos
            const displayDay = (lancamento.parcelaAtual && lancamento.totalParcelas && lancamento.originalPurchaseDia) ? String(lancamento.originalPurchaseDia).padStart(2, '0') : String(lancamento.dia).padStart(2, '0');
            const displayMonth = (lancamento.parcelaAtual && lancamento.totalParcelas && lancamento.originalPurchaseMes) ? String(lancamento.originalPurchaseMes).padStart(2, '0') : String(lancamento.mes).padStart(2, '0');
            const displayYear = (lancamento.parcelaAtual && lancamento.totalParcelas && lancamento.originalPurchaseAno) ? lancamento.originalPurchaseAno : lancamento.ano;

            const formattedDate = `${displayDay}/${displayMonth}/${displayYear}`;


            const row = document.createElement('tr');
            row.className = `border-b border-gray-100 ${lancamento.tipo === 'entrada' ? 'bg-green-50' : 'bg-red-50'} hover:bg-gray-100 transition-colors duration-150`;
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">
                    <input type="checkbox" data-id="${lancamento.id}" class="form-checkbox h-4 w-4 text-blue-600 rounded row-checkbox" ${selectedLancamentosIds.has(lancamento.id) ? 'checked' : ''}>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800" data-id="${lancamento.id}" data-field="dataCompleta">${formattedDate}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                    ${lancamento.isRecurring ? `<button class="text-purple-600 hover:text-purple-900 stop-recurring-btn" data-id="${lancamento.id}" data-recurring-group-id="${lancamento.recurringGroupId}">Parar Recorrência</button>` : ''}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800" data-id="${lancamento.id}" data-field="descricao">${displayedDescription}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold ${lancamento.tipo === 'entrada' ? 'text-income' : 'text-expense'}" data-id="${lancamento.id}" data-field="valor">R$ ${lancamento.valor.toFixed(2).replace('.', ',')}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800" data-id="${lancamento.id}" data-field="categoria">${lancamento.categoria}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800" data-id="${lancamento.id}" data-field="tipo">${lancamento.tipo === 'entrada' ? 'Entrada' : 'Saída'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button class="text-indigo-600 hover:text-indigo-900 mr-3 edit-btn" data-id="${lancamento.id}">Editar</button>
                    <button class="text-red-600 hover:text-red-900 delete-btn" data-id="${lancamento.id}">Excluir</button>
                </td>
            `;
            gastosTableBody.appendChild(row);

            row.querySelectorAll('td[data-field]').forEach(cell => {
                cell.addEventListener('dblclick', () => handleEditCellClick(cell));
            });
            row.querySelector('.edit-btn').addEventListener('click', (e) => {
                showMessageBox('Informação', 'Para editar um lançamento, dê um clique duplo na célula que deseja modificar.');
            });
            row.querySelector('.delete-btn').addEventListener('click', async (e) => {
                const confirmation = await showConfirmBox('Confirmação', 'Tem certeza que deseja excluir este lançamento?');
                if (confirmation) {
                    deleteLancamento(e.target.dataset.id);
                }
            });

            const stopRecurringBtn = row.querySelector('.stop-recurring-btn');
            if (stopRecurringBtn) {
                stopRecurringBtn.addEventListener('click', (e) => { 
                    const recurringId = e.target.dataset.recurringGroupId;
                    showStopRecurringMonthsModal(recurringId); 
                });
            }

            row.querySelector('.row-checkbox').addEventListener('change', handleRowCheckboxChange);
        });
    }
    updateSelectAllCheckboxState();
    updateDeleteSelectedButtonVisibility();
}

/**
 * Atualiza os campos de dia, mês e ano no formulário de acordo com as parcelas selecionadas.
 */
function updateInstallmentDateFields() {
    const currentParcelaAtual = parseInt(parcelaAtualSelect.value);
    const currentTotalParcelas = parseInt(totalParcelasSelect.value);

    // Se é uma cobrança recorrente, ou se não há parcelas selecionadas,
    // os campos de data devem refletir a data atual ou o que o utilizador escolheu livremente.
    if (isRecurringCheckbox.checked || (currentParcelaAtual === 0 && currentTotalParcelas === 0)) {
        const today = new Date();
        originalInstallmentDate.day = today.getDate();
        originalInstallmentDate.month = today.getMonth() + 1;
        originalInstallmentDate.year = today.getFullYear();
        return;
    }

    // Se parcelas estão selecionadas mas originalInstallmentDate ainda não foi definida
    if ((currentParcelaAtual > 0 || currentTotalParcelas > 0) && originalInstallmentDate.day === null) {
        try {
            const selectedDate = new Date(diaInput.value + 'T00:00:00');
            if (!isNaN(selectedDate.getTime())) {
                originalInstallmentDate.day = selectedDate.getDate();
                originalInstallmentDate.month = selectedDate.getMonth() + 1;
                originalInstallmentDate.year = selectedDate.getFullYear();
            }
        } catch (e) {
            console.warn("Erro ao definir originalInstallmentDate a partir do diaInput:", e);
        }
    }

    if (currentParcelaAtual === 1) {
        try {
            const selectedDate = new Date(diaInput.value + 'T00:00:00');
            if (!isNaN(selectedDate.getTime())) {
                originalInstallmentDate.day = selectedDate.getDate();
                originalInstallmentDate.month = selectedDate.getMonth() + 1;
                originalInstallmentDate.year = selectedDate.getFullYear();
            } else {
                const today = new Date();
                originalInstallmentDate.day = today.getDate();
                originalInstallmentDate.month = today.getMonth() + 1;
                originalInstallmentDate.year = today.getFullYear();
            }
        } catch (e) {
            console.error("Erro ao parsear data do diaInput para originalInstallmentDate:", e);
            const today = new Date();
            originalInstallmentDate.day = today.getDate();
            originalInstallmentDate.month = today.getMonth() + 1;
            originalInstallmentDate.year = today.getFullYear();
        }
    }

    if (originalInstallmentDate.day !== null && currentParcelaAtual > 0 && currentTotalParcelas > 0) {
        const baseDate = new Date(originalInstallmentDate.year, originalInstallmentDate.month - 1, originalInstallmentDate.day);

        const targetDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + (currentParcelaAtual - 1), originalInstallmentDate.day);

        if (targetDate.getDate() !== originalInstallmentDate.day) {
            targetDate.setDate(0);
            targetDate.setMonth(targetDate.getMonth() + 1);
        }

        const newDay = String(targetDate.getDate()).padStart(2, '0');
        const newMonth = String(targetDate.getMonth() + 1).padStart(2, '0');
        const newYear = targetDate.getFullYear();

        diaInput.value = `${newYear}-${newMonth}-${newDay}`;
        mesInput.value = parseInt(newMonth);
        anoInput.value = newYear;
    }
}


/**
 * Configura o listener em tempo real para a coleção de lançamentos do Firestore.
 */
function setupFirestoreListener() {
    if (!db || !lancamentosCollection) {
        console.error("Firestore ou coleção não inicializados para o listener.");
        return;
    }
    if (!currentHouseholdId) {
        console.warn("setupFirestoreListener: currentHouseholdId não está definido, não será possível carregar os lançamentos.");
        if (gastosTableBody) gastosTableBody.innerHTML = '';
        if (noExpensesMessage) noExpensesMessage.classList.remove('hidden');
        return;
    }

    // Cria uma query para buscar os lançamentos do Firestore por 'householdId'
    const q = query(
        lancamentosCollection,
        where("householdId", "==", currentHouseholdId) 
    );

    // onSnapshot fornece atualizações em tempo real
    if (typeof window.unsubscribeFirestore !== 'undefined') {
        window.unsubscribeFirestore();
    }

    window.unsubscribeFirestore = onSnapshot(q, (snapshot) => {
        lancamentos = [];
        const updatePromises = [];

        snapshot.forEach((docSnap) => {
            let data = docSnap.data();
            let needsUpdate = false;

            // Lógica de migração em leitura para lançamentos parcelados (garante originalPurchaseDia/Mes/Ano)
            if (data.parcelaAtual && data.totalParcelas && data.parcelaAtual > 0 && data.totalParcelas > 0) {
                if (data.originalPurchaseDia === undefined || data.originalPurchaseDia === null) {
                    data.originalPurchaseDia = data.dia;
                    data.originalPurchaseMes = data.mes;
                    data.originalPurchaseAno = data.ano;
                    needsUpdate = true;
                }
            }

            lancamentos.push({ id: docSnap.id, ...data });

            if (needsUpdate) {
                const docRef = doc(db, lancamentosCollection.path, docSnap.id);
                updatePromises.push(setDoc(docRef, { 
                    originalPurchaseDia: data.originalPurchaseDia,
                    originalPurchaseMes: data.originalPurchaseMes,
                    originalPurchaseAno: data.originalPurchaseAno
                }, { merge: true }));
            }
        });

        if (updatePromises.length > 0) {
            Promise.all(updatePromises)
                .then(() => console.log("Firestore: Lançamentos parcelados antigos atualizados com a data de compra original."))
                .catch(e => console.error("Firestore: Erro ao atualizar lançamentos parcelados antigos:", e));
        }

        renderLancamentos();
        updateSummary();
    }, (error) => {
        console.error("Erro ao receber dados do Firestore: ", error);
        showMessageBox("Erro de Sincronização", `Não foi possível sincronizar os dados com o Firestore. Por favor, verifique sua conexão.`);
    });
}

/**
 * Função assíncrona para categorizar a descrição usando a Gemini API.
 * @param {string} description A descrição do lançamento.
 * @returns {Promise<string|null>} A categoria sugerida ou null em caso de erro.
 */
async function categorizeDescription(description) {
    if (!description.trim()) {
        return null;
    }

    const categories = ["Salário", "Renda Extra", "Investimento", "Alimentação", "Transporte", "Lazer", "Moradia", "Contas", "Educação", "Saúde", "Outros"];
    const prompt = `Dada a seguinte descrição de um lançamento financeiro, categorize-o em uma das seguintes categorias: ${categories.join(', ')}. Retorne apenas o nome da categoria. Se a descrição não se encaixar claramente em nenhuma, retorne "Outros".
    Descrição: "${description}"
    Categoria:`;

    let chatHistory = [];
    chatHistory.push({ role: "user", parts: [{ text: prompt }] });
    const payload = { 
        contents: chatHistory,
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: {
                    "category": { "type": "STRING" }
                }
            }
        }
    };
    const apiKey = "";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    if (categoryLoadingIndicator) {
        categoryLoadingIndicator.classList.remove('hidden');
        categoryLoadingIndicator.textContent = 'Categorizando...';
    }

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (categoryLoadingIndicator) {
            categoryLoadingIndicator.classList.add('hidden');
            categoryLoadingIndicator.textContent = '';
        }

        if (result.candidates && result.candidates.length > 0 &&
            result.candidates[0].content && result.candidates[0].content.parts &&
            result.candidates[0].content.parts.length > 0) {

            const jsonText = result.candidates[0].content.parts[0].text;
            let parsedJson;
            try {
                parsedJson = JSON.parse(jsonText);
            } catch (parseError) {
                console.error("Erro ao fazer parse do JSON da API:", parseError);
                console.error("Resposta bruta da API:", jsonText);
                return null;
            }

            const suggestedCategory = parsedJson.category;
            if (categories.includes(suggestedCategory)) {
                return suggestedCategory;
            } else {
                console.warn(`Categoria sugerida pela IA "${suggestedCategory}" não é válida. Retornando "Outros".`);
                return "Outros";
            }
        } else {
            console.warn("Resposta da API Gemini não contém a estrutura esperada:", result);
            return null;
        }
    } catch (error) {
        console.error("Erro ao chamar a API Gemini para categorização:", error);
        if (categoryLoadingIndicator) {
            categoryLoadingIndicator.classList.add('hidden');
            categoryLoadingIndicator.textContent = '';
        }
        return null;
    }
}

/**
 * Gerencia o registo de um novo utilizador com email e palavra-passe.
 */
async function handleSignUp() {
    const email = authEmailInput.value;
    const password = authPasswordInput.value;

    if (!email || !password) {
        showMessageBox('Erro de Validação', 'Por favor, preencha o email e a palavra-passe.');
        return;
    }

    authLoadingIndicator.classList.remove('hidden');
    authMessage.textContent = '';

    try {
        await createUserWithEmailAndPassword(auth, email, password);
        showMessageBox('Sucesso', 'Registo bem-sucedido! Pode agora fazer login.');
        authModalOverlay.classList.add('hidden'); // Esconde o modal após o registo
    } catch (error) {
        console.error("Erro no registo:", error);
        let errorMessage = 'Erro ao registar. Por favor, tente novamente.';
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = 'Este email já está em uso. Tente fazer login ou use outro email.';
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'A palavra-passe deve ter pelo menos 6 caracteres.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Formato de email inválido.';
        }
        authMessage.textContent = errorMessage;
    } finally {
        authLoadingIndicator.classList.add('hidden');
    }
}

/**
 * Gerencia o login de um utilizador existente com email e palavra-passe.
 */
async function handleSignIn() {
    const email = authEmailInput.value;
    const password = authPasswordInput.value;

    if (!email || !password) {
        showMessageBox('Erro de Validação', 'Por favor, preencha o email e a palavra-passe.');
        return;
    }

    authLoadingIndicator.classList.remove('hidden');
    authMessage.textContent = '';

    try {
        await signInWithEmailAndPassword(auth, email, password);
        showMessageBox('Sucesso', 'Login bem-sucedido!');
        authModalOverlay.classList.add('hidden'); // Esconde o modal após o login
    } catch (error) {
        console.error("Erro no login:", error);
        let errorMessage = 'Erro ao fazer login. Verifique seu email e palavra-passe.';
        if (error.code === 'auth/invalid-credential') { // Novo erro genérico para credenciais inválidas
             errorMessage = 'Credenciais inválidas. Verifique seu email e palavra-passe.';
        } else if (error.code === 'auth/user-disabled') {
            errorMessage = 'Sua conta foi desativada.';
        }
        authMessage.textContent = errorMessage;
    } finally {
        authLoadingIndicator.classList.add('hidden');
    }
}

/**
 * Função para atribuir todos os elementos DOM e configurar seus listeners.
 * Deve ser chamada apenas quando o DOM estiver completamente carregado e o Firebase estiver pronto.
 */
function initializeUI() {
    // Atribui e verifica todos os elementos DOM aqui
    // É CRÍTICO que todos os IDs abaixo existam no seu HTML!
    lancamentoForm = document.getElementById('lancamentoForm');
    diaInput = document.getElementById('dia');
    mesInput = document.getElementById('mes');
    anoInput = document.getElementById('ano');
    descricaoInput = document.getElementById('descricao');
    valorInput = document.getElementById('valor');
    categoriaSelect = document.getElementById('categoria');
    tipoEntradaRadio = document.getElementById('tipoEntrada');
    tipoSaidaRadio = document.getElementById('tipoSaida');
    addGastoBtn = document.getElementById('addGastoBtn');
    gastosTableBody = document.getElementById('gastosTableBody');
    totalEntradasSpan = document.getElementById('totalEntradas');
    totalSaidasSpan = document.getElementById('totalSaidas');
    mediaDiariaSpan = document.getElementById('mediaDiaria');
    saldoMesSpan = document.getElementById('saldoMes');
    filterMesGroup = document.getElementById('filterMesGroup');
    filterMesAll = document.getElementById('filterMesAll');
    filterAnoSelect = document.getElementById('filterAno');
    noExpensesMessage = document.getElementById('no-expenses-message');
    parcelaAtualSelect = document.getElementById('parcelaAtual');
    totalParcelasSelect = document.getElementById('totalParcelas');
    parcelaFieldsDiv = document.getElementById('parcelaFields');
    userIdDisplay = document.getElementById('user-id-display');
    joinHouseholdIdInput = document.getElementById('joinHouseholdIdInput');
    setHouseholdIdBtn = document.getElementById('setHouseholdIdBtn');
    selectAllCheckbox = document.getElementById('selectAllCheckbox');
    deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
    isRecurringCheckbox = document.getElementById('isRecurring');
    saldoStatusBar = document.getElementById('saldoBar');
    saldoStatusText = document.getElementById('saldoStatus');
    stopRecurringMonthsModalOverlay = document.getElementById('stopRecurringMonthsModalOverlay');
    stopFromCurrentMonthCheckbox = document.getElementById('stopFromCurrentMonthCheckbox');
    currentMonthAndYearSpan = document.getElementById('currentMonthAndYear');
    specificMonthsSelectionDiv = document.getElementById('specificMonthsSelection');
    stopRecurringYearSelect = document.getElementById('stopRecurringYearSelect');
    cancelStopRecurringBtn = document.getElementById('cancelStopRecurringBtn');
    confirmStopRecurringBtn = document.getElementById('confirmStopRecurringBtn');
    searchBarInput = document.getElementById('searchBar');
    categoryLoadingIndicator = document.getElementById('categoryLoadingIndicator');
    editRecurringChoiceModalOverlay = document.getElementById('editRecurringChoiceModalOverlay');
    editRecurringChoiceMessage = document.getElementById('editRecurringChoiceMessage');
    applyToThisBtn = document.getElementById('applyToThisBtn');
    applyToFutureBtn = document.getElementById('applyToFutureBtn');
    cancelEditRecurringBtn = document.getElementById('cancelEditRecurringBtn');
    authModalOverlay = document.getElementById('authModalOverlay');
    authModalTitle = document.getElementById('authModalTitle');
    authMessage = document.getElementById('authMessage');
    authEmailInput = document.getElementById('authEmailInput');
    authPasswordInput = document.getElementById('authPasswordInput');
    registerBtn = document.getElementById('registerBtn');
    loginBtn = document.getElementById('loginBtn');
    authLoadingIndicator = document.getElementById('authLoadingIndicator');


    // Tratamento especial para NodeList elements (classes)
    monthFilterCheckboxes = document.querySelectorAll('.month-filter-checkbox');
    monthStopCheckboxes = document.querySelectorAll('.month-stop-checkbox');

    // Inicializa valores padrão para o formulário de adição
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0'); // Meses são 0-indexedados
    const year = today.getFullYear();
    diaInput.value = `${year}-${month}-${day}`;
    mesInput.value = today.getMonth() + 1;
    anoInput.value = today.getFullYear();

    // Inicializa a data original da parcela com a data atual
    originalInstallmentDate.day = today.getDate();
    originalInstallmentDate.month = today.getMonth() + 1;
    originalInstallmentDate.year = today.getFullYear();

    // Preenche dinamicamente as opções de Ano para o formulário de adição
    const currentYear = today.getFullYear();
    let yearOptions = '<option value="">Selecione o Ano</option>';
    for (let y = currentYear - 100; y <= currentYear + 100; y++) {
        yearOptions += `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`;
    }
    anoInput.innerHTML = yearOptions;

    // Preenche dinamicamente as opções de Ano para o filtro
    let filterYearOptions = '<option value="all">Todos os Anos</option>';
    for (let y = currentYear - 100; y <= currentYear + 100; y++) {
        filterYearOptions += `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`;
    }
    filterAnoSelect.innerHTML = filterYearOptions;

    // Preenche as opções de Parcelas
    parcelaAtualSelect.innerHTML = '<option value="0">-</option>';
    totalParcelasSelect.innerHTML = '<option value="0">-</option>';
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

    // Define a visibilidade inicial dos campos de parcela: SEMPRE VISÍVEL por padrão
    parcelaFieldsDiv.classList.remove('hidden');


    // Adiciona Event Listeners
    if (lancamentoForm) lancamentoForm.addEventListener('submit', addGastoBtnClickHandler);

    // Listener para o diaInput para atualizar mês e ano automaticamente
    if (diaInput) diaInput.addEventListener('change', () => {
        const selectedDate = new Date(diaInput.value + 'T00:00:00');
        if (!isNaN(selectedDate.getTime())) {
            mesInput.value = selectedDate.getMonth() + 1;
            anoInput.value = selectedDate.getFullYear();
            if (parseInt(parcelaAtualSelect.value) === 1 && parseInt(totalParcelasSelect.value) > 0) {
                originalInstallmentDate.day = selectedDate.getDate();
                originalInstallmentDate.month = selectedDate.getMonth() + 1;
                originalInstallmentDate.year = selectedDate.getFullYear();
            }
        } else {
            mesInput.value = '';
            anoInput.value = '';
        }
    });

    // Listener para o campo de descrição para categorização inteligente
    let debounceTimer;
    if (descricaoInput) descricaoInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            const description = descricaoInput.value;
            const suggestedCategory = await categorizeDescription(description);
            if (suggestedCategory) {
                const options = Array.from(categoriaSelect.options).map(option => option.value);
                if (options.includes(suggestedCategory)) {
                    categoriaSelect.value = suggestedCategory;
                } else {
                    categoriaSelect.value = 'Outros';
                }
            }
        }, 500);
    });

    // Adiciona listeners para os checkboxes de mês (filterMesGroup e monthFilterCheckboxes)
    if (filterMesAll) filterMesAll.addEventListener('change', handleFilterMesAllChange);
    if (filterMesAll) filterMesAll.checked = true; // Marcar "Todos os Meses" por padrão ao carregar

    monthFilterCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', handleMonthFilterCheckboxChange);
    });
    updateMonthFilterCheckboxesState();

    if (filterAnoSelect) filterAnoSelect.addEventListener('change', () => {
        updateSummary();
        renderLancamentos();
    });

    if (selectAllCheckbox) selectAllCheckbox.addEventListener('change', handleSelectAllChange);

    if (deleteSelectedBtn) deleteSelectedBtn.addEventListener('click', async () => {
        const confirmation = await showConfirmBox('Confirmação', 'Tem certeza que deseja excluir os lançamentos selecionados?');
        if (confirmation) {
            deleteSelectedLancamentos();
        }
    });

    if (isRecurringCheckbox) isRecurringCheckbox.addEventListener('change', (event) => {
        if (event.target.checked) {
            parcelaAtualSelect.value = '0';
            totalParcelasSelect.value = '0';
        }
        updateInstallmentDateFields();
    });

    // Listeners para atualizar a data quando parcelaAtual ou totalParcelas mudam
    if (parcelaAtualSelect) parcelaAtualSelect.addEventListener('change', updateInstallmentDateFields);
    if (totalParcelasSelect) totalParcelasSelect.addEventListener('change', updateInstallmentDateFields);

    // Listeners para o modal de parar recorrência
    if (stopFromCurrentMonthCheckbox) stopFromCurrentMonthCheckbox.addEventListener('change', (event) => {
        if (event.target.checked) {
            specificMonthsSelectionDiv.classList.add('opacity-50', 'pointer-events-none');
            monthStopCheckboxes.forEach(cb => cb.checked = false);
        } else {
            specificMonthsSelectionDiv.classList.remove('opacity-50', 'pointer-events-none');
        }
    });
    if (cancelStopRecurringBtn) cancelStopRecurringBtn.addEventListener('click', () => {
        stopRecurringMonthsModalOverlay.classList.add('hidden');
    });
    if (confirmStopRecurringBtn) confirmStopRecurringBtn.addEventListener('click', handleStopRecurringConfirmation);

    // Listener para o botão "Definir ID"
    if (setHouseholdIdBtn) setHouseholdIdBtn.addEventListener('click', () => {
        const newHouseholdId = joinHouseholdIdInput.value.trim();
        if (newHouseholdId) {
            currentHouseholdId = newHouseholdId;
            localStorage.setItem('savedHouseholdId', currentHouseholdId);
            showMessageBox('Sucesso', `ID da Família/Casa alterado para: ${currentHouseholdId}`);
            setupFirestoreListener(); // Re-configura o listener com o novo ID
        } else {
            showMessageBox('Aviso', 'Por favor, insira um ID de Família/Casa válido.');
        }
    });

    // Listener para o campo de busca
    if (searchBarInput) searchBarInput.addEventListener('input', () => {
        renderLancamentos();
        updateSummary();
    });

    // Listeners para o modal de escolha de edição recorrente/parcelada
    if (applyToThisBtn) applyToThisBtn.addEventListener('click', () => {
        if (pendingEditData) {
            applyEditToSingleLancamento(
                pendingEditData.id,
                pendingEditData.field,
                pendingEditData.newValue,
                pendingEditData.currentLancamento
            );
            pendingEditData = null;
        }
        editRecurringChoiceModalOverlay.classList.add('hidden');
    });
    if (applyToFutureBtn) applyToFutureBtn.addEventListener('click', () => {
        if (pendingEditData) {
            applyEditToSeriesLancamentos(
                pendingEditData.id,
                pendingEditData.field,
                pendingEditData.newValue,
                pendingEditData.currentLancamento,
                pendingEditData.type
            );
            pendingEditData = null;
        }
        editRecurringChoiceModalOverlay.classList.add('hidden');
    });
    if (cancelEditRecurringBtn) cancelEditRecurringBtn.addEventListener('click', () => {
        pendingEditData = null;
        editRecurringChoiceModalOverlay.classList.add('hidden');
    });

    // Event listeners para os botões de autenticação
    if (registerBtn) registerBtn.addEventListener('click', handleSignUp);
    if (loginBtn) loginBtn.addEventListener('click', handleSignIn);
}


// Inicializa o Firebase e, em seguida, a UI após a autenticação
document.addEventListener('DOMContentLoaded', async () => {
    try {
        if (!firebaseConfig || Object.keys(firebaseConfig).length === 0 || !firebaseConfig.apiKey || !firebaseConfig.projectId) {
            showMessageBox("Erro de Configuração", "As configurações do Firebase estão ausentes ou incompletas. Por favor, preencha as credenciais no script.js.");
            console.error("Firebase config is empty or invalid:", firebaseConfig);
            return; // Interrompe a inicialização se a config for inválida
        }

        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);

        // Listener de estado de autenticação principal
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                // Usuário autenticado (via email/password ou token personalizado)
                userId = user.uid;
                authModalOverlay.classList.add('hidden'); // Esconde o modal de autenticação
                
                // Tenta carregar o ID da família/casa guardado no localStorage
                const savedHouseholdId = localStorage.getItem('savedHouseholdId');
                if (savedHouseholdId) {
                    currentHouseholdId = savedHouseholdId;
                } else {
                    // Se não houver ID guardado, usa o UID do utilizador como o ID da família/casa
                    currentHouseholdId = userId;
                    localStorage.setItem('savedHouseholdId', currentHouseholdId);
                }

                initializeUI(); // Inicializa a UI com o utilizador autenticado
                
                if (userIdDisplay) userIdDisplay.textContent = `ID do Usuário: ${userId}`;
                if (householdIdDisplay) householdIdDisplay.textContent = currentHouseholdId;
                // Deixa o joinHouseholdIdInput em branco para o utilizador preencher
                if (joinHouseholdIdInput) joinHouseholdIdInput.value = ''; 

                // Define a coleção do Firestore e inicia o listener
                lancamentosCollection = collection(db, `artifacts/${appId}/public/data/lancamentos`);
                isAuthReady = true;
                setupFirestoreListener();

            } else {
                // Nenhum utilizador autenticado
                console.log("Nenhum utilizador autenticado. Verificando token ou mostrando modal de login.");
                if (initialAuthToken) {
                    // Tenta autenticar com o token personalizado do Canvas
                    try {
                        console.log("Tentando autenticar com token personalizado...");
                        await signInWithCustomToken(auth, initialAuthToken);
                        // Se for bem-sucedido, onAuthStateChanged será chamado novamente com o utilizador
                    } catch (error) {
                        console.error("Erro ao autenticar com token personalizado:", error);
                        // Se o token personalizado falhar, mostra o modal de login
                        authModalOverlay.classList.remove('hidden');
                        authModalTitle.textContent = "Faça Login ou Registre-se";
                        authMessage.textContent = "Não foi possível autenticar automaticamente. Por favor, faça login ou registe-se.";
                        isAuthReady = false; // A aplicação não está pronta sem autenticação
                    }
                } else {
                    // Se não houver token personalizado, mostra diretamente o modal de login
                    authModalOverlay.classList.remove('hidden');
                    authModalTitle.textContent = "Faça Login ou Registre-se";
                    authMessage.textContent = "Para usar a aplicação, por favor, faça login ou registe-se.";
                    isAuthReady = false; // A aplicação não está pronta sem autenticação
                }
            }
        });

    } catch (error) {
        console.error("Erro fatal ao inicializar aplicação:", error);
        const userIdDisplayFallback = document.getElementById('user-id-display');
        if (userIdDisplayFallback) userIdDisplayFallback.textContent = `Erro ao carregar ID do Usuário.`;
        showMessageBox("Erro Crítico", 'Erro ao carregar a aplicação. Por favor, tente novamente mais tarde. Verifique o console do navegador para mais detalhes.');
        
        // Em caso de erro crítico de inicialização, esconde a UI principal e mostra o modal de autenticação
        // para evitar que o utilizador tente interagir com uma app quebrada.
        authModalOverlay.classList.remove('hidden');
        authModalTitle.textContent = "Erro na Aplicação";
        authMessage.textContent = "Houve um erro crítico ao iniciar a aplicação. Por favor, tente novamente mais tarde.";
        isAuthReady = false;
    }
});
