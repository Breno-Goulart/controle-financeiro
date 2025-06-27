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
    orderBy,
    getDocs,
    writeBatch, // Adicionado para operações em lote
    serverTimestamp // Adicionado para timestamps do servidor
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
                pendingEditData = { id: lancamentoId, field, newValue: updateData[field], currentLancamento, // Passa o lançamento atual completo type: currentLancamento.isRecurring ? 'recurring' : 'installment' };
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
    if (!confirmation) return;

    let updateData = {};
    if (field === 'descricao' && baseLancamento.parcelaAtual && baseLancamento.totalParcelas) {
        const installmentPartMatch = baseLancamento.descricao.match(/\s\((\d+\/\d+)\)$/);
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
        } else if (newValue === 'saida' && !baseLancamento.isRecurring && baseLancamento.parcelaAtual === null && baseLancamento.totalParcelas === null) {
            updateData.parcelaAtual = 1;
            updateData.totalParcelas = 1;
            if (!baseLancamento.originalPurchaseDia) {
                updateData.originalPurchaseDia = baseLancamento.dia;
                updateData.originalPurchaseMes = baseLancamento.mes;
                updateData.originalPurchaseAno = baseLancamento.ano;
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
        let queryRef;
        if (editType === 'recurring') {
            // Se for recorrente, atualiza todos com o mesmo recurringGroupId a partir da data atual
            queryRef = query(
                lancamentosCollection,
                where('recurringGroupId', '==', baseLancamento.recurringGroupId),
                where('ano', '>=', baseLancamento.ano), // Usar ano e mês do lançamento base para filtrar futuros
                where('mes', '>=', baseLancamento.mes),
                where('dia', '>=', baseLancamento.dia)
                // É essencial ter orderBys correspondentes aos where aqui se não houver um único where e orderby
                // Para update em massa, Firestore precisa de índices
            );
        } else if (editType === 'installment') {
            // Se for parcelado, atualiza todas as parcelas da mesma série a partir da parcela atual
            queryRef = query(
                lancamentosCollection,
                where('originalPurchaseDia', '==', baseLancamento.originalPurchaseDia),
                where('originalPurchaseMes', '==', baseLancamento.originalPurchaseMes),
                where('originalPurchaseAno', '==', baseLancamento.originalPurchaseAno),
                where('descricao', '==', baseLancamento.descricao.split(' (')[0]), // Matching base description
                where('valor', '==', baseLancamento.valor), // Assuming value is also constant for the series
                where('totalParcelas', '==', baseLancamento.totalParcelas),
                where('parcelaAtual', '>=', baseLancamento.parcelaAtual)
            );
        }

        if (queryRef) {
            const querySnapshot = await getDocs(queryRef);
            const batch = writeBatch(db); // Use batch writes for multiple updates
            querySnapshot.forEach((docSnap) => {
                const docRef = doc(db, lancamentosCollection.path, docSnap.id);
                batch.update(docRef, updateData);
            });
            await batch.commit();
            showMessageBox('Sucesso', 'Lançamentos futuros atualizados com sucesso!');
        } else {
            showMessageBox('Erro', 'Tipo de edição desconhecido para propagação.');
        }

    } catch (e) {
        console.error("Erro ao atualizar lançamentos em massa: ", e);
        showMessageBox('Erro', 'Erro ao atualizar lançamentos futuros. Por favor, tente novamente.');
    }
}

// Function to attach DOM elements to variables
function initializeUI() {
    // Basic elements
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

    // Filter elements
    filterMesGroup = document.getElementById('filterMesGroup');
    filterMesAll = document.getElementById('filterMesAll');
    monthFilterCheckboxes = document.querySelectorAll('.month-filter-checkbox');
    filterAnoSelect = document.getElementById('filterAno');

    // No expenses message
    noExpensesMessage = document.getElementById('noExpensesMessage');

    // Installment fields
    parcelaAtualSelect = document.getElementById('parcelaAtual');
    totalParcelasSelect = document.getElementById('totalParcelas');
    parcelaFieldsDiv = document.getElementById('parcelaFields');

    // Household ID elements
    userIdDisplay = document.getElementById('user-id-display');
    joinHouseholdIdInput = document.getElementById('joinHouseholdIdInput');
    setHouseholdIdBtn = document.getElementById('setHouseholdIdBtn');

    // Mass selection/deletion
    selectAllCheckbox = document.getElementById('selectAllCheckbox');
    deleteSelectedBtn = document.getElementById('deleteSelectedBtn');

    // Recurring charge
    isRecurringCheckbox = document.getElementById('isRecurring');

    // Redesigned summary elements
    saldoStatusBar = document.getElementById('saldoStatusBar');
    saldoStatusText = document.getElementById('saldoStatusText');

    // Stop recurring modal elements
    stopRecurringMonthsModalOverlay = document.getElementById('stopRecurringMonthsModalOverlay');
    stopFromCurrentMonthCheckbox = document.getElementById('stopFromCurrentMonthCheckbox');
    currentMonthAndYearSpan = document.getElementById('currentMonthAndYear');
    specificMonthsSelectionDiv = document.getElementById('specificMonthsSelection');
    monthStopCheckboxes = document.querySelectorAll('.stop-month-checkbox');
    stopRecurringYearSelect = document.getElementById('stopRecurringYearSelect');
    cancelStopRecurringBtn = document.getElementById('cancelStopRecurringBtn');
    confirmStopRecurringBtn = document.getElementById('confirmStopRecurringBtn');

    // Search bar
    searchBarInput = document.getElementById('searchBar');

    // Auto categorization feedback
    categoryLoadingIndicator = document.getElementById('categoryLoadingIndicator');

    // Edit recurring/installment choice modal
    editRecurringChoiceModalOverlay = document.getElementById('editRecurringChoiceModalOverlay');
    editRecurringChoiceMessage = document.getElementById('editRecurringChoiceMessage');
    applyToThisBtn = document.getElementById('applyToThisBtn');
    applyToFutureBtn = document.getElementById('applyToFutureBtn');
    cancelEditRecurringBtn = document.getElementById('cancelEditRecurringBtn');


    // Populate year filter
    const currentYear = new Date().getFullYear();
    for (let i = currentYear - 5; i <= currentYear + 5; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = i;
        if (i === currentYear) {
            option.selected = true;
        }
        filterAnoSelect.appendChild(option);
    }
    // Populate stop recurring year select
    for (let i = currentYear - 5; i <= currentYear + 5; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = i;
        if (i === currentYear) {
            option.selected = true;
        }
        stopRecurringYearSelect.appendChild(option);
    }

    // Event Listeners
    lancamentoForm.addEventListener('submit', addLancamento);
    filterMesAll.addEventListener('change', handleFilterMesAllChange);
    monthFilterCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', handleMonthFilterCheckboxChange);
    });
    filterAnoSelect.addEventListener('change', () => {
        updateSummary();
        renderLancamentos();
    });
    setHouseholdIdBtn.addEventListener('click', setHouseholdId);
    selectAllCheckbox.addEventListener('change', handleSelectAllChange);
    deleteSelectedBtn.addEventListener('click', deleteSelectedLancamentos);
    gastosTableBody.addEventListener('click', (event) => {
        const target = event.target;
        if (target.classList.contains('select-item-checkbox')) {
            handleSelectItemChange(event);
        } else if (target.classList.contains('delete-btn')) {
            deleteLancamento(target.dataset.id);
        } else if (target.classList.contains('stop-recurring-btn')) {
            openStopRecurringModal(target.dataset.recurringGroupId, target.dataset.originalPurchaseYear, target.dataset.originalPurchaseMonth);
        } else if (target.tagName === 'TD' && target.dataset.id && target.dataset.field) {
            handleEditCellClick(target);
        }
    });

    // Initial state for parcelamento fields
    function updateParcelaFieldsVisibility() {
        if (isRecurringCheckbox.checked) {
            parcelaFieldsDiv.classList.add('hidden');
        } else {
            parcelaFieldsDiv.classList.remove('hidden');
        }
    }
    isRecurringCheckbox.addEventListener('change', updateParcelaFieldsVisibility);
    updateParcelaFieldsVisibility(); // Set initial visibility

    // Hide parcelamento fields by default initially
    parcelaFieldsDiv.classList.add('hidden');

    // Show/hide parcela fields based on tipo
    tipoEntradaRadio.addEventListener('change', () => {
        parcelaFieldsDiv.classList.add('hidden');
        isRecurringCheckbox.checked = false;
        updateParcelaFieldsVisibility();
    });
    tipoSaidaRadio.addEventListener('change', () => {
        parcelaFieldsDiv.classList.remove('hidden');
        updateParcelaFieldsVisibility();
    });

    // Stop recurring modal listeners
    stopFromCurrentMonthCheckbox.addEventListener('change', toggleSpecificMonthsSelection);
    cancelStopRecurringBtn.addEventListener('click', () => {
        stopRecurringMonthsModalOverlay.classList.add('hidden');
    });
    confirmStopRecurringBtn.addEventListener('click', confirmStopRecurring);

    // Edit recurring/installment choice modal listeners
    applyToThisBtn.addEventListener('click', () => {
        editRecurringChoiceModalOverlay.classList.add('hidden');
        if (pendingEditData) {
            applyEditToSingleLancamento(pendingEditData.id, pendingEditData.field, pendingEditData.newValue, pendingEditData.currentLancamento);
            pendingEditData = null;
        }
    });
    applyToFutureBtn.addEventListener('click', () => {
        editRecurringChoiceModalOverlay.classList.add('hidden');
        if (pendingEditData) {
            applyEditToSeriesLancamentos(pendingEditData.id, pendingEditData.field, pendingEditData.newValue, pendingEditData.currentLancamento, pendingEditData.type);
            pendingEditData = null;
        }
    });
    cancelEditRecurringBtn.addEventListener('click', () => {
        editRecurringChoiceModalOverlay.classList.add('hidden');
        pendingEditData = null;
    });

    searchBarInput.addEventListener('input', () => {
        renderLancamentos(); // Re-render on search input
    });
}

// Function to toggle specific months selection in stop recurring modal
function toggleSpecificMonthsSelection() {
    if (stopFromCurrentMonthCheckbox.checked) {
        specificMonthsSelectionDiv.classList.add('hidden');
    } else {
        specificMonthsSelectionDiv.classList.remove('hidden');
        // Reset specific month checkboxes if they were previously checked
        monthStopCheckboxes.forEach(cb => cb.checked = false);
    }
}

// Function to handle opening the stop recurring modal
function openStopRecurringModal(recurringGroupId, originalPurchaseYear, originalPurchaseMonth) {
    currentRecurringGroupId = recurringGroupId;
    // Set current month and year in the modal message
    const today = new Date();
    currentMonthAndYearSpan.textContent = `${getMonthName(today.getMonth() + 1)} de ${today.getFullYear()}`;

    // Pre-select the original purchase month in the specific months selection if applicable
    monthStopCheckboxes.forEach(cb => {
        if (parseInt(cb.value) === parseInt(originalPurchaseMonth)) {
            cb.checked = true;
        } else {
            cb.checked = false; // Uncheck others
        }
    });
    stopRecurringYearSelect.value = originalPurchaseYear; // Pre-select the original purchase year

    stopFromCurrentMonthCheckbox.checked = true; // Default to stopping from current month
    toggleSpecificMonthsSelection(); // Hide specific months initially

    stopRecurringMonthsModalOverlay.classList.remove('hidden');
}

// Function to confirm stopping recurring charges
async function confirmStopRecurring() {
    if (!currentRecurringGroupId) {
        showMessageBox('Erro', 'Nenhum grupo de recorrência selecionado.');
        return;
    }

    const confirm = await showConfirmBox('Confirmar Parada', 'Tem certeza que deseja parar esta cobrança recorrente para os meses selecionados? Isso removerá os lançamentos futuros.');
    if (!confirm) return;

    try {
        let monthsToStop = [];
        let stopYear = parseInt(stopRecurringYearSelect.value);

        if (stopFromCurrentMonthCheckbox.checked) {
            // Stop from current month onwards for all future occurrences
            const today = new Date();
            const currentMonth = today.getMonth() + 1; // 1-indexed
            const currentYear = today.getFullYear();

            // Fetch all recurring charges for this group that are in the future or current month/year
            const q = query(
                lancamentosCollection,
                where('recurringGroupId', '==', currentRecurringGroupId),
                where('ano', '>=', currentYear),
                where('mes', '>=', currentMonth)
            );
            const querySnapshot = await getDocs(q);
            const batch = writeBatch(db);
            querySnapshot.forEach((docSnap) => {
                // Ensure we only delete future or current month entries
                if (docSnap.data().ano > currentYear || (docSnap.data().ano === currentYear && docSnap.data().mes >= currentMonth)) {
                     batch.delete(doc(db, lancamentosCollection.path, docSnap.id));
                }
            });
            await batch.commit();
            showMessageBox('Sucesso', 'Cobrança recorrente parada e lançamentos futuros removidos!');
        } else {
            // Stop for specific selected months
            monthStopCheckboxes.forEach(cb => {
                if (cb.checked) {
                    monthsToStop.push(parseInt(cb.value));
                }
            });

            if (monthsToStop.length === 0) {
                showMessageBox('Aviso', 'Nenhum mês selecionado para parar a recorrência.');
                return;
            }

            // Fetch and delete documents for the selected months and year
            const q = query(
                lancamentosCollection,
                where('recurringGroupId', '==', currentRecurringGroupId),
                where('ano', '==', stopYear),
                where('mes', 'in', monthsToStop) // Use 'in' query for multiple months
            );
            const querySnapshot = await getDocs(q);
            const batch = writeBatch(db);
            querySnapshot.forEach((docSnap) => {
                batch.delete(doc(db, lancamentosCollection.path, docSnap.id));
            });
            await batch.commit();
            showMessageBox('Sucesso', `Cobrança recorrente parada para os meses selecionados de ${stopYear}!`);
        }

        stopRecurringMonthsModalOverlay.classList.add('hidden');
        currentRecurringGroupId = null; // Reset
    } catch (e) {
        console.error("Erro ao parar cobrança recorrente: ", e);
        showMessageBox('Erro', 'Erro ao parar cobrança recorrente. Por favor, tente novamente.');
    }
}

/**
 * Adiciona um novo lançamento ao Firestore.
 * @param {Event} event O objeto do evento de submissão do formulário.
 */
async function addLancamento(event) {
    event.preventDefault(); // Previne o recarregamento da página

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

    const parcelaAtual = isRecurring ? null : (parseInt(parcelaAtualSelect.value) || null);
    const totalParcelas = isRecurring ? null : (parseInt(totalParcelasSelect.value) || null);

    if (!descricao || isNaN(valor) || valor <= 0 || !categoria || isNaN(dia) || isNaN(mes) || isNaN(ano)) {
        showMessageBox('Erro de Validação', 'Por favor, preencha todos os campos obrigatórios e insira um valor positivo.');
        return;
    }

    // Validação para parcelas
    if (tipo === 'saida' && !isRecurring) {
        if ((parcelaAtual !== null && totalParcelas === null) || (parcelaAtual === null && totalParcelas !== null)) {
            showMessageBox('Erro de Validação', 'Se for uma despesa parcelada, por favor, preencha tanto "Parcela Atual" quanto "Total de Parcelas".');
            return;
        }
        if (parcelaAtual > totalParcelas && totalParcelas !== 0) {
            showMessageBox('Erro de Validação', 'A Parcela Atual não pode ser maior que o Total de Parcelas.');
            return;
        }
        if (parcelaAtual === 0 && totalParcelas !== 0 || parcelaAtual !== 0 && totalParcelas === 0) {
            showMessageBox('Erro de Validação', 'Se um for 0, o outro também deve ser 0 para parcelas. Use "-" para não-parcelado.');
            return;
        }
    }

    // Adiciona o lancamento ao Firestore
    try {
        if (isRecurring) {
            const recurringGroupId = doc(collection(db, "recurringGroups")).id; // Gera um ID único para o grupo recorrente
            const batch = writeBatch(db);

            // Adiciona o lançamento original
            const baseDocRef = doc(lancamentosCollection);
            batch.set(baseDocRef, {
                householdId: currentHouseholdId,
                dia,
                mes,
                ano,
                descricao,
                valor,
                categoria,
                tipo,
                isRecurring: true,
                recurringGroupId: recurringGroupId,
                originalPurchaseDia: dia,
                originalPurchaseMes: mes,
                originalPurchaseAno: ano,
                createdAt: serverTimestamp() // Adiciona timestamp para ordenação
            });

            // Cria lançamentos futuros para os próximos X meses (RECURRING_MONTHS_AHEAD)
            let currentMonth = mes;
            let currentYear = ano;
            for (let i = 1; i <= RECURRING_MONTHS_AHEAD; i++) {
                currentMonth++;
                if (currentMonth > 12) {
                    currentMonth = 1;
                    currentYear++;
                }
                const futureDocRef = doc(lancamentosCollection);
                batch.set(futureDocRef, {
                    householdId: currentHouseholdId,
                    dia, // Mantém o dia do lançamento original
                    mes: currentMonth,
                    ano: currentYear,
                    descricao,
                    valor,
                    categoria,
                    tipo,
                    isRecurring: true,
                    recurringGroupId: recurringGroupId,
                    originalPurchaseDia: dia,
                    originalPurchaseMes: mes,
                    originalPurchaseAno: ano,
                    createdAt: serverTimestamp() // Adiciona timestamp para ordenação
                });
            }
            await batch.commit();
            showMessageBox('Sucesso', 'Lançamento recorrente adicionado e programado para os próximos meses!');

        } else if (parcelaAtual && totalParcelas && totalParcelas > 0) {
            // Lançamento parcelado
            const baseDescription = descricao; // Salva a descrição original
            for (let i = 1; i <= totalParcelas; i++) {
                const installmentDescription = `${baseDescription} (${i}/${totalParcelas})`;
                const docRef = doc(lancamentosCollection);
                await setDoc(docRef, {
                    householdId: currentHouseholdId,
                    dia,
                    mes,
                    ano,
                    descricao: installmentDescription, // Descrição com (X/Y)
                    valor,
                    categoria,
                    tipo,
                    parcelaAtual: i,
                    totalParcelas: totalParcelas,
                    // Armazena a data original da primeira parcela para referência em edições em massa
                    originalPurchaseDia: dia,
                    originalPurchaseMes: mes,
                    originalPurchaseAno: ano,
                    createdAt: serverTimestamp() // Adiciona timestamp para ordenação
                });
            }
            showMessageBox('Sucesso', 'Lançamento parcelado adicionado com sucesso!');

        } else {
            // Lançamento único (não recorrente, não parcelado)
            const docRef = doc(lancamentosCollection);
            await setDoc(docRef, {
                householdId: currentHouseholdId,
                dia,
                mes,
                ano,
                descricao,
                valor,
                categoria,
                tipo,
                parcelaAtual: null,
                totalParcelas: null,
                isRecurring: false,
                recurringGroupId: null,
                originalPurchaseDia: null, // Limpa para lançamentos únicos
                originalPurchaseMes: null,
                originalPurchaseAno: null, // Limpa para lançamentos únicos
                createdAt: serverTimestamp() // Adiciona timestamp para ordenação
            });
            showMessageBox('Sucesso', 'Lançamento adicionado com sucesso!');
        }

        // Limpa o formulário após adicionar
        lancamentoForm.reset();
        isRecurringCheckbox.checked = false; // Reset recurring checkbox
        updateParcelaFieldsVisibility(); // Update visibility after reset
        diaInput.value = String(new Date().getDate()).padStart(2, '0');
        mesInput.value = String(new Date().getMonth() + 1).padStart(2, '0');
        anoInput.value = new Date().getFullYear();
    } catch (e) {
        console.error("Erro ao adicionar lançamento: ", e);
        showMessageBox('Erro', 'Erro ao adicionar lançamento. Por favor, tente novamente.');
    }
}

/**
 * Define o Household ID para o utilizador atual.
 */
async function setHouseholdId() {
    const newHouseholdId = joinHouseholdIdInput.value.trim();
    if (newHouseholdId) {
        currentHouseholdId = newHouseholdId;
        localStorage.setItem('savedHouseholdId', currentHouseholdId);
        if (userIdDisplay) userIdDisplay.textContent = `ID do Usuário: ${userId} (Household: ${currentHouseholdId})`;
        showMessageBox('Sucesso', `ID da Família/Casa definido para: ${currentHouseholdId}`);
        setupFirestoreListener(); // Re-fetch data with the new household ID
    } else {
        showMessageBox('Aviso', 'Por favor, insira um ID de Família/Casa válido.');
    }
}

/**
 * Lida com a seleção/desseleção de todos os itens na tabela.
 * @param {Event} event O objeto do evento de mudança.
 */
function handleSelectAllChange(event) {
    const isChecked = event.target.checked;
    document.querySelectorAll('.select-item-checkbox').forEach(checkbox => {
        checkbox.checked = isChecked;
        const lancamentoId = checkbox.dataset.id;
        if (isChecked) {
            selectedLancamentosIds.add(lancamentoId);
        } else {
            selectedLancamentosIds.delete(lancamentoId);
        }
    });
    updateDeleteButtonState();
}

/**
 * Lida com a seleção/desseleção de um item individual na tabela.
 * @param {Event} event O objeto do evento de mudança.
 */
function handleSelectItemChange(event) {
    const lancamentoId = event.target.dataset.id;
    if (event.target.checked) {
        selectedLancamentosIds.add(lancamentoId);
    } else {
        selectedLancamentosIds.delete(lancamentoId);
    }
    updateDeleteButtonState();
    updateSelectAllCheckboxState();
}

/**
 * Atualiza o estado do botão de exclusão em massa (habilitado/desabilitado).
 */
function updateDeleteButtonState() {
    deleteSelectedBtn.disabled = selectedLancamentosIds.size === 0;
    deleteSelectedBtn.textContent = `Excluir Selecionados (${selectedLancamentosIds.size})`;
}

/**
 * Atualiza o estado do checkbox "Selecionar Todos" (marcado/indeterminado/desmarcado).
 */
function updateSelectAllCheckboxState() {
    const allItemCheckboxes = document.querySelectorAll('.select-item-checkbox');
    const checkedItemCheckboxes = document.querySelectorAll('.select-item-checkbox:checked');

    if (allItemCheckboxes.length === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
        return;
    }

    if (checkedItemCheckboxes.length === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
    } else if (checkedItemCheckboxes.length === allItemCheckboxes.length) {
        selectAllCheckbox.checked = true;
        selectAllCheckbox.indeterminate = false;
    } else {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = true;
    }
}

/**
 * Exclui um lançamento do Firestore.
 * @param {string} id O ID do documento a ser excluído.
 */
async function deleteLancamento(id) {
    const confirm = await showConfirmBox('Confirmar Exclusão', 'Tem certeza que deseja excluir este lançamento?');
    if (!confirm) return;

    try {
        const lancamentoToDelete = lancamentos.find(l => l.id === id);
        if (lancamentoToDelete.isRecurring && lancamentoToDelete.recurringGroupId) {
            const confirmRecurring = await showConfirmBox('Excluir Recorrência', 'Este é um lançamento recorrente. Deseja excluir apenas este lançamento ou todos os lançamentos futuros desta série?');
            if (confirmRecurring) {
                // Excluir todos os lançamentos futuros da série
                await deleteRecurringSeries(lancamentoToDelete.recurringGroupId, lancamentoToDelete.ano, lancamentoToDelete.mes, lancamentoToDelete.dia);
            } else {
                // Excluir apenas este lançamento
                await deleteDoc(doc(db, lancamentosCollection.path, id));
            }
        } else if (lancamentoToDelete.parcelaAtual && lancamentoToDelete.totalParcelas > 0) {
            const confirmInstallment = await showConfirmBox('Excluir Parcela', 'Este é um lançamento parcelado. Deseja excluir apenas esta parcela ou todas as parcelas futuras desta série?');
            if (confirmInstallment) {
                // Excluir todas as parcelas futuras da série
                await deleteInstallmentSeries(lancamentoToDelete);
            } else {
                // Excluir apenas esta parcela
                await deleteDoc(doc(db, lancamentosCollection.path, id));
            }
        } else {
            // Lançamento único
            await deleteDoc(doc(db, lancamentosCollection.path, id));
        }

        showMessageBox('Sucesso', 'Lançamento excluído com sucesso!');
        selectedLancamentosIds.delete(id); // Remove do conjunto de selecionados
        updateDeleteButtonState();
    } catch (e) {
        console.error("Erro ao excluir lançamento: ", e);
        showMessageBox('Erro', 'Erro ao excluir lançamento. Por favor, tente novamente.');
    }
}

/**
 * Exclui todos os lançamentos selecionados do Firestore.
 */
async function deleteSelectedLancamentos() {
    if (selectedLancamentosIds.size === 0) {
        showMessageBox('Aviso', 'Nenhum lançamento selecionado para exclusão.');
        return;
    }

    const confirm = await showConfirmBox('Confirmar Exclusão em Massa', `Tem certeza que deseja excluir ${selectedLancamentosIds.size} lançamentos selecionados?`);
    if (!confirm) return;

    const batch = writeBatch(db);
    selectedLancamentosIds.forEach(id => {
        batch.delete(doc(db, lancamentosCollection.path, id));
    });

    try {
        await batch.commit();
        showMessageBox('Sucesso', `${selectedLancamentosIds.size} lançamentos excluídos com sucesso!`);
        selectedLancamentosIds.clear(); // Limpa o conjunto
        updateDeleteButtonState();
    } catch (e) {
        console.error("Erro ao excluir lançamentos selecionados: ", e);
        showMessageBox('Erro', 'Erro ao excluir lançamentos selecionados. Por favor, tente novamente.');
    }
}

/**
 * Exclui uma série de lançamentos recorrentes a partir de um ponto.
 * @param {string} recurringGroupId O ID do grupo de recorrência.
 * @param {number} startYear O ano a partir do qual excluir.
 * @param {number} startMonth O mês a partir do qual excluir.
 * @param {number} startDay O dia a partir do qual excluir.
 */
async function deleteRecurringSeries(recurringGroupId, startYear, startMonth, startDay) {
    const q = query(
        lancamentosCollection,
        where('recurringGroupId', '==', recurringGroupId),
        orderBy('ano'),
        orderBy('mes'),
        orderBy('dia')
    );
    const querySnapshot = await getDocs(q);
    const batch = writeBatch(db);
    querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        // Exclui lançamentos que são iguais ou futuros ao ponto de início
        if (data.ano > startYear ||
            (data.ano === startYear && data.mes > startMonth) ||
            (data.ano === startYear && data.mes === startMonth && data.dia >= startDay)) {
            batch.delete(doc(db, lancamentosCollection.path, docSnap.id));
        }
    });
    await batch.commit();
}

/**
 * Exclui uma série de lançamentos parcelados a partir de uma parcela específica.
 * @param {object} baseLancamento O lançamento base da série.
 */
async function deleteInstallmentSeries(baseLancamento) {
    const q = query(
        lancamentosCollection,
        where('originalPurchaseDia', '==', baseLancamento.originalPurchaseDia),
        where('originalPurchaseMes', '==', baseLancamento.originalPurchaseMes),
        where('originalPurchaseAno', '==', baseLancamento.originalPurchaseAno),
        where('descricao', '==', baseLancamento.descricao.split(' (')[0]), // Matching base description
        where('valor', '==', baseLancamento.valor), // Assuming value is also constant for the series
        where('totalParcelas', '==', baseLancamento.totalParcelas),
        where('parcelaAtual', '>=', baseLancamento.parcelaAtual)
    );
    const querySnapshot = await getDocs(q);
    const batch = writeBatch(db);
    querySnapshot.forEach((docSnap) => {
        batch.delete(doc(db, lancamentosCollection.path, docSnap.id));
    });
    await batch.commit();
}


/**
 * Configura o listener do Firestore para buscar lançamentos.
 * Esta função é chamada uma vez na inicialização e novamente ao mudar o householdId.
 */
function setupFirestoreListener() {
    if (!currentHouseholdId) {
        console.warn("currentHouseholdId não definido. Não será possível buscar lançamentos.");
        gastosTableBody.innerHTML = '<tr><td colspan="9" class="text-center py-4 text-gray-500">Nenhum ID de Família/Casa definido. Por favor, defina um ID acima.</td></tr>';
        return;
    }

    // A consulta que requer o índice composto
    const q = query(
        lancamentosCollection,
        where('householdId', '==', currentHouseholdId),
        orderBy('ano', 'desc'),
        orderBy('mes', 'desc'),
        orderBy('dia', 'desc'),
        orderBy('createdAt', 'desc') // Garante uma ordem única para resultados estáveis
    );

    onSnapshot(q, (querySnapshot) => {
        lancamentos = []; // Limpa os lançamentos existentes
        querySnapshot.forEach((doc) => {
            lancamentos.push({ id: doc.id, ...doc.data() });
        });

        // Aplica o filtro de mês e ano antes de renderizar
        renderLancamentos();
        updateSummary();
    }, (error) => {
        console.error("Erro ao buscar lançamentos: ", error);
        showMessageBox('Erro de Dados', `Erro ao carregar lançamentos: ${error.message}. Verifique sua conexão e permissões.`);
        gastosTableBody.innerHTML = '<tr><td colspan="9" class="text-center py-4 text-red-500">Erro ao carregar lançamentos.</td></tr>';
    });
}

/**
 * Renderiza os lançamentos na tabela, aplicando filtros e busca.
 */
function renderLancamentos() {
    gastosTableBody.innerHTML = ''; // Limpa a tabela

    let filteredLancamentos = [...lancamentos]; // Cria uma cópia para filtrar

    // Aplicar filtro de ano
    const selectedAno = parseInt(filterAnoSelect.value);
    if (!isNaN(selectedAno)) {
        filteredLancamentos = filteredLancamentos.filter(l => l.ano === selectedAno);
    }

    // Aplicar filtro de mês
    const selectedMonths = Array.from(monthFilterCheckboxes)
                                .filter(cb => cb.checked)
                                .map(cb => parseInt(cb.value));

    if (selectedMonths.length > 0 && selectedMonths.length < 12) { // Se nem todos os meses estão selecionados
        filteredLancamentos = filteredLancamentos.filter(l => selectedMonths.includes(l.mes));
    }

    // Aplicar filtro de busca
    const searchTerm = searchBarInput.value.toLowerCase().trim();
    if (searchTerm) {
        filteredLancamentos = filteredLancamentos.filter(l =>
            l.descricao.toLowerCase().includes(searchTerm) ||
            l.categoria.toLowerCase().includes(searchTerm)
        );
    }

    if (filteredLancamentos.length === 0) {
        noExpensesMessage.classList.remove('hidden');
        gastosTableBody.innerHTML = '';
        return;
    } else {
        noExpensesMessage.classList.add('hidden');
    }

    // Sort lancamentos for consistent display, most recent first
    filteredLancamentos.sort((a, b) => {
        if (a.ano !== b.ano) return b.ano - a.ano;
        if (a.mes !== b.mes) return b.mes - a.mes;
        if (a.dia !== b.dia) return b.dia - a.dia;
        // Fallback for same day, month, year (e.g., by createdAt timestamp if available)
        if (a.createdAt && b.createdAt) {
             return b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime();
        }
        return 0;
    });

    filteredLancamentos.forEach(lancamento => {
        const row = gastosTableBody.insertRow();
        row.className = `border-b ${lancamento.tipo === 'entrada' ? 'bg-green-50' : 'bg-red-50'} hover:bg-gray-100 transition-colors duration-200`;

        const isChecked = selectedLancamentosIds.has(lancamento.id);

        row.innerHTML = `
            <td class="px-4 py-2 text-center">
                <input type="checkbox" class="select-item-checkbox form-checkbox h-4 w-4 text-blue-600 rounded" data-id="${lancamento.id}" ${isChecked ? 'checked' : ''}>
            </td>
            <td class="px-4 py-2 text-sm text-gray-800 text-center" data-id="${lancamento.id}" data-field="dataCompleta">${String(lancamento.dia).padStart(2, '0')}/${String(lancamento.mes).padStart(2, '0')}/${lancamento.ano}</td>
            <td class="px-4 py-2 text-sm text-gray-800" data-id="${lancamento.id}" data-field="descricao">${lancamento.descricao}</td>
            <td class="px-4 py-2 text-sm ${lancamento.tipo === 'entrada' ? 'text-income' : 'text-expense'} text-right" data-id="${lancamento.id}" data-field="valor">${lancamento.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
            <td class="px-4 py-2 text-sm text-gray-800" data-id="${lancamento.id}" data-field="categoria">${lancamento.categoria}</td>
            <td class="px-4 py-2 text-sm text-center" data-id="${lancamento.id}" data-field="tipo">
                <span class="px-2 py-1 rounded-full text-xs font-semibold ${lancamento.tipo === 'entrada' ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}">
                    ${lancamento.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                </span>
            </td>
            <td class="px-4 py-2 text-sm text-gray-600 text-center" data-id="${lancamento.id}" data-field="parcelaAtual">${lancamento.parcelaAtual ? `${lancamento.parcelaAtual}/${lancamento.totalParcelas}` : '-'}</td>
            <td class="px-4 py-2 text-sm text-center">
                ${lancamento.isRecurring ? `<button class="stop-recurring-btn text-blue-500 hover:text-blue-700 font-medium text-xs px-2 py-1 rounded-md bg-blue-100 hover:bg-blue-200 transition-colors" data-recurring-group-id="${lancamento.recurringGroupId}" data-original-purchase-year="${lancamento.originalPurchaseAno}" data-original-purchase-month="${lancamento.originalPurchaseMes}">Parar Recorrência</button>` : '-'}
            </td>
            <td class="px-4 py-2 text-center">
                <button class="delete-btn text-red-500 hover:text-red-700 focus:outline-none" data-id="${lancamento.id}">
                    <svg class="w-5 h-5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 0 00-1-1h-4a1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            </td>
        `;
    });
    updateDeleteButtonState();
    updateSelectAllCheckboxState();
}

/**
 * Atualiza os totais de entradas, saídas, saldo e média diária.
 */
function updateSummary() {
    const selectedAno = parseInt(filterAnoSelect.value);
    const selectedMonths = Array.from(monthFilterCheckboxes)
                                .filter(cb => cb.checked)
                                .map(cb => parseInt(cb.value));

    let totalEntradas = 0;
    let totalSaidas = 0;
    let daysInMonthCount = 0; // Para calcular a média diária

    // Calcula a média diária apenas para o mês selecionado
    if (selectedMonths.length === 1 && !isNaN(selectedAno)) {
        const daysInSelectedMonth = new Date(selectedAno, selectedMonths[0], 0).getDate();
        daysInMonthCount = daysInSelectedMonth;
    } else if (selectedMonths.length > 1 && !isNaN(selectedAno)) {
        // Se vários meses são selecionados, soma os dias de cada mês
        selectedMonths.forEach(month => {
            daysInMonthCount += new Date(selectedAno, month, 0).getDate();
        });
    }


    lancamentos.forEach(lancamento => {
        const matchesYear = isNaN(selectedAno) || lancamento.ano === selectedAno;
        const matchesMonth = selectedMonths.length === 0 || selectedMonths.includes(lancamento.mes);

        if (matchesYear && matchesMonth) {
            if (lancamento.tipo === 'entrada') {
                totalEntradas += lancamento.valor;
            } else {
                totalSaidas += lancamento.valor;
            }
        }
    });

    const saldo = totalEntradas - totalSaidas;
    const mediaDiaria = daysInMonthCount > 0 ? totalSaidas / daysInMonthCount : 0; // Média de gastos

    totalEntradasSpan.textContent = totalEntradas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    totalSaidasSpan.textContent = totalSaidas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    saldoMesSpan.textContent = saldo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    mediaDiariaSpan.textContent = mediaDiaria.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    // Atualiza a barra de status do saldo
    if (saldoStatusBar) {
        if (saldo > 0) {
            saldoStatusBar.className = 'w-full h-2 rounded-full bg-green-400';
            saldoStatusText.textContent = 'Positivo';
            saldoStatusText.className = 'text-green-600 font-semibold';
        } else if (saldo < 0) {
            saldoStatusBar.className = 'w-full h-2 rounded-full bg-red-400';
            saldoStatusText.textContent = 'Negativo';
            saldoStatusText.className = 'text-red-600 font-semibold';
        } else {
            saldoStatusBar.className = 'w-full h-2 rounded-full bg-gray-400';
            saldoStatusText.textContent = 'Zero';
            saldoStatusText.className = 'text-gray-600 font-semibold';
        }
    }
}


// Firebase Initialization
document.addEventListener('DOMContentLoaded', async () => {
    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);

        onAuthStateChanged(auth, async (user) => {
            if (user) {
                userId = user.uid;
            } else {
                // Tenta autenticação anônima se não houver utilizador logado
                try {
                    const userCredential = await signInAnonymously(auth);
                    userId = userCredential.user.uid;
                    showMessageBox('Autenticação', 'Autenticado anonimamente. Seus dados estão vinculados a este dispositivo.');
                } catch (error) {
                    console.error("Erro na autenticação anônima:", error);
                    showMessageBox('Erro de Autenticação', `Não foi possível autenticar o utilizador. Usando um ID temporário. Erro: ${error.message}`);
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

            if (userIdDisplay) userIdDisplay.textContent = `ID do Usuário: ${userId} (Household: ${currentHouseholdId})`;
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
