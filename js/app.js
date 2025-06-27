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

    try {
        const batchUpdates = [];
        let queryRef;

        if (editType === 'recurring' && baseLancamento.recurringGroupId) {
            queryRef = query(
                lancamentosCollection,
                where("recurringGroupId", "==", baseLancamento.recurringGroupId),
                where("ano", ">=", baseLancamento.ano),
                where("householdId", "==", currentHouseholdId)
            );
        } else if (editType === 'installment' && baseLancamento.originalPurchaseAno) {
            queryRef = query(
                lancamentosCollection,
                where("originalPurchaseAno", "==", baseLancamento.originalPurchaseAno),
                where("originalPurchaseMes", "==", baseLancamento.originalPurchaseMes),
                where("originalPurchaseDia", "==", baseLancamento.originalPurchaseDia),
                where("descricao", "==", baseLancamento.descricao.split(' (')[0]), // Compara a descrição base
                where("householdId", "==", currentHouseholdId)
            );
        } else {
            showMessageBox('Erro', 'Não foi possível determinar o grupo de recorrência/parcelamento.');
            return;
        }

        const querySnapshot = await getDocs(queryRef);

        const updateData = {};
        if (field === 'descricao' && editType === 'installment') {
            // Se a descrição base mudar, ajustar para todas as parcelas
            const newBaseDesc = newValue.trim();
            querySnapshot.forEach(docSnapshot => {
                const docData = docSnapshot.data();
                const installmentPartMatch = docData.descricao.match(/\s\((\d+\/\d+)\)$/);
                const installmentPart = installmentPartMatch ? installmentPartMatch[0] : '';
                batchUpdates.push(setDoc(doc(db, lancamentosCollection.path, docSnapshot.id), { descricao: `${newBaseDesc}${installmentPart}` }, { merge: true }));
            });
        } else {
            updateData[field] = newValue;

            // Se o tipo mudar para entrada, zerar parcelamento/recorrência
            if (field === 'tipo' && newValue === 'entrada') {
                updateData.parcelaAtual = null;
                updateData.totalParcelas = null;
                updateData.isRecurring = false;
                updateData.recurringGroupId = null;
                updateData.originalPurchaseDia = null;
                updateData.originalPurchaseMes = null;
                updateData.originalPurchaseAno = null;
            } else if (field === 'tipo' && newValue === 'saida' && editType === 'installment' && updateData.parcelaAtual === null && updateData.totalParcelas === null) {
                // Se se tornar saída e for parcelado, garantir que tenha parcela (se não for recorrente)
                updateData.parcelaAtual = 1;
                updateData.totalParcelas = 1;
                if (!updateData.originalPurchaseDia) {
                    updateData.originalPurchaseDia = baseLancamento.dia;
                    updateData.originalPurchaseMes = baseLancamento.mes;
                    updateData.originalPurchaseAno = baseLancamento.ano;
                }
            }

            querySnapshot.forEach(docSnapshot => {
                batchUpdates.push(setDoc(doc(db, lancamentosCollection.path, docSnapshot.id), updateData, { merge: true }));
            });
        }
        
        // Executar todas as atualizações em lote
        await Promise.all(batchPromises);
        showMessageBox('Sucesso', `Edição aplicada a ${batchUpdates.length} lançamentos da série!`);

    } catch (e) {
        console.error("Erro ao aplicar edição em massa: ", e);
        showMessageBox('Erro', 'Erro ao aplicar edição em massa. Por favor, tente novamente.');
    } finally {
        pendingEditData = null; // Limpa o estado da edição pendente
    }
}


/**
 * Atribui os elementos do DOM às variáveis JS e configura os event listeners.
 */
function initializeUI() {
    // Atribuição de elementos do formulário
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
    noExpensesMessage = document.getElementById('noExpensesMessage');

    // Atribuição dos elementos de resumo
    totalEntradasSpan = document.getElementById('totalEntradas');
    totalSaidasSpan = document.getElementById('totalSaidas');
    mediaDiariaSpan = document.getElementById('mediaDiaria');
    saldoMesSpan = document.getElementById('saldoMes');

    // Elementos do resumo redesenhado
    saldoStatusBar = document.getElementById('saldoBar'); // Corrigido para 'saldoBar'
    saldoStatusText = document.getElementById('saldoStatus'); // Corrigido para 'saldoStatus'
    
    // Elementos para o filtro de mês e ano
    filterMesGroup = document.getElementById('filterMesGroup');
    filterMesAll = document.getElementById('filterMesAll');
    // Coleta todos os checkboxes de mês individuais dentro de filterMesGroup, exceto o "Todos"
    monthFilterCheckboxes = filterMesGroup ? filterMesGroup.querySelectorAll('.month-filter-checkbox') : []; // Corrigido seletor
    filterAnoSelect = document.getElementById('filterAno'); // Corrigido para 'filterAno'

    // Campos de parcelamento
    parcelaAtualSelect = document.getElementById('parcelaAtual');
    totalParcelasSelect = document.getElementById('totalParcelas');
    parcelaFieldsDiv = document.getElementById('parcelaFields'); // Corrigido para 'parcelaFields'

    // Elementos para seleção e exclusão em massa
    userIdDisplay = document.getElementById('user-id-display');
    joinHouseholdIdInput = document.getElementById('joinHouseholdIdInput');
    setHouseholdIdBtn = document.getElementById('setHouseholdIdBtn');
    selectAllCheckbox = document.getElementById('selectAllCheckbox');
    deleteSelectedBtn = document.getElementById('deleteSelectedBtn');

    // Campo de cobrança recorrente
    isRecurringCheckbox = document.getElementById('isRecurring'); // Corrigido para 'isRecurring'

    // Referências para o modal de parar recorrência
    stopRecurringMonthsModalOverlay = document.getElementById('stopRecurringMonthsModalOverlay');
    stopFromCurrentMonthCheckbox = document.getElementById('stopFromCurrentMonthCheckbox');
    currentMonthAndYearSpan = document.getElementById('currentMonthAndYear'); // Corrigido para 'currentMonthAndYear'
    specificMonthsSelectionDiv = document.getElementById('specificMonthsSelection'); // Corrigido para 'specificMonthsSelection'
    stopRecurringYearSelect = document.getElementById('stopRecurringYearSelect');
    cancelStopRecurringBtn = document.getElementById('cancelStopRecurringBtn');
    confirmStopRecurringBtn = document.getElementById('confirmStopRecurringBtn');
    // Coleta os checkboxes de mês dentro do modal de parada de recorrência
    monthStopCheckboxes = specificMonthsSelectionDiv ? specificMonthsSelectionDiv.querySelectorAll('.month-stop-checkbox') : []; // Corrigido seletor

    // Campo de busca
    searchBarInput = document.getElementById('searchBar'); // Corrigido para 'searchBar'

    // Elementos para feedback de categorização automática
    categoryLoadingIndicator = document.getElementById('categoryLoadingIndicator');

    // Elementos para o modal de escolha de edição recorrente/parcelada
    editRecurringChoiceModalOverlay = document.getElementById('editRecurringChoiceModalOverlay');
    editRecurringChoiceMessage = document.getElementById('editRecurringChoiceMessage');
    applyToThisBtn = document.getElementById('applyToThisBtn');
    applyToFutureBtn = document.getElementById('applyToFutureBtn');
    cancelEditRecurringBtn = document.getElementById('cancelEditRecurringBtn');


    // Preencher select de anos para filtro e para parar recorrência
    const currentYear = new Date().getFullYear();
    for (let i = currentYear - 5; i <= currentYear + 5; i++) {
        const optionFilter = document.createElement('option');
        optionFilter.value = i;
        optionFilter.textContent = i;
        if (i === currentYear) {
            optionFilter.selected = true;
        }
        if (filterAnoSelect) filterAnoSelect.appendChild(optionFilter);

        const optionStop = document.createElement('option');
        optionStop.value = i;
        optionStop.textContent = i;
        if (i === currentYear) {
            optionStop.selected = true;
        }
        if (stopRecurringYearSelect) stopRecurringYearSelect.appendChild(optionStop);
    }

    // Preencher selects de dia, mês, ano do formulário com a data atual
    const today = new Date();
    if (diaInput) diaInput.value = today.toISOString().split('T')[0]; // Define a data completa

    // Configurar listeners de evento
    if (lancamentoForm) lancamentoForm.addEventListener('submit', handleAddLancamento);
    if (tipoEntradaRadio) tipoEntradaRadio.addEventListener('change', toggleParcelaRecurringFields);
    if (tipoSaidaRadio) tipoSaidaRadio.addEventListener('change', toggleParcelaRecurringFields);
    if (isRecurringCheckbox) isRecurringCheckbox.addEventListener('change', toggleParcelaRecurringFields);
    if (parcelaAtualSelect) { // Preenche as opções de parcela (1 a 12)
        for (let i = 1; i <= 12; i++) {
            const optionAtual = document.createElement('option');
            optionAtual.value = i;
            optionAtual.textContent = i;
            parcelaAtualSelect.appendChild(optionAtual);
        }
    }
    if (totalParcelasSelect) { // Preenche as opções de parcela (1 a 12)
        for (let i = 1; i <= 12; i++) {
            const optionTotal = document.createElement('option');
            optionTotal.value = i;
            optionTotal.textContent = i;
            totalParcelasSelect.appendChild(optionTotal);
        }
    }
    
    // Listeners para o filtro de mês e ano
    if (filterMesAll) filterMesAll.addEventListener('change', handleFilterMesAllChange);
    if (monthFilterCheckboxes) {
        monthFilterCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', handleMonthFilterCheckboxChange);
        });
    }
    if (filterAnoSelect) filterAnoSelect.addEventListener('change', () => {
        updateSummary();
        renderLancamentos();
    });

    // Inicializar estado dos checkboxes de mês no filtro (todos marcados por padrão)
    if (filterMesAll) {
        filterMesAll.checked = true;
        handleFilterMesAllChange({ target: filterMesAll });
    }

    // Listeners para seleção e exclusão em massa
    if (selectAllCheckbox) selectAllCheckbox.addEventListener('change', handleSelectAllChange);
    if (deleteSelectedBtn) deleteSelectedBtn.addEventListener('click', handleDeleteSelected);
    if (setHouseholdIdBtn) setHouseholdIdBtn.addEventListener('click', handleSetHouseholdId);
    if (joinHouseholdIdInput) {
        joinHouseholdIdInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleSetHouseholdId();
            }
        });
    }

    // Listeners para o modal de parar recorrência
    if (stopFromCurrentMonthCheckbox) stopFromCurrentMonthCheckbox.addEventListener('change', handleStopFromCurrentMonthChange);
    if (stopRecurringYearSelect) stopRecurringYearSelect.addEventListener('change', updateStopMonthCheckboxes);
    if (monthStopCheckboxes) {
        monthStopCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                if (stopFromCurrentMonthCheckbox) stopFromCurrentMonthCheckbox.checked = false; // Desmarca "a partir do mês atual"
            });
        });
    }
    if (cancelStopRecurringBtn) cancelStopRecurringBtn.addEventListener('click', () => {
        if (stopRecurringMonthsModalOverlay) stopRecurringMonthsModalOverlay.classList.add('hidden');
        currentRecurringGroupId = null; // Limpa o ID do grupo
    });
    if (confirmStopRecurringBtn) confirmStopRecurringBtn.addEventListener('click', handleConfirmStopRecurring);

    // Listener para o campo de busca
    if (searchBarInput) {
        searchBarInput.addEventListener('input', () => {
            renderLancamentos();
            updateSummary();
        });
    }

    // Listeners para o modal de escolha de edição recorrente/parcelada
    if (applyToThisBtn) applyToThisBtn.addEventListener('click', async () => {
        if (pendingEditData) {
            await applyEditToSingleLancamento(pendingEditData.id, pendingEditData.field, pendingEditData.newValue, pendingEditData.currentLancamento);
            if (editRecurringChoiceModalOverlay) editRecurringChoiceModalOverlay.classList.add('hidden');
            pendingEditData = null; // Limpa o estado
        }
    });
    if (applyToFutureBtn) applyToFutureBtn.addEventListener('click', async () => {
        if (pendingEditData) {
            await applyEditToSeriesLancamentos(pendingEditData.id, pendingEditData.field, pendingEditData.newValue, pendingEditData.currentLancamento, pendingEditData.type);
            if (editRecurringChoiceModalOverlay) editRecurringChoiceModalOverlay.classList.add('hidden');
            pendingEditData = null; // Limpa o estado
        }
    });
    if (cancelEditRecurringBtn) cancelEditRecurringBtn.addEventListener('click', () => {
        if (editRecurringChoiceModalOverlay) editRecurringChoiceModalOverlay.classList.add('hidden');
        pendingEditData = null; // Limpa o estado
        renderLancamentos(); // Renderiza novamente para remover o input de edição
    });
}

/**
 * Lida com o envio do formulário para adicionar um novo lançamento.
 * @param {Event} event O objeto do evento de envio.
 */
async function handleAddLancamento(event) {
    event.preventDefault(); // Impede o recarregamento da página

    if (!isAuthReady) {
        showMessageBox('Aguarde', 'Aplicação ainda carregando, por favor, aguarde.');
        return;
    }

    // Validações básicas
    if (!descricaoInput.value.trim()) {
        showMessageBox('Erro de Validação', 'A descrição não pode ser vazia.');
        return;
    }
    const valor = parseFloat(valorInput.value);
    if (isNaN(valor) || valor <= 0) {
        showMessageBox('Erro de Validação', 'Valor inválido. Por favor, insira um número positivo.');
        return;
    }
    if (!categoriaSelect.value) {
        showMessageBox('Erro de Validação', 'Por favor, selecione uma categoria.');
        return;
    }
    if (!tipoEntradaRadio.checked && !tipoSaidaRadio.checked) {
        showMessageBox('Erro de Validação', 'Por favor, selecione o tipo (entrada ou saída).');
        return;
    }

    const tipo = tipoEntradaRadio.checked ? 'entrada' : 'saida';
    const isRecurring = isRecurringCheckbox.checked;

    // Obtém a data do input date
    const dateValue = diaInput.value;
    const dateParts = dateValue.split('-'); // Formato YYYY-MM-DD
    const ano = parseInt(dateParts[0]);
    const mes = parseInt(dateParts[1]);
    const dia = parseInt(dateParts[2]);

    let parcelaAtual = null;
    let totalParcelas = null;
    let recurringGroupId = null;
    let originalPurchaseDia = null;
    let originalPurchaseMes = null;
    let originalPurchaseAno = null;

    if (tipo === 'saida') { // Parcelamento e recorrência só se aplicam a saídas
        if (isRecurring) {
            recurringGroupId = `recorrente_${Date.now()}_${userId}`; // ID único para o grupo de recorrência
            // Para lançamentos recorrentes, originalPurchase é a primeira ocorrência
            originalPurchaseDia = dia;
            originalPurchaseMes = mes;
            originalPurchaseAno = ano;
        } else {
            parcelaAtual = parseInt(parcelaAtualSelect.value);
            totalParcelas = parseInt(totalParcelasSelect.value);

            // Se for parcelado e não recorrente, preenche originalPurchase para a primeira parcela
            if (totalParcelas > 0 && (parcelaAtual === null || parcelaAtual === 1)) {
                originalPurchaseDia = dia;
                originalPurchaseMes = mes;
                originalPurchaseAno = ano;
            } else if (totalParcelas > 0) {
                // Se for uma parcela intermediária, usa a data original do formulário
                originalPurchaseDia = dia;
                originalPurchaseMes = mes;
                originalPurchaseAno = ano;
            } else {
                // Se não é recorrente nem parcelado, não tem originalPurchase
                parcelaAtual = null;
                totalParcelas = null;
            }
        }
    }

    const baseLancamento = {
        descricao: descricaoInput.value.trim(),
        valor: valor,
        categoria: categoriaSelect.value,
        tipo: tipo,
        dia: dia,
        mes: mes,
        ano: ano,
        dataCriacao: new Date(),
        householdId: currentHouseholdId, // Associa o lançamento ao ID da família/grupo
        isRecurring: isRecurring,
        recurringGroupId: recurringGroupId,
        parcelaAtual: parcelaAtual,
        totalParcelas: totalParcelas,
        originalPurchaseDia: originalPurchaseDia,
        originalPurchaseMes: originalPurchaseMes,
        originalPurchaseAno: originalPurchaseAno,
        userId: userId // Adiciona o userId para saber quem criou o lançamento
    };

    try {
        if (isRecurring) {
            await generateRecurringEntries(baseLancamento);
            showMessageBox('Sucesso', 'Lançamentos recorrentes adicionados com sucesso!');
        } else if (totalParcelas > 1) {
            await generateInstallmentEntries(baseLancamento);
            showMessageBox('Sucesso', 'Lançamentos parcelados adicionados com sucesso!');
        } else {
            await addDoc(lancamentosCollection, baseLancamento);
            showMessageBox('Sucesso', 'Lançamento adicionado com sucesso!');
        }

        lancamentoForm.reset(); // Limpa o formulário
        if (diaInput) diaInput.value = new Date().toISOString().split('T')[0]; // Restaura a data atual
        toggleParcelaRecurringFields(); // Reseta os campos de parcela/recorrência
    } catch (e) {
        console.error("Erro ao adicionar documento: ", e);
        showMessageBox('Erro', 'Erro ao adicionar lançamento. Por favor, tente novamente.');
    }
}

/**
 * Gera as entradas de lançamentos recorrentes para os próximos meses.
 * @param {object} baseLancamento O objeto base do lançamento.
 */
async function generateRecurringEntries(baseLancamento) {
    const batchPromises = [];
    const today = new Date(baseLancamento.ano, baseLancamento.mes - 1, baseLancamento.dia); // Data do primeiro lançamento

    for (let i = 0; i <= RECURRING_MONTHS_AHEAD; i++) {
        const futureDate = new Date(today.getFullYear(), today.getMonth() + i, today.getDate());
        const newLancamento = {
            ...baseLancamento,
            dia: futureDate.getDate(),
            mes: futureDate.getMonth() + 1,
            ano: futureDate.getFullYear(),
            descricao: baseLancamento.descricao, // Mantém a descrição original para recorrentes
            dataCriacao: new Date(),
            // Garante que é recorrente e tem o mesmo grupo
            isRecurring: true,
            recurringGroupId: baseLancamento.recurringGroupId,
            // Lançamentos recorrentes não são parcelados
            parcelaAtual: null,
            totalParcelas: null,
            // A data de compra original é sempre a data do primeiro lançamento recorrente
            originalPurchaseDia: baseLancamento.originalPurchaseDia,
            originalPurchaseMes: baseLancamento.originalPurchaseMes,
            originalPurchaseAno: baseLancamento.originalPurchaseAno
        };
        batchPromises.push(addDoc(lancamentosCollection, newLancamento));
    }
    await Promise.all(batchPromises);
}

/**
 * Gera as entradas de lançamentos parcelados.
 * @param {object} baseLancamento O objeto base do lançamento.
 */
async function generateInstallmentEntries(baseLancamento) {
    const batchPromises = [];
    const totalParcelas = baseLancamento.totalParcelas;
    const initialDate = new Date(baseLancamento.ano, baseLancamento.mes - 1, baseLancamento.dia); // Data da primeira parcela

    for (let i = 1; i <= totalParcelas; i++) {
        const futureDate = new Date(initialDate.getFullYear(), initialDate.getMonth() + (i - 1), initialDate.getDate());
        
        const newLancamento = {
            ...baseLancamento,
            dia: futureDate.getDate(),
            mes: futureDate.getMonth() + 1,
            ano: futureDate.getFullYear(),
            descricao: `${baseLancamento.descricao} (${i}/${totalParcelas})`,
            parcelaAtual: i,
            dataCriacao: new Date(),
            // Garante que é parcelado e não recorrente
            isRecurring: false,
            recurringGroupId: null,
            // A data de compra original é sempre a data da primeira parcela
            originalPurchaseDia: baseLancamento.originalPurchaseDia,
            originalPurchaseMes: baseLancamento.originalPurchaseMes,
            originalPurchaseAno: baseLancamento.originalPurchaseAno
        };
        batchPromises.push(addDoc(lancamentosCollection, newLancamento));
    }
    await Promise.all(batchPromises);
}

/**
 * Renderiza os lançamentos na tabela, aplicando filtros e busca.
 */
function renderLancamentos() {
    if (!gastosTableBody || !noExpensesMessage) {
        console.error("Elementos da tabela de lançamentos ou mensagem 'nenhum lançamento' não encontrados.");
        return;
    }

    gastosTableBody.innerHTML = ''; // Limpa a tabela
    selectedLancamentosIds.clear(); // Limpa a seleção
    if (selectAllCheckbox) selectAllCheckbox.checked = false; // Desmarca o "selecionar todos"

    const currentMonth = Array.from(monthFilterCheckboxes).filter(cb => cb.checked).map(cb => parseInt(cb.value));
    const currentYear = parseInt(filterAnoSelect.value);
    const searchTerm = searchBarInput.value.toLowerCase().trim();

    const filteredAndSortedLancamentos = lancamentos
        .filter(lancamento => {
            const isSelectedMonth = currentMonth.includes(lancamento.mes);
            const isSelectedYear = lancamento.ano === currentYear;
            
            // Aplicar filtro de busca se houver texto na barra
            const matchesSearch = !searchTerm || 
                                  lancamento.descricao.toLowerCase().includes(searchTerm) ||
                                  lancamento.categoria.toLowerCase().includes(searchTerm);

            return isSelectedMonth && isSelectedYear && matchesSearch;
        })
        .sort((a, b) => {
            // Ordena por ano, depois por mês, depois por dia, depois por data de criação (para recorrência/parcelamento)
            if (a.ano !== b.ano) return a.ano - b.ano;
            if (a.mes !== b.mes) return a.mes - b.mes;
            if (a.dia !== b.dia) return a.dia - b.dia;
            // Para recorrentes/parcelados, use a data de criação original para garantir a ordem correta na série
            const aOriginalDate = a.originalPurchaseAno ? new Date(a.originalPurchaseAno, a.originalPurchaseMes - 1, a.originalPurchaseDia).getTime() : 0;
            const bOriginalDate = b.originalPurchaseAno ? new Date(b.originalPurchaseAno, b.originalPurchaseMes - 1, b.originalPurchaseDia).getTime() : 0;
            if (aOriginalDate !== bOriginalDate) return aOriginalDate - bOriginalDate;
            
            // Ordem por número da parcela
            if (a.parcelaAtual && b.parcelaAtual) return a.parcelaAtual - b.parcelaAtual;

            return a.dataCriacao.toDate().getTime() - b.dataCriacao.toDate().getTime();
        });


    if (filteredAndSortedLancamentos.length === 0) {
        noExpensesMessage.classList.remove('hidden');
    } else {
        noExpensesMessage.classList.add('hidden');
        filteredAndSortedLancamentos.forEach(lancamento => {
            const row = gastosTableBody.insertRow();
            row.classList.add('hover:bg-gray-100', 'transition-colors', 'duration-150');
            row.dataset.id = lancamento.id;

            const isFutureEntry = lancamento.ano > new Date().getFullYear() || 
                                 (lancamento.ano === new Date().getFullYear() && lancamento.mes > (new Date().getMonth() + 1)) ||
                                 (lancamento.ano === new Date().getFullYear() && lancamento.mes === (new Date().getMonth() + 1) && lancamento.dia > new Date().getDate());

            if (isFutureEntry) {
                row.classList.add('opacity-70', 'italic', 'bg-blue-50'); // Estilo para lançamentos futuros
            }

            // Checkbox para seleção
            const selectCell = row.insertCell();
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.classList.add('form-checkbox', 'h-4', 'w-4', 'text-blue-600', 'lancamento-checkbox');
            checkbox.dataset.id = lancamento.id;
            checkbox.addEventListener('change', handleLancamentoCheckboxChange);
            selectCell.appendChild(checkbox);

            // Data
            const dataCell = row.insertCell();
            dataCell.textContent = `${String(lancamento.dia).padStart(2, '0')}/${String(lancamento.mes).padStart(2, '0')}/${lancamento.ano}`;
            dataCell.classList.add('px-6', 'py-4', 'whitespace-nowrap', 'text-sm', 'font-medium', 'text-gray-900', 'cursor-pointer');
            dataCell.dataset.id = lancamento.id;
            dataCell.dataset.field = 'dataCompleta';
            dataCell.addEventListener('click', (e) => handleEditCellClick(e.target));

            // Descrição
            const descricaoCell = row.insertCell();
            descricaoCell.textContent = lancamento.descricao;
            descricaoCell.classList.add('px-6', 'py-4', 'whitespace-nowrap', 'text-sm', 'text-gray-700', 'cursor-pointer');
            descricaoCell.dataset.id = lancamento.id;
            descricaoCell.dataset.field = 'descricao';
            descricaoCell.addEventListener('click', (e) => handleEditCellClick(e.target));

            // Valor
            const valorCell = row.insertCell();
            valorCell.textContent = lancamento.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            valorCell.classList.add('px-6', 'py-4', 'whitespace-nowrap', 'text-sm', 'font-medium', lancamento.tipo === 'entrada' ? 'text-income' : 'text-expense', 'cursor-pointer');
            valorCell.dataset.id = lancamento.id;
            valorCell.dataset.field = 'valor';
            valorCell.addEventListener('click', (e) => handleEditCellClick(e.target));

            // Categoria
            const categoriaCell = row.insertCell();
            categoriaCell.textContent = lancamento.categoria;
            categoriaCell.classList.add('px-6', 'py-4', 'whitespace-nowrap', 'text-sm', 'text-gray-700', 'cursor-pointer');
            categoriaCell.dataset.id = lancamento.id;
            categoriaCell.dataset.field = 'categoria';
            categoriaCell.addEventListener('click', (e) => handleEditCellClick(e.target));

            // Tipo
            const tipoCell = row.insertCell();
            tipoCell.textContent = lancamento.tipo === 'entrada' ? 'Entrada' : 'Saída';
            tipoCell.classList.add('px-6', 'py-4', 'whitespace-nowrap', 'text-sm', 'text-gray-700', 'cursor-pointer');
            tipoCell.dataset.id = lancamento.id;
            tipoCell.dataset.field = 'tipo';
            tipoCell.addEventListener('click', (e) => handleEditCellClick(e.target));

            // Parcela
            const parcelaCell = row.insertCell();
            if (lancamento.parcelaAtual && lancamento.totalParcelas) {
                parcelaCell.textContent = `${lancamento.parcelaAtual}/${lancamento.totalParcelas}`;
                parcelaCell.dataset.id = lancamento.id;
                parcelaCell.dataset.field = 'parcelaAtual'; // Edição de parcela leva ao modal de escolha
                parcelaCell.classList.add('cursor-pointer');
            } else if (lancamento.isRecurring) {
                parcelaCell.textContent = 'Recorrente';
                parcelaCell.dataset.id = lancamento.id;
                parcelaCell.dataset.field = 'isRecurring'; // Edição de recorrente leva ao modal de escolha
                parcelaCell.classList.add('cursor-pointer');
            } else {
                parcelaCell.textContent = '-';
            }
            parcelaCell.classList.add('px-6', 'py-4', 'whitespace-nowrap', 'text-sm', 'text-gray-700');
            if (lancamento.parcelaAtual || lancamento.isRecurring) { // Adiciona listener apenas se for parcelado ou recorrente
                parcelaCell.addEventListener('click', handleStopRecurringClick);
            }


            // Ações (Botão Excluir)
            const actionsCell = row.insertCell();
            actionsCell.classList.add('px-6', 'py-4', 'whitespace-nowrap', 'text-right', 'text-sm', 'font-medium');
            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Excluir';
            deleteButton.classList.add('text-red-600', 'hover:text-red-900', 'hover:underline');
            deleteButton.dataset.id = lancamento.id;
            deleteButton.addEventListener('click', handleDeleteLancamento);
            actionsCell.appendChild(deleteButton);
        });
    }
}

/**
 * Atualiza os valores do resumo financeiro (total de entradas, saídas, saldo, média diária).
 */
function updateSummary() {
    // Adicionei estas verificações para garantir que os elementos existem antes de tentar acessá-los.
    // Embora initializeUI() deva atribuí-los, isso adiciona robustez.
    if (!filterMesGroup || !filterAnoSelect || !monthFilterCheckboxes || 
        !totalEntradasSpan || !totalSaidasSpan || !saldoMesSpan || !mediaDiariaSpan ||
        !saldoStatusBar || !saldoStatusText || !searchBarInput) {
        console.error("Um ou mais elementos do DOM necessários para updateSummary não foram encontrados. Verifique IDs em index.html e a inicialização em script.js.");
        return; 
    }

    const currentMonthNumbers = Array.from(monthFilterCheckboxes).filter(cb => cb.checked).map(cb => parseInt(cb.value));
    const currentYear = parseInt(filterAnoSelect.value);

    // Filtrar lançamentos pelo mês e ano selecionados
    const filteredLancamentos = lancamentos.filter(lancamento => {
        const isSelectedMonth = currentMonthNumbers.includes(lancamento.mes);
        const isSelectedYear = lancamento.ano === currentYear;
        
        // Aplicar filtro de busca se houver texto na barra
        const searchTerm = searchBarInput.value.toLowerCase();
        const matchesSearch = !searchTerm || 
                              lancamento.descricao.toLowerCase().includes(searchTerm) ||
                              lancamento.categoria.toLowerCase().includes(searchTerm);

        return isSelectedMonth && isSelectedYear && matchesSearch;
    });

    // Calcular totais
    let totalEntradas = 0;
    let totalSaidas = 0;

    filteredLancamentos.forEach(lancamento => {
        if (lancamento.tipo === 'entrada') {
            totalEntradas += lancamento.valor;
        } else if (lancamento.tipo === 'saida') {
            totalSaidas += lancamento.valor;
        }
    });

    const saldoMes = totalEntradas - totalSaidas;

    // Calcular média diária
    const daysInMonth = new Date(currentYear, currentMonthNumbers[0] || new Date().getMonth() + 1, 0).getDate(); // Usa o primeiro mês selecionado ou o mês atual
    const mediaDiaria = totalSaidas / daysInMonth;

    // Atualizar elementos do DOM (com verificações de nulidade)
    if (totalEntradasSpan) {
        totalEntradasSpan.textContent = totalEntradas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }
    if (totalSaidasSpan) {
        totalSaidasSpan.textContent = totalSaidas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }
    if (saldoMesSpan) {
        saldoMesSpan.textContent = saldoMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }
    if (mediaDiariaSpan) {
        mediaDiariaSpan.textContent = mediaDiaria.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }
    
    // Atualizar barra de status do saldo (com verificações de nulidade)
    if (saldoStatusBar && saldoStatusText) {
        saldoStatusBar.style.width = `${Math.min(100, Math.max(0, (totalEntradas / (totalEntradas + totalSaidas || 1)) * 100))}%`;
        if (saldoMes >= 0) {
            saldoStatusBar.classList.remove('bg-red-500');
            saldoStatusBar.classList.add('bg-green-500');
            saldoStatusText.textContent = 'Saldo Positivo';
        } else {
            saldoStatusBar.classList.remove('bg-green-500');
            saldoStatusBar.classList.add('bg-red-500');
            saldoStatusText.textContent = 'Saldo Negativo';
        }
    }
}

/**
 * Lida com o clique no botão de exclusão de um lançamento individual.
 * @param {Event} event O objeto do evento de clique.
 */
async function handleDeleteLancamento(event) {
    const lancamentoId = event.target.dataset.id;
    const lancamentoToDelete = lancamentos.find(l => l.id === lancamentoId);

    if (!lancamentoToDelete) {
        showMessageBox('Erro', 'Lançamento não encontrado.');
        return;
    }

    let confirmationMessage = 'Tem certeza que deseja excluir este lançamento?';
    let confirmTitle = 'Confirmar Exclusão';

    if (lancamentoToDelete.isRecurring && lancamentoToDelete.recurringGroupId) {
        confirmationMessage = 'Este é um lançamento recorrente. Deseja excluir APENAS este lançamento ou TODOS os lançamentos futuros desta série?';
        confirmTitle = 'Excluir Lançamento Recorrente';
    } else if (lancamentoToDelete.parcelaAtual && lancamentoToDelete.totalParcelas && lancamentoToDelete.originalPurchaseAno) {
        confirmationMessage = 'Este é um lançamento parcelado. Deseja excluir APENAS esta parcela ou TODAS as parcelas futuras desta série?';
        confirmTitle = 'Excluir Lançamento Parcelado';
    }

    const confirmation = await showConfirmBox(confirmTitle, confirmationMessage);

    if (confirmation) {
        try {
            if (lancamentoToDelete.isRecurring && lancamentoToDelete.recurringGroupId) {
                // Para recorrência, excluir lançamentos a partir deste mês
                await stopRecurringOrInstallmentSeries(lancamentoToDelete.recurringGroupId, 'recurring', lancamentoToDelete.mes, lancamentoToDelete.ano);
                showMessageBox('Sucesso', 'Lançamentos recorrentes futuros excluídos com sucesso!');
            } else if (lancamentoToDelete.parcelaAtual && lancamentoToDelete.totalParcelas && lancamentoToDelete.originalPurchaseAno) {
                // Para parcelamento, excluir parcelas futuras (inclusive esta)
                await stopRecurringOrInstallmentSeries(lancamentoToDelete.id, 'installment', lancamentoToDelete.mes, lancamentoToDelete.ano, lancamentoToDelete.parcelaAtual, lancamentoToDelete.originalPurchaseDia, lancamentoToDelete.originalPurchaseMes, lancamentoToDelete.originalPurchaseAno, lancamentoToDelete.descricao.split(' (')[0]);
                showMessageBox('Sucesso', 'Parcelas futuras excluídas com sucesso!');
            } else {
                // Excluir apenas um lançamento normal
                await deleteDoc(doc(db, lancamentosCollection.path, lancamentoId));
                showMessageBox('Sucesso', 'Lançamento excluído com sucesso!');
            }
        } catch (e) {
            console.error("Erro ao excluir lançamento: ", e);
            showMessageBox('Erro', 'Erro ao excluir lançamento. Por favor, tente novamente.');
        }
    }
}


/**
 * Lida com o clique em um lançamento parcelado/recorrente para abrir o modal de parar.
 * @param {Event} event O evento de clique.
 */
function handleStopRecurringClick(event) {
    const lancamentoId = event.currentTarget.dataset.id;
    const lancamento = lancamentos.find(l => l.id === lancamentoId);

    if (!lancamento) return;

    currentRecurringGroupId = lancamento.isRecurring ? lancamento.recurringGroupId : lancamento.id; // Usa o ID do lançamento para parcelas, e o grupo para recorrentes

    // Preenche o span com o mês e ano atuais
    const today = new Date();
    const currentMonthName = getMonthName(today.getMonth() + 1);
    const currentYear = today.getFullYear();
    if (currentMonthAndYearSpan) {
        currentMonthAndYearSpan.textContent = `${currentMonthName} de ${currentYear}`;
    }

    // Reseta os checkboxes e o select de ano no modal
    if (stopFromCurrentMonthCheckbox) stopFromCurrentMonthCheckbox.checked = false;
    if (monthStopCheckboxes) {
        monthStopCheckboxes.forEach(cb => cb.checked = false);
    }
    if (stopRecurringYearSelect) stopRecurringYearSelect.value = currentYear;
    updateStopMonthCheckboxes(); // Garante que os meses desabilitados estejam corretos

    if (stopRecurringMonthsModalOverlay) stopRecurringMonthsModalOverlay.classList.remove('hidden');
}


/**
 * Lida com a confirmação de parar lançamentos recorrentes ou parcelados.
 */
async function handleConfirmStopRecurring() {
    if (!currentRecurringGroupId) {
        showMessageBox('Erro', 'ID do grupo recorrente não definido.');
        return;
    }

    const lancamentoBase = lancamentos.find(l => (l.isRecurring && l.recurringGroupId === currentRecurringGroupId) || (!l.isRecurring && l.id === currentRecurringGroupId));
    if (!lancamentoBase) {
        showMessageBox('Erro', 'Lançamento base não encontrado para parar a série.');
        return;
    }

    const isRecurringSeries = lancamentoBase.isRecurring;

    let startMonthToDelete = null;
    let startYearToDelete = null;
    let startParcelaToDelete = null; // Apenas para parcelamento

    if (stopFromCurrentMonthCheckbox && stopFromCurrentMonthCheckbox.checked) {
        const today = new Date();
        startMonthToDelete = today.getMonth() + 1;
        startYearToDelete = today.getFullYear();
        startParcelaToDelete = lancamentoBase.parcelaAtual; // Se for parcelado, mantém a parcela atual
    } else {
        const selectedStopMonths = Array.from(monthStopCheckboxes)
            .filter(cb => cb.checked)
            .map(cb => parseInt(cb.value));
        const selectedStopYear = parseInt(stopRecurringYearSelect.value);

        if (selectedStopMonths.length === 0) {
            showMessageBox('Atenção', 'Selecione pelo menos um mês ou marque "Parar a partir do mês atual".');
            return;
        }
        
        // Pega o primeiro mês selecionado para definir o ponto de partida
        startMonthToDelete = Math.min(...selectedStopMonths);
        startYearToDelete = selectedStopYear;
        startParcelaToDelete = lancamentoBase.parcelaAtual; // Se for parcelado, mantém a parcela atual
    }

    const confirmation = await showConfirmBox('Confirmar Parada', 
        `Tem certeza que deseja parar ${isRecurringSeries ? 'a recorrência' : 'o parcelamento'} a partir de ${getMonthName(startMonthToDelete)}/${startYearToDelete}?`
    );

    if (confirmation) {
        try {
            await stopRecurringOrInstallmentSeries(
                isRecurringSeries ? lancamentoBase.recurringGroupId : lancamentoBase.id, // ID do grupo ou do lançamento
                isRecurringSeries ? 'recurring' : 'installment',
                startMonthToDelete,
                startYearToDelete,
                startParcelaToDelete, // Passa a parcela de início para o cálculo
                lancamentoBase.originalPurchaseDia, // Para parcelamento
                lancamentoBase.originalPurchaseMes, // Para parcelamento
                lancamentoBase.originalPurchaseAno, // Para parcelamento
                lancamentoBase.descricao.split(' (')[0] // Para parcelamento
            );
            showMessageBox('Sucesso', `${isRecurringSeries ? 'Recorrência' : 'Parcelamento'} parado com sucesso!`);
        } catch (e) {
            console.error("Erro ao parar série: ", e);
            showMessageBox('Erro', `Erro ao parar ${isRecurringSeries ? 'recorrência' : 'parcelamento'}. Por favor, tente novamente.`);
        } finally {
            if (stopRecurringMonthsModalOverlay) stopRecurringMonthsModalOverlay.classList.add('hidden');
            currentRecurringGroupId = null; // Limpa o ID do grupo
        }
    }
}

/**
 * Para uma série de lançamentos recorrentes ou parcelados a partir de um determinado ponto.
 * Isso significa excluir os lançamentos que ocorrem a partir da data especificada.
 * @param {string} seriesId O ID do grupo recorrente ou o ID do lançamento base para parcelamento.
 * @param {'recurring'|'installment'} type O tipo de série.
 * @param {number} startMonth O mês de início para exclusão (1-12).
 * @param {number} startYear O ano de início para exclusão.
 * @param {number} [startParcela] O número da parcela de início para exclusão (apenas para parcelamento).
 * @param {number} [originalDia] O dia original de compra (para parcelamento).
 * @param {number} [originalMes] O mês original de compra (para parcelamento).
 * @param {number} [originalAno] O ano original de compra (para parcelamento).
 * @param {string} [baseDescription] A descrição base sem a parte da parcela (para parcelamento).
 */
async function stopRecurringOrInstallmentSeries(seriesId, type, startMonth, startYear, startParcela = 1, originalDia = null, originalMes = null, originalAno = null, baseDescription = null) {
    const batchPromises = [];
    let queryRef;

    if (type === 'recurring') {
        queryRef = query(
            lancamentosCollection,
            where("recurringGroupId", "==", seriesId),
            where("householdId", "==", currentHouseholdId),
            where("ano", ">=", startYear) // Inclui lançamentos do ano de início ou posteriores
        );
    } else if (type === 'installment' && originalAno) {
        queryRef = query(
            lancamentosCollection,
            where("originalPurchaseAno", "==", originalAno),
            where("originalPurchaseMes", "==", originalMes),
            where("originalPurchaseDia", "==", originalDia),
            where("descricao", "==", baseDescription), // Compara a descrição base
            where("householdId", "==", currentHouseholdId)
        );
    } else {
        throw new Error('Tipo de série ou parâmetros para parar série inválidos.');
    }

    const snapshot = await getDocs(queryRef);

    snapshot.forEach(docSnapshot => {
        const lancamento = docSnapshot.data();
        let shouldDelete = false;

        if (type === 'recurring') {
            // Excluir se for o ano de início e o mês for igual ou maior, ou se o ano for maior
            if (lancamento.ano === startYear && lancamento.mes >= startMonth) {
                shouldDelete = true;
            } else if (lancamento.ano > startYear) {
                shouldDelete = true;
            }
        } else if (type === 'installment') {
            // Para parcelas, exclui a partir da parcela especificada
            if (lancamento.parcelaAtual >= startParcela) {
                shouldDelete = true;
            }
        }

        if (shouldDelete) {
            batchPromises.push(deleteDoc(doc(db, lancamentosCollection.path, docSnapshot.id)));
        }
    });

    await Promise.all(batchPromises);
}


/**
 * Lida com a mudança no checkbox de seleção individual de um lançamento.
 * @param {Event} event O objeto do evento de mudança.
 */
function handleLancamentoCheckboxChange(event) {
    const id = event.target.dataset.id;
    if (event.target.checked) {
        selectedLancamentosIds.add(id);
    } else {
        selectedLancamentosIds.delete(id);
    }
    // Atualiza o estado do checkbox "Selecionar Todos" no cabeçalho
    const allCheckboxes = document.querySelectorAll('.lancamento-checkbox');
    const headerSelectAllCheckbox = document.getElementById('headerSelectAllCheckbox');
    if (headerSelectAllCheckbox) {
        if (selectedLancamentosIds.size === allCheckboxes.length && allCheckboxes.length > 0) {
            headerSelectAllCheckbox.checked = true;
            headerSelectAllCheckbox.indeterminate = false;
        } else if (selectedLancamentosIds.size > 0) {
            headerSelectAllCheckbox.checked = false;
            headerSelectAllCheckbox.indeterminate = true;
        } else {
            headerSelectAllCheckbox.checked = false;
            headerSelectAllCheckbox.indeterminate = false;
        }
    }
}

/**
 * Lida com a mudança no checkbox "Selecionar Todos".
 * @param {Event} event O objeto do evento de mudança.
 */
function handleSelectAllChange(event) {
    const isChecked = event.target.checked;
    const lancamentoCheckboxes = document.querySelectorAll('.lancamento-checkbox');
    lancamentoCheckboxes.forEach(checkbox => {
        checkbox.checked = isChecked;
        const id = checkbox.dataset.id;
        if (isChecked) {
            selectedLancamentosIds.add(id);
        } else {
            selectedLancamentosIds.delete(id);
        }
    });
    // Garante que o checkbox no cabeçalho da tabela também reflita
    const headerSelectAllCheckbox = document.getElementById('headerSelectAllCheckbox');
    if (headerSelectAllCheckbox) {
        headerSelectAllCheckbox.checked = isChecked;
        headerSelectAllCheckbox.indeterminate = false;
    }
}

/**
 * Lida com a exclusão de lançamentos selecionados.
 */
async function handleDeleteSelected() {
    if (selectedLancamentosIds.size === 0) {
        showMessageBox('Atenção', 'Nenhum lançamento selecionado para exclusão.');
        return;
    }

    const confirmation = await showConfirmBox('Confirmar Exclusão em Massa', `Tem certeza que deseja excluir os ${selectedLancamentosIds.size} lançamentos selecionados?`);

    if (confirmation) {
        try {
            const batchPromises = [];
            selectedLancamentosIds.forEach(id => {
                batchPromises.push(deleteDoc(doc(db, lancamentosCollection.path, id)));
            });
            await Promise.all(batchPromises);
            showMessageBox('Sucesso', `${selectedLancamentosIds.size} lançamentos excluídos com sucesso!`);
            selectedLancamentosIds.clear(); // Limpa a seleção após exclusão
            if (selectAllCheckbox) selectAllCheckbox.checked = false;
        } catch (e) {
            console.error("Erro ao excluir lançamentos selecionados: ", e);
            showMessageBox('Erro', 'Erro ao excluir lançamentos selecionados. Por favor, tente novamente.');
        }
    }
}

/**
 * Lida com a definição do ID da família/grupo.
 */
async function handleSetHouseholdId() {
    if (!joinHouseholdIdInput) {
        console.error("Elemento joinHouseholdIdInput não encontrado.");
        return;
    }
    const newHouseholdId = joinHouseholdIdInput.value.trim();
    if (newHouseholdId) {
        currentHouseholdId = newHouseholdId;
        localStorage.setItem('savedHouseholdId', currentHouseholdId);
        showMessageBox('Sucesso', `ID da Família/Casa atualizado para: ${currentHouseholdId}. Os lançamentos serão agora associados a este ID.`);
        // Re-configura o listener para o novo householdId
        setupFirestoreListener();
    } else {
        showMessageBox('Atenção', 'Por favor, insira um ID de Família/Casa válido.');
    }
}

/**
 * Alterna a visibilidade dos campos de parcela e recorrência.
 */
function toggleParcelaRecurringFields() {
    // Garante que todos os elementos existem
    if (!tipoEntradaRadio || !tipoSaidaRadio || !isRecurringCheckbox || !parcelaFieldsDiv || !parcelaAtualSelect || !totalParcelasSelect) {
        console.error("Um ou mais elementos de controle de parcela/recorrência não foram encontrados.");
        return;
    }

    const isSaida = tipoSaidaRadio.checked;
    const isRecurring = isRecurringCheckbox.checked;

    if (isSaida) {
        parcelaFieldsDiv.classList.remove('hidden');
        if (isRecurring) {
            // Se for recorrente, desabilita e zera campos de parcela
            parcelaAtualSelect.value = '0';
            parcelaAtualSelect.disabled = true;
            totalParcelasSelect.value = '0';
            totalParcelasSelect.disabled = true;
        } else {
            // Se for saída e não recorrente, habilita campos de parcela
            parcelaAtualSelect.disabled = false;
            totalParcelasSelect.disabled = false;
        }
    } else {
        // Se for entrada, esconde e zera tudo
        parcelaFieldsDiv.classList.add('hidden');
        parcelaAtualSelect.value = '0';
        parcelaAtualSelect.disabled = true;
        totalParcelasSelect.value = '0';
        totalParcelasSelect.disabled = true;
        isRecurringCheckbox.checked = false; // Desmarca recorrência se for entrada
    }
}

/**
 * Atualiza o estado dos checkboxes de mês no modal de parar recorrência, desabilitando meses passados.
 */
function updateStopMonthCheckboxes() {
    const selectedYear = parseInt(stopRecurringYearSelect.value);
    const currentMonth = new Date().getMonth() + 1; // Mês atual (1-12)
    const currentYear = new Date().getFullYear();

    monthStopCheckboxes.forEach(checkbox => {
        const monthValue = parseInt(checkbox.value);
        if (selectedYear < currentYear || (selectedYear === currentYear && monthValue < currentMonth)) {
            checkbox.disabled = true; // Desabilita meses passados
            checkbox.checked = false; // Garante que não estejam marcados
        } else {
            checkbox.disabled = false; // Habilita meses futuros ou o mês atual/ano atual
        }
    });

    // Se "Parar a partir do mês atual" estiver marcado, desabilita a seleção de meses específicos
    if (stopFromCurrentMonthCheckbox && stopFromCurrentMonthCheckbox.checked) {
        monthStopCheckboxes.forEach(cb => cb.disabled = true);
        if (specificMonthsSelectionDiv) specificMonthsSelectionDiv.classList.add('opacity-50', 'pointer-events-none');
    } else {
        if (specificMonthsSelectionDiv) specificMonthsSelectionDiv.classList.remove('opacity-50', 'pointer-events-none');
        // Reabilita se não estiver marcado, mas ainda considerando anos/meses passados
        monthStopCheckboxes.forEach(checkbox => {
            const monthValue = parseInt(checkbox.value);
            if (selectedYear < currentYear || (selectedYear === currentYear && monthValue < currentMonth)) {
                checkbox.disabled = true;
            } else {
                checkbox.disabled = false;
            }
        });
    }
}

/**
 * Lida com a mudança no checkbox "Parar a partir do mês atual" no modal.
 * @param {Event} event O objeto do evento de mudança.
 */
function handleStopFromCurrentMonthChange(event) {
    if (event.target.checked) {
        // Desabilita e desmarca os checkboxes de mês individuais
        if (monthStopCheckboxes) monthStopCheckboxes.forEach(cb => {
            cb.disabled = true;
            cb.checked = false;
        });
        // Desabilita o select de ano
        if (stopRecurringYearSelect) stopRecurringYearSelect.disabled = true;
        // Adiciona classe para escurecer e desabilitar eventos de clique
        if (specificMonthsSelectionDiv) specificMonthsSelectionDiv.classList.add('opacity-50', 'pointer-events-none');

    } else {
        // Habilita os checkboxes de mês individuais e o select de ano
        if (monthStopCheckboxes) monthStopCheckboxes.forEach(cb => cb.disabled = false);
        if (stopRecurringYearSelect) stopRecurringYearSelect.disabled = false;
        if (specificMonthsSelectionDiv) specificMonthsSelectionDiv.classList.remove('opacity-50', 'pointer-events-none');
        // Atualiza novamente para garantir que meses passados continuem desabilitados
        updateStopMonthCheckboxes();
    }
}


// Inicialização principal da aplicação após o DOM carregar
document.addEventListener('DOMContentLoaded', async () => {
    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);

        onAuthStateChanged(auth, async (user) => {
            if (user) {
                userId = user.uid;
            } else {
                // Tenta autenticar anonimamente se não houver utilizador logado
                try {
                    const userCredential = await signInAnonymously(auth);
                    userId = userCredential.user.uid;
                    showMessageBox("Autenticação", `Autenticado anonimamente com sucesso! Seu ID: ${userId}`);
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

            // Define o filtro inicial para o mês e ano atual, e garante que o Firestore query reflita isso
            const today = new Date();
            const initialMonth = today.getMonth() + 1;
            const initialYear = today.getFullYear();

            if (filterMesAll) filterMesAll.checked = true; // Garante que "Todos os Meses" está marcado inicialmente
            if (filterAnoSelect) filterAnoSelect.value = initialYear;

            lancamentosCollection = collection(db, `artifacts/${appId}/public/data/lancamentos`);
            isAuthReady = true;

            setupFirestoreListener();
            toggleParcelaRecurringFields(); // Inicializa o estado dos campos de parcela/recorrência
            updateStopMonthCheckboxes(); // Inicializa os checkboxes do modal de parar recorrência
        });

    } catch (error) {
        console.error("Erro fatal ao inicializar aplicação:", error);
        const userIdDisplayFallback = document.getElementById('user-id-display');
        if (userIdDisplayFallback) userIdDisplayFallback.textContent = `Erro ao carregar ID do Usuário.`;
        showMessageBox("Erro Crítico", 'Erro ao carregar a aplicação. Por favor, tente novamente mais tarde. Verifique o console do navegador para mais detalhes.');
    }
});
