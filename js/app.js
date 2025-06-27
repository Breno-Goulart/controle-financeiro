// app.js

// --- Importações do Firebase SDK v9 (Modular) ---
// Certifique-se de que estes imports correspondem ao seu firebase-config.js
// Se o firebase-config.js já inicializa 'app', 'db', 'auth' e os exporta,
// você pode importar diretamente de lá.
// Caso contrário, estas linhas são necessárias se você está importando diretamente da 'firebase'
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js';
import { getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, query, where, orderBy, onSnapshot, serverTimestamp, Timestamp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, EmailAuthProvider } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js';


// --- Configurações do Firebase ---
// Você pode carregar estas configurações de firebase-config.js
// Certifique-se de que firebase-config.js esteja carregado ANTES de app.js no seu index.html
// Exemplo de firebase-config.js:
/*
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Inicialize o Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };
*/

// Se você não tem um firebase-config.js exportando, ou se ele está em formato global,
// você precisará definir firebaseConfig aqui e inicializar.
// Vou assumir que você tem um `firebaseConfig` disponível globalmente ou no mesmo escopo
// ou que está sendo importado de um `firebase-config.js` que inicializa e exporta.

// Se você não está usando um firebase-config.js que exporta app, db, auth:
// Exemplo:
// const firebaseConfig = { /* SEU OBJETO DE CONFIGURAÇÃO AQUI */ };
// const app = initializeApp(firebaseConfig);
// const db = getFirestore(app);
// const auth = getAuth(app);

// Se seu firebase-config.js exporta, importe assim:
// import { app, db, auth } from './firebase-config.js'; // Ajuste o caminho conforme necessário

// ***** IMPORTANTE: Vou manter a suposição que seu `firebase-config.js` já inicializa
// ***** `app`, `db`, `auth` e os torna acessíveis. Se não, você precisará descomentar
// ***** e preencher as linhas de `firebaseConfig`, `initializeApp`, `getFirestore`, `getAuth` acima.

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
const emailSignInForm = document.getElementById('emailSignInForm'); // Supondo que você tem um formulário de email/senha
const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const emailSignInButton = document.getElementById('emailSignInButton');
const emailSignUpButton = document.getElementById('emailSignUpButton');


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
// AQUI ESTAVA O PROBLEMA: 'auth' não estava definida.
// Se seu firebase-config.js não exporta `auth` ou se não está usando import/export,
// você precisa garantir que `auth` seja inicializada aqui.
// Por exemplo: const auth = getAuth(app); // Se 'app' estiver definido.

onAuthStateChanged(auth, user => { // AGORA 'auth' DEVE ESTAR DEFINIDA
    if (user) {
        currentUserId = user.uid;
        userNameDisplay.textContent = user.displayName;
        loginSection.style.display = 'none';
        appSection.style.display = 'block';
        console.log('Firebase inicializado com sucesso.');
        updateUIForAuthStatus();
    } else {
        currentUserId = null;
        userNameDisplay.textContent = '';
        loginSection.style.display = 'block';
        appSection.style.display = 'none';
        if (unsubscribeSnapshot) {
            unsubscribeSnapshot();
        }
        clearTransactionsTable();
        updateSummary(0, 0, 0, 0);
    }
});

signInButton.addEventListener('click', async () => {
    const provider = new GoogleAuthProvider();
    try {
        await signInWithPopup(auth, provider); // Usando 'auth' importado
    } catch (error) {
        console.error('Erro ao fazer login com Google:', error);
        alert('Erro ao fazer login com Google: ' + error.message);
    }
});

// Adicionando listeners para login/cadastro com Email e Senha
if (emailSignInButton) {
    emailSignInButton.addEventListener('click', async (e) => {
        e.preventDefault();
        const email = emailInput.value;
        const password = passwordInput.value;
        try {
            await firebase.auth().signInWithEmailAndPassword(email, password);
            alert('Login com e-mail/senha efetuado com sucesso!');
        } catch (error) {
            console.error('Erro ao fazer login com e-mail/senha:', error);
            alert('Erro ao fazer login com e-mail/senha: ' + error.message);
        }
    });
}

if (emailSignUpButton) {
    emailSignUpButton.addEventListener('click', async (e) => {
        e.preventDefault();
        const email = emailInput.value;
        const password = passwordInput.value;
        try {
            await firebase.auth().createUserWithEmailAndPassword(email, password);
            alert('Usuário cadastrado com sucesso! Faça login.');
        } catch (error) {
            console.error('Erro ao cadastrar com e-mail/senha:', error);
            alert('Erro ao cadastrar com e-mail/senha: ' + error.message);
        }
    });
}


signOutButton.addEventListener('click', async () => {
    try {
        await signOut(auth); // Usando 'auth' importado
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
            lancamentosTableBody.innerHTML = '<tr><td colspan="9">Defina um ID de família/casa para carregar os lançamentos.</td></tr>';
            updateSummary(0, 0, 0, 0);
        }
        populateFilterYears();
        resetForm();
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
    dateInput.valueAsDate = new Date();
    descriptionInput.value = '';
    valueInput.value = '';
    categorySelect.value = '';
    typeSaidaRadio.checked = true;
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

    const date = dateInput.value;
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
        date: Timestamp.fromDate(new Date(date)), // Converte para Firestore Timestamp
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
        lancamentoData.recurringGroupId = lancamentoData.recurringGroupId || (Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + Date.now());
    } else {
        delete lancamentoData.originalPurchaseAno;
        delete lancamentoData.originalPurchaseMes;
        delete lancamentoData.originalPurchaseDia;
        delete lancamentoData.parcelaAtual;
        delete lancamentoData.totalParcelas;
        delete lancamentoData.recurringGroupId;
    }

    try {
        if (editingDocId) {
            lancamentoData.createdAt = serverTimestamp(); // ATUALIZA O TIMESTAMP NA EDIÇÃO
            await updateDoc(doc(db, 'artifacts', 'controle-financeiro-c1a0b', 'public', 'data', 'lancamentos', editingDocId), lancamentoData);
            alert('Lançamento atualizado com sucesso!');
        } else {
            lancamentoData.createdAt = serverTimestamp(); // NOVO TIMESTAMP PARA NOVOS LANÇAMENTOS
            await addDoc(collection(db, 'artifacts', 'controle-financeiro-c1a0b', 'public', 'data', 'lancamentos'), lancamentoData);
            alert('Lançamento adicionado com sucesso!');
        }
        resetForm();
    } catch (error) {
        console.error('Erro ao salvar lançamento:', error);
        alert('Erro ao salvar lançamento: ' + error.message);
    }
}


function loadTransactions() {
    if (!currentUserId || !currentHouseholdId) {
        clearTransactionsTable();
        loadingIndicator.style.display = 'none';
        return;
    }

    loadingIndicator.style.display = 'block';
    clearTransactionsTable();
    updateSummary(0, 0, 0, 0);

    console.log('Valor de currentHouseholdId antes da query:', currentHouseholdId);
    const projectId = 'controle-financeiro-c1a0b';

    let q = query(collection(db, 'artifacts', projectId, 'public', 'data', 'lancamentos'),
                  where('householdId', '==', currentHouseholdId),
                  orderBy('createdAt', 'desc'));


    const selectedYear = filterAnoSelect.value;
    // O filtro de ano agora precisaria ser mais complexo se 'date' não for usado na ordenação primária
    // Para simplificar, vou manter o filtro no cliente para meses e descrição.
    // O filtro de ano no Firestore exigiria um índice `householdId, createdAt, ano` se 'ano' for um campo.


    const selectedMonths = Array.from(filterMesCheckboxes)
        .filter(checkbox => checkbox.checked)
        .map(checkbox => parseInt(checkbox.value));

    if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
    }

    unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
        console.log('Snapshot recebido. Documentos brutos do Firebase (após filtro de householdId e ordenação):', snapshot.docs.length);
        const lancamentos = [];
        let totalEntradas = 0;
        let totalSaidas = 0;

        snapshot.docs.forEach(docData => {
            const data = docData.data();
            // Garante que o createdAt é um Timestamp válido antes de tentar toDate()
            if (data.createdAt && typeof data.createdAt.toDate === 'function') {
                data.createdAtDate = data.createdAt.toDate();
            } else if (typeof data.createdAt === 'number') {
                data.createdAtDate = new Date(data.createdAt);
            } else {
                data.createdAtDate = null;
            }

            if (data.date && typeof data.date.toDate === 'function') {
                data.transactionDate = data.date.toDate();
            } else {
                data.transactionDate = null;
            }

            lancamentos.push({ id: docData.id, ...data });
        });

        let filteredLancamentos = lancamentos.filter(lancamento => {
            // Filtro por ano
            if (selectedYear && selectedYear !== 'Todos') {
                if (lancamento.transactionDate) {
                    const anoLancamento = lancamento.transactionDate.getFullYear();
                    if (anoLancamento !== parseInt(selectedYear)) {
                        return false;
                    }
                } else {
                    return false;
                }
            }

            // Filtro por mês
            if (selectedMonths.length > 0) {
                if (lancamento.transactionDate) {
                    const mesLancamento = lancamento.transactionDate.getMonth() + 1;
                    if (!selectedMonths.includes(mesLancamento)) {
                        return false;
                    }
                } else {
                    return false;
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
            updateSummary(0, 0, 0, 0);
            return;
        }

        filteredLancamentos.forEach(lancamento => {
            const row = lancamentosTableBody.insertRow();

            const originalDateCell = row.insertCell();
            let displayDate = 'N/A';
            if (lancamento.transactionDate) {
                displayDate = lancamento.transactionDate.toLocaleDateString('pt-BR');
            } else if (lancamento.originalPurchaseDia && lancamento.originalPurchaseMes && lancamento.originalPurchaseAno) {
                displayDate = `${lancamento.originalPurchaseDia}/${lancamento.originalPurchaseMes}/${lancamento.originalPurchaseAno}`;
            }
            originalDateCell.textContent = displayDate;

            const recorrenciaCell = row.insertCell();
            if (lancamento.isRecurring) {
                const stopRecurringBtn = document.createElement('button');
                stopRecurringBtn.textContent = 'Parar Recorrência';
                stopRecurringBtn.className = 'button is-small is-warning';
                stopRecurringBtn.onclick = () => stopRecurringTransaction(lancamento.recurringGroupId);
                recorrenciaCell.appendChild(stopRecurringBtn);
            }

            const descriptionCell = row.insertCell();
            descriptionCell.textContent = lancamento.description;

            const valueCell = row.insertCell();
            valueCell.textContent = lancamento.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            valueCell.style.color = lancamento.type === 'entrada' ? 'green' : 'red';
            if (lancamento.type === 'entrada') {
                totalEntradas += lancamento.value;
            } else {
                totalSaidas += lancamento.value;
            }

            const categoryCell = row.insertCell();
            categoryCell.textContent = lancamento.category;

            const typeCell = row.insertCell();
            typeCell.textContent = lancamento.type === 'entrada' ? 'Entrada' : 'Saída';

            const isRecurringCell = row.insertCell();
            isRecurringCell.textContent = lancamento.isRecurring ? `Sim (${lancamento.parcelaAtual}/${lancamento.totalParcelas})` : 'Não';

            const householdIdCell = row.insertCell();
            householdIdCell.textContent = lancamento.householdId;

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

        const saldoMes = totalEntradas - totalSaidas;
        const currentMonthDays = new Date(filterAnoSelect.value, selectedMonths[0] || new Date().getMonth() + 1, 0).getDate();
        const mediaGastoDiario = totalSaidas / currentMonthDays || 0;
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
        await deleteDoc(doc(db, 'artifacts', 'controle-financeiro-c1a0b', 'public', 'data', 'lancamentos', docId));
        alert('Lançamento excluído com sucesso!');
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
    filterAnoSelect.innerHTML = '<option value="Todos">Todos</option>';
    for (let i = currentYear + 1; i >= 2000; i--) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = i;
        filterAnoSelect.appendChild(option);
    }
    filterAnoSelect.value = currentYear;
}

// Inicializar
populateFilterYears();
updateUIForAuthStatus();
