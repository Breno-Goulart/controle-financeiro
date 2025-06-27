// app.js

// Certifique-se de que 'firebase' está disponível globalmente ou importe-o se estiver usando módulos.
// Ex: import { initializeApp } from 'firebase/app';
// Ex: import { getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, query, where, orderBy, onSnapshot, serverTimestamp, Timestamp } from 'firebase/firestore';
// Ex: import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'firebase/auth';

// Substitua com as suas configurações do projeto Firebase
// As configurações do Firebase devem estar em firebase-config.js
// const firebaseConfig = { /* SEU OBJETO DE CONFIGURAÇÃO AQUI */ };
// firebase.initializeApp(firebaseConfig);
// const db = firebase.firestore();
// const auth = firebase.auth();


// Elementos do DOM
const signInButton = document.getElementById('signInButton');
const signOutButton = document.getElementById('signOutButton');
const addLancamentoForm = document.getElementById('addLancamentoForm');
const lancamentosTableBody = document.getElementById('lancamentosTableBody');
const loadingIndicator = document.getElementById('loadingIndicator');
const currentHouseholdIdSpan = document.getElementById('currentHouseholdId');
const householdIdInput = document.getElementById('householdIdInput');
const setHouseholdIdButton = document.getElementById('setHouseholdIdButton');
const loginSection = document.getElementById('loginSection');
const appSection = document.getElementById('appSection');
const userNameDisplay = document.getElementById('userNameDisplay');

// Elementos do formulário de lançamento
const dateInput = document.getElementById('dateInput');
const descriptionInput = document.getElementById('descriptionInput');
const valueInput = document.getElementById('valueInput');
const categorySelect = document.getElementById('categorySelect');
const typeEntradaRadio = document.getElementById('typeEntrada');
const typeSaidaRadio = document.getElementById('typeSaida');
const isRecurringCheckbox = document.getElementById('isRecurring');
const originalPurchaseAnoInput = document.getElementById('originalPurchaseAno');
const originalPurchaseMesInput = document.getElementById('originalPurchaseMes');
const originalPurchaseDiaInput = document.getElementById('originalPurchaseDia');
const parcelaAtualInput = document.getElementById('parcelaAtual');
const totalParcelasInput = document.getElementById('totalParcelas');
const addLancamentoButton = document.getElementById('addLancamentoButton');

// Filtros
const filterAnoSelect = document.getElementById('filterAno');
const filterMesCheckboxes = document.querySelectorAll('.filterMes');
const searchDescriptionInput = document.getElementById('searchDescription');

// Resumo
const totalEntradasSpan = document.getElementById('totalEntradas');
const totalSaidasSpan = document.getElementById('totalSaidas');
const mediaGastoDiarioSpan = document.getElementById('mediaGastoDiario');
const saldoMesSpan = document.getElementById('saldoMes');

let currentUserId = null;
let currentHouseholdId = localStorage.getItem('currentHouseholdId') || null;
let editingDocId = null;
let unsubscribeSnapshot = null; // Para desinscrever do listener do Firestore

// --- Funções de Autenticação ---
auth.onAuthStateChanged(user => {
    if (user) {
        currentUserId = user.uid;
        userNameDisplay.textContent = user.displayName;
        loginSection.style.display = 'none';
        appSection.style.display = 'block';
        console.log('Firebase inicializado com sucesso.'); // Debug
        updateUIForAuthStatus();
    } else {
        currentUserId = null;
        userNameDisplay.textContent = '';
        loginSection.style.display = 'block';
        appSection.style.display = 'none';
        if (unsubscribeSnapshot) {
            unsubscribeSnapshot(); // Para de ouvir as transações
        }
        clearTransactionsTable();
        updateSummary(0, 0, 0, 0); // Limpa o resumo
    }
});

signInButton.addEventListener('click', async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        await auth.signInWithPopup(provider);
    } catch (error) {
        console.error('Erro ao fazer login:', error);
        alert('Erro ao fazer login: ' + error.message);
    }
});

signOutButton.addEventListener('click', async () => {
    try {
        await auth.signOut();
        alert('Deslogado com sucesso!');
    } catch (error) {
        console.error('Erro ao fazer logout:', error);
        alert('Erro ao fazer logout: ' + error.message);
    }
});

// --- Funções de Interface do Usuário (UI) ---
function updateUIForAuthStatus() {
    if (currentUserId) {
        loginSection.style.display = 'none';
        appSection.style.display = 'block';
        if (currentHouseholdId) {
            currentHouseholdIdSpan.textContent = currentHouseholdId;
            householdIdInput.value = currentHouseholdId;
            loadTransactions();
        } else {
            currentHouseholdIdSpan.textContent = 'Nenhum (defina um ID de família/casa)';
            // Oculta a tabela de lançamentos até que um householdId seja definido
            lancamentosTableBody.innerHTML = '<tr><td colspan="9">Defina um ID de família/casa para carregar os lançamentos.</td></tr>';
            updateSummary(0, 0, 0, 0); // Limpa o resumo
        }
        populateFilterYears(); // Preenche os anos do filtro
        resetForm(); // Limpa o formulário de lançamento
    } else {
        loginSection.style.display = 'block';
        appSection.style.display = 'none';
    }
}

setHouseholdIdButton.addEventListener('click', () => {
    const newHouseholdId = householdIdInput.value.trim();
    if (newHouseholdId) {
        currentHouseholdId = newHouseholdId;
        localStorage.setItem('currentHouseholdId', currentHouseholdId);
        currentHouseholdIdSpan.textContent = currentHouseholdId;
        loadTransactions();
    } else {
        alert('Por favor, insira um ID de família/casa válido.');
    }
});

function clearTransactionsTable() {
    lancamentosTableBody.innerHTML = '';
}

function updateSummary(entradas, saidas, mediaDiaria, saldoMes) {
    totalEntradasSpan.textContent = entradas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    totalSaidasSpan.textContent = saidas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    mediaGastoDiarioSpan.textContent = mediaDiaria.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    saldoMesSpan.textContent = saldoMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    if (saldoMes < 0) {
        saldoMesSpan.style.color = 'red';
    } else if (saldoMes > 0) {
        saldoMesSpan.style.color = 'green';
    } else {
        saldoMesSpan.style.color = 'inherit';
    }
}

function resetForm() {
    dateInput.valueAsDate = new Date(); // Define a data atual
    descriptionInput.value = '';
    valueInput.value = '';
    categorySelect.value = '';
    typeSaidaRadio.checked = true; // Padrão para Saída
    isRecurringCheckbox.checked = false;
    originalPurchaseAnoInput.value = '';
    originalPurchaseMesInput.value = '';
    originalPurchaseDiaInput.value = '';
    parcelaAtualInput.value = '';
    totalParcelasInput.value = '';
    addLancamentoButton.textContent = 'Adicionar Lançamento';
    editingDocId = null;
}

// --- Funções de Lançamento (Adicionar/Editar/Excluir/Carregar) ---

addLancamentoForm.addEventListener('submit', handleTransactionSubmit);

async function handleTransactionSubmit(e) {
    e.preventDefault();

    if (!currentUserId || !currentHouseholdId) {
        alert('Você precisa estar logado e ter um ID de família/casa definido para adicionar lançamentos.');
        return;
    }

    const date = dateInput.value; // Formato YYYY-MM-DD
    const description = descriptionInput.value.trim();
    const value = parseFloat(valueInput.value);
    const category = categorySelect.value;
    const type = typeEntradaRadio.checked ? 'entrada' : 'saida';
    const isRecurring = isRecurringCheckbox.checked;

    if (!date || !description || isNaN(value) || value <= 0 || !category) {
        alert('Por favor, preencha todos os campos obrigatórios e garanta que o valor seja positivo.');
        return;
    }

    const lancamentoData = {
        userId: currentUserId,
        householdId: currentHouseholdId,
        date: firebase.firestore.Timestamp.fromDate(new Date(date)), // Converte para Firestore Timestamp
        description: description,
        value: value,
        category: category,
        type: type,
        isRecurring: isRecurring,
    };

    if (isRecurring) {
        lancamentoData.originalPurchaseAno = parseInt(originalPurchaseAnoInput.value);
        lancamentoData.originalPurchaseMes = parseInt(originalPurchaseMesInput.value);
        lancamentoData.originalPurchaseDia = parseInt(originalPurchaseDiaInput.value);
        lancamentoData.parcelaAtual = parseInt(parcelaAtualInput.value);
        lancamentoData.totalParcelas = parseInt(totalParcelasInput.value);
        lancamentoData.recurringGroupId = lancamentoData.recurringGroupId || (Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + Date.now()); // Gera um ID se não existir
    } else {
        // Garante que campos de recorrência não existem se não for recorrente
        delete lancamentoData.originalPurchaseAno;
        delete lancamentoData.originalPurchaseMes;
        delete lancamentoData.originalPurchaseDia;
        delete lancamentoData.parcelaAtual;
        delete lancamentoData.totalParcelas;
        delete lancamentoData.recurringGroupId;
    }

    try {
        if (editingDocId) {
            // Se estiver editando, adicione ou atualize o createdAt se necessário (ou remova se não quiser que mude na edição)
            lancamentoData.createdAt = firebase.firestore.FieldValue.serverTimestamp(); // ATUALIZA O TIMESTAMP NA EDIÇÃO
            await db.collection('artifacts').doc('controle-financeiro-c1a0b').collection('public').doc('data').collection('lancamentos').doc(editingDocId).update(lancamentoData);
            alert('Lançamento atualizado com sucesso!');
        } else {
            // Ao criar um novo lançamento, defina createdAt usando serverTimestamp()
            lancamentoData.createdAt = firebase.firestore.FieldValue.serverTimestamp(); // NOVO TIMESTAMP PARA NOVOS LANÇAMENTOS
            await db.collection('artifacts').doc('controle-financeiro-c1a0b').collection('public').doc('data').collection('lancamentos').add(lancamentoData);
            alert('Lançamento adicionado com sucesso!');
        }
        resetForm();
    } catch (error) {
        console.error('Erro ao salvar lançamento:', error);
        alert('Erro ao salvar lançamento: ' + error.message);
    }
}


// Função para carregar lançamentos com filtros e ordenação
function loadTransactions() {
    if (!currentUserId || !currentHouseholdId) {
        clearTransactionsTable();
        loadingIndicator.style.display = 'none';
        return;
    }

    loadingIndicator.style.display = 'block';
    clearTransactionsTable();
    updateSummary(0, 0, 0, 0); // Limpa o resumo antes de carregar

    console.log('Valor de currentHouseholdId antes da query:', currentHouseholdId); // Debug
    const projectId = 'controle-financeiro-c1a0b'; // Substitua pelo seu ID de projeto real se for diferente

    let query = db.collection('artifacts').doc(projectId).collection('public').doc('data').collection('lancamentos');

    console.log(`Tentando carregar lançamentos do caminho: artifacts/${projectId}/public/data/lancamentos com householdId: "${currentHouseholdId}"`); // Debug

    // Para consulta no Firestore: Filtra por householdId E ordena por data
    // Isso requer um índice composto no Firebase: householdId ASC, createdAt DESC (se você ordenar por createdAt)
    query = query.where('householdId', '==', currentHouseholdId).orderBy('createdAt', 'desc');


    // Aplicar filtros de ano
    const selectedYear = filterAnoSelect.value;
    if (selectedYear && selectedYear !== 'Todos') {
        query = query.where('ano', '==', parseInt(selectedYear));
    }

    // Aplicar filtros de mês
    const selectedMonths = Array.from(filterMesCheckboxes)
        .filter(checkbox => checkbox.checked)
        .map(checkbox => parseInt(checkbox.value)); // Assume que value é o número do mês (1-12)

    // Se houver meses selecionados, a lógica de filtro de mês é mais complexa e pode exigir mais consultas ou pós-processamento no cliente.
    // Para simplificar, faremos o filtro no cliente para meses, após a obtenção dos dados primários.
    // Consultas .where() múltiplas em campos diferentes e com operadores de intervalo são complexas e exigem muitos índices.

    // Remover listener anterior se existir
    if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
    }

    unsubscribeSnapshot = query.onSnapshot(snapshot => {
        console.log('Snapshot recebido. Documentos brutos do Firebase (após filtro de householdId e ordenação):', snapshot.docs.length); // Debug
        const lancamentos = [];
        let totalEntradas = 0;
        let totalSaidas = 0;

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            // Garante que o createdAt é um Timestamp válido antes de tentar toDate()
            if (data.createdAt && typeof data.createdAt.toDate === 'function') {
                 // Converte o Firestore Timestamp para um objeto Date
                data.createdAtDate = data.createdAt.toDate();
            } else if (typeof data.createdAt === 'number') {
                // Se createdAt for um número (epoch timestamp), converte para Date
                data.createdAtDate = new Date(data.createdAt);
            } else {
                data.createdAtDate = null; // Ou um valor padrão se createdAt não for válido
            }

            // O mesmo para o campo 'date'
            if (data.date && typeof data.date.toDate === 'function') {
                data.transactionDate = data.date.toDate();
            } else {
                data.transactionDate = null;
            }


            lancamentos.push({ id: doc.id, ...data });
        });


        // Filtrar no lado do cliente por mês e descrição, se necessário
        let filteredLancamentos = lancamentos.filter(lancamento => {
            // Filtro por mês
            if (selectedMonths.length > 0) {
                if (lancamento.transactionDate) {
                    const mesLancamento = lancamento.transactionDate.getMonth() + 1; // getMonth() é 0-indexado
                    if (!selectedMonths.includes(mesLancamento)) {
                        return false;
                    }
                } else {
                    return false; // Se não tem data válida, exclui
                }
            }

            // Filtro por descrição
            const searchTerm = searchDescriptionInput.value.trim().toLowerCase();
            if (searchTerm && !lancamento.description.toLowerCase().includes(searchTerm)) {
                return false;
            }
            return true;
        });

        clearTransactionsTable();

        if (filteredLancamentos.length === 0) {
            lancamentosTableBody.innerHTML = '<tr><td colspan="9">Nenhum lançamento encontrado para esta Chave de Acesso (ou após os filtros).</td></tr>';
            loadingIndicator.style.display = 'none';
            updateSummary(0, 0, 0, 0); // Zera o resumo se não houver lançamentos
            return;
        }

        filteredLancamentos.forEach(lancamento => {
            const row = lancamentosTableBody.insertRow();

            // DATA ORIGINAL / DATA DA PARCELA
            const originalDateCell = row.insertCell();
            let displayDate = 'N/A';
            if (lancamento.transactionDate) {
                displayDate = lancamento.transactionDate.toLocaleDateString('pt-BR');
            } else if (lancamento.originalPurchaseDia && lancamento.originalPurchaseMes && lancamento.originalPurchaseAno) {
                // Se não tem 'date' mas tem data original para recorrência
                displayDate = `${lancamento.originalPurchaseDia}/${lancamento.originalPurchaseMes}/${lancamento.originalPurchaseAno}`;
            }
            originalDateCell.textContent = displayDate;

            // Ações Recorrência (se houver)
            const recorrenciaCell = row.insertCell();
            if (lancamento.isRecurring) {
                const stopRecurringBtn = document.createElement('button');
                stopRecurringBtn.textContent = 'Parar Recorrência';
                stopRecurringBtn.className = 'button is-small is-warning';
                stopRecurringBtn.onclick = () => stopRecurringTransaction(lancamento.recurringGroupId);
                recorrenciaCell.appendChild(stopRecurringBtn);
            }

            // Descrição
            const descriptionCell = row.insertCell();
            descriptionCell.textContent = lancamento.description;

            // Valor
            const valueCell = row.insertCell();
            valueCell.textContent = lancamento.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            valueCell.style.color = lancamento.type === 'entrada' ? 'green' : 'red';
            if (lancamento.type === 'entrada') {
                totalEntradas += lancamento.value;
            } else {
                totalSaidas += lancamento.value;
            }

            // Categoria
            const categoryCell = row.insertCell();
            categoryCell.textContent = lancamento.category;

            // Tipo
            const typeCell = row.insertCell();
            typeCell.textContent = lancamento.type === 'entrada' ? 'Entrada' : 'Saída';

            // Recorrente
            const isRecurringCell = row.insertCell();
            isRecurringCell.textContent = lancamento.isRecurring ? `Sim (${lancamento.parcelaAtual}/${lancamento.totalParcelas})` : 'Não';

            // Household ID
            const householdIdCell = row.insertCell();
            householdIdCell.textContent = lancamento.householdId;

            // Ações (Editar/Excluir)
            const actionsCell = row.insertCell();
            const editButton = document.createElement('button');
            editButton.textContent = 'Editar';
            editButton.className = 'button is-small is-info mr-2';
            editButton.onclick = () => editTransaction(lancamento.id, lancamento);
            actionsCell.appendChild(editButton);

            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Excluir';
            deleteButton.className = 'button is-small is-danger';
            deleteButton.onclick = () => deleteTransaction(lancamento.id);
            actionsCell.appendChild(deleteButton);
        });

        // Atualizar o resumo
        const saldoMes = totalEntradas - totalSaidas;
        // Calcular média de gasto diário apenas se houver saídas e dias no mês
        // Isso é um cálculo simplificado, o ideal seria considerar apenas os dias com lançamentos
        const currentMonthDays = new Date(filterAnoSelect.value, selectedMonths[0] || new Date().getMonth() + 1, 0).getDate();
        const mediaGastoDiario = totalSaidas / currentMonthDays || 0; // Evita divisão por zero
        updateSummary(totalEntradas, totalSaidas, mediaGastoDiario, saldoMes);

        loadingIndicator.style.display = 'none';
    }, error => {
        console.error('Erro ao carregar lançamentos:', error);
        lancamentosTableBody.innerHTML = '<tr><td colspan="9">Erro ao carregar lançamentos. Verifique o console para mais detalhes.</td></tr>';
        loadingIndicator.style.display = 'none';
    });
}


async function editTransaction(docId, lancamento) {
    editingDocId = docId;
    dateInput.value = lancamento.date ? lancamento.date.toDate().toISOString().split('T')[0] : '';
    descriptionInput.value = lancamento.description;
    valueInput.value = lancamento.value;
    categorySelect.value = lancamento.category;
    if (lancamento.type === 'entrada') {
        typeEntradaRadio.checked = true;
    } else {
        typeSaidaRadio.checked = true;
    }
    isRecurringCheckbox.checked = lancamento.isRecurring;

    if (lancamento.isRecurring) {
        originalPurchaseAnoInput.value = lancamento.originalPurchaseAno || '';
        originalPurchaseMesInput.value = lancamento.originalPurchaseMes || '';
        originalPurchaseDiaInput.value = lancamento.originalPurchaseDia || '';
        parcelaAtualInput.value = lancamento.parcelaAtual || '';
        totalParcelasInput.value = lancamento.totalParcelas || '';
    } else {
        originalPurchaseAnoInput.value = '';
        originalPurchaseMesInput.value = '';
        originalPurchaseDiaInput.value = '';
        parcelaAtualInput.value = '';
        totalParcelasInput.value = '';
    }
    addLancamentoButton.textContent = 'Atualizar Lançamento';
}

async function deleteTransaction(docId) {
    if (!confirm('Tem certeza que deseja excluir este lançamento?')) {
        return;
    }

    try {
        await db.collection('artifacts').doc('controle-financeiro-c1a0b').collection('public').doc('data').collection('lancamentos').doc(docId).delete();
        alert('Lançamento excluído com sucesso!');
        // A tabela será automaticamente atualizada pelo listener onSnapshot
    } catch (error) {
        console.error('Erro ao excluir lançamento:', error);
        alert('Erro ao excluir lançamento: ' + error.message);
    }
}

// --- Funções de Filtro ---
filterAnoSelect.addEventListener('change', loadTransactions);
filterMesCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', loadTransactions);
});
searchDescriptionInput.addEventListener('input', loadTransactions);

function populateFilterYears() {
    const currentYear = new Date().getFullYear();
    // Limpa opções existentes, exceto "Todos"
    filterAnoSelect.innerHTML = '<option value="Todos">Todos</option>';
    for (let i = currentYear + 1; i >= 2000; i--) { // Exibe o ano atual + 1 e vai até 2000
        const option = document.createElement('option');
        option.value = i;
        option.textContent = i;
        filterAnoSelect.appendChild(option);
    }
    filterAnoSelect.value = currentYear; // Seleciona o ano atual por padrão
}

// Inicializar
populateFilterYears();
updateUIForAuthStatus(); // Chame para configurar a UI no carregamento inicial
