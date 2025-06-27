// js/app.js

// --- Importações do Firebase SDK v9 (Modular) ---
// Importa as funções necessárias diretamente do CDN do Firebase
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js';
import { getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, query, where, orderBy, onSnapshot, serverTimestamp, Timestamp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js';


// --- Configuração do Firebase ---
// Suas chaves de configuração do projeto Firebase
const firebaseConfig = {
    apiKey: "AIzaSyD998NH9Vco8Yfk-7n3XgMjLW-LkQkAgLA",
    authDomain: "controle-financeiro-c1a0b.firebaseapp.com",
    projectId: "controle-financeiro-c1a0b",
    storageBucket: "controle-financeiro-c1a0b.firebasestorage.app",
    messagingSenderId: "471645962387",
    appId: "1:471645962387:web:fd500fdeb62475596c0d66"
};

// --- Inicializa o Firebase e obtém as instâncias de serviço ---
let app;
let db;
let auth;
const firebaseStatusDiv = document.getElementById('firebase-status');

try {
    app = initializeApp(firebaseConfig); // Inicializa o app Firebase
    db = getFirestore(app);             // Obtém a instância do Firestore
    auth = getAuth(app);               // Obtém a instância de autenticação

    firebaseStatusDiv.textContent = 'Conexão Firebase: OK';
    firebaseStatusDiv.classList.add('success');
    console.log('Firebase inicializado com sucesso.');
} catch (error) {
    firebaseStatusDiv.textContent = `Conexão Firebase: ERRO - ${error.message}`;
    firebaseStatusDiv.classList.add('error');
    console.error('Erro ao inicializar Firebase:', error);
}


// --- Elementos do DOM ---
const authModal = document.getElementById('auth-modal');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const showRegisterLink = document.getElementById('show-register');
const showLoginLink = document.getElementById('show-login');
const logoutButton = document.getElementById('logout-button');
const dashboardSection = document.getElementById('dashboard');
const loggedUserNameSpan = document.getElementById('logged-user-name');
const googleLoginBtn = document.getElementById('google-login-btn');
const forgotPasswordLink = document.getElementById('forgot-password-link');

const transactionForm = document.getElementById('transaction-form');
const transactionValueInput = document.getElementById('transaction-value');
const transactionTypeRadios = document.querySelectorAll('input[name="transaction-type"]');
const transactionCategorySelect = document.getElementById('transaction-category');
const transactionRecurringCheckbox = document.getElementById('transaction-recurring');
const transactionDescriptionInput = document.getElementById('transaction-description');
const transactionDateInput = document.getElementById('transaction-date');
const transactionTotalParcelsSelect = document.getElementById('transaction-total-parcels');
const transactionSubmitButton = document.getElementById('transaction-submit-btn');
const cancelEditButton = document.getElementById('cancel-edit-btn');

const transactionsTableBody = document.getElementById('transactions-table-body');

// Elementos do resumo mensal
const totalEntradasSpan = document.getElementById('total-entradas');
const totalSaidasSpan = document.getElementById('total-saidas');
const mediaGastoDiarioSpan = document.getElementById('media-gasto-diario');
const saldoMesSpan = document.getElementById('saldo-mes');

// Filtros
const filterYearSelect = document.getElementById('filter-year');
const filterDescriptionInput = document.getElementById('filter-description');
const monthsCheckboxesDiv = document.querySelector('.months-checkboxes');

// Novos elementos para householdId
const householdIdInput = document.getElementById('household-id-input');
const setHouseholdIdBtn = document.getElementById('set-household-id-btn');
const currentHouseholdDisplay = document.getElementById('current-household-display');

let currentUserId = null;
let currentUserName = null;
let currentHouseholdId = localStorage.getItem('householdId') || ''; // Carrega do localStorage
let editingTransactionId = null; // Variável para controlar o ID da transação em edição
let unsubscribeSnapshot = null; // Para desinscrever do listener do Firestore

// --- Funções de Autenticação ---
// Listener de estado de autenticação
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUserId = user.uid;
        currentUserName = user.displayName || user.email;
        loggedUserNameSpan.textContent = `Olá, ${currentUserName}!`;
        logoutButton.classList.remove('hidden');
        dashboardSection.classList.remove('hidden');
        authModal.style.display = 'none';

        householdIdInput.value = currentHouseholdId;
        updateHouseholdDisplay();

        loadTransactions();
        populateFilterYears();
        renderMonthCheckboxes();
    } else {
        currentUserId = null;
        currentUserName = null;
        loggedUserNameSpan.textContent = '';
        logoutButton.classList.add('hidden');
        dashboardSection.classList.add('hidden');
        authModal.style.display = 'flex';
        transactionsTableBody.innerHTML = '';
        clearMonthlySummary();
        currentHouseholdId = '';
        localStorage.removeItem('householdId');
        updateHouseholdDisplay();
        if (unsubscribeSnapshot) { // Certifique-se de desinscrever ao fazer logout
            unsubscribeSnapshot();
            unsubscribeSnapshot = null;
        }
    }
});

// Manipulador de Login com E-mail/Senha
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = loginForm['login-email'].value;
    const password = loginForm['login-password'].value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
        console.log('Login com e-mail/senha bem-sucedido!');
    } catch (error) {
        alert(`Erro de login: ${error.message}`);
        console.error("Erro de login:", error);
    }
});

// Manipulador de Registro com E-mail/Senha
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = registerForm['register-name'].value;
    const email = registerForm['register-email'].value;
    const password = registerForm['register-password'].value;
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await userCredential.user.updateProfile({ displayName: name });
        alert('Cadastro realizado com sucesso! Faça login.');
        console.log('Cadastro de usuário bem-sucedido!');
        showLoginForm();
    } catch (error) {
        alert(`Erro de cadastro: ${error.message}`);
        console.error("Erro de cadastro:", error);
    }
});

// Manipulador de Login com Google
googleLoginBtn.addEventListener('click', async () => {
    const provider = new GoogleAuthProvider();
    try {
        await signInWithPopup(auth, provider);
        console.log('Login com Google bem-sucedido!');
    } catch (error) {
        alert(`Erro de login com Google: ${error.message}`);
        console.error("Erro de login com Google:", error);
    }
});

// Manipulador de Logout
logoutButton.addEventListener('click', async () => {
    try {
        await signOut(auth);
        console.log('Logout bem-sucedido!');
    } catch (error) {
        console.error("Erro ao fazer logout:", error);
    }
});

// Manipulador de Esqueci a Senha
forgotPasswordLink.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = prompt("Por favor, digite seu e-mail para resetar a senha:");
    if (email) {
        try {
            await sendPasswordResetEmail(auth, email);
            alert("Um e-mail para resetar sua senha foi enviado!");
            console.log('E-mail de reset de senha enviado!');
        } catch (error) {
            alert(`Erro ao resetar senha: ${error.message}`);
            console.error("Erro ao resetar senha:", error);
        }
    }
});

// Exibir/Esconder formulários de autenticação
const showRegisterForm = () => {
    loginForm.style.display = 'none';
    registerForm.style.display = 'flex';
};

const showLoginForm = () => {
    loginForm.style.display = 'flex';
    registerForm.style.display = 'none';
};

showRegisterLink.addEventListener('click', (e) => { e.preventDefault(); showRegisterForm(); });
showLoginLink.addEventListener('click', (e) => { e.preventDefault(); showLoginForm(); });

// --- Funções para Household ID ---
setHouseholdIdBtn.addEventListener('click', () => {
    const newHouseholdId = householdIdInput.value.trim();
    if (newHouseholdId) {
        currentHouseholdId = newHouseholdId;
        localStorage.setItem('householdId', newHouseholdId); // Salva no localStorage
        updateHouseholdDisplay();
        loadTransactions(); // Recarrega transações com o novo householdId
        alert(`Chave de Acesso definida para: "${newHouseholdId}"`);
    } else {
        alert('Por favor, insira uma Chave de Acesso válida.');
    }
});

function updateHouseholdDisplay() {
    if (currentHouseholdId) {
        currentHouseholdDisplay.textContent = `Chave de Acesso atual: ${currentHouseholdId}`;
    } else {
        currentHouseholdDisplay.textContent = 'Nenhuma Chave de Acesso definida. Os lançamentos não serão compartilhados.';
    }
}

// --- Funções de Transação (Adicionar/Atualizar) ---

// Função nomeada para lidar com o envio do formulário (Adicionar ou Editar)
transactionForm.addEventListener('submit', handleTransactionSubmit); // Listener para o formulário

async function handleTransactionSubmit(e) {
    e.preventDefault();

    const currentUser = auth.currentUser;
    if (!currentUser) {
        alert('Você precisa estar logado para adicionar/atualizar lançamentos.');
        return;
    }

    if (!currentHouseholdId) {
        alert('Por favor, defina uma Chave de Acesso (ID da Família/Grupo).');
        return;
    }

    const dateInputVal = transactionDateInput.value;
    const [year, month, day] = dateInputVal.split('-').map(Number); // Pega ano, mês, dia do input de data

    const description = transactionDescriptionInput.value.trim();
    const value = parseFloat(transactionValueInput.value);
    const type = document.querySelector('input[name="transaction-type"]:checked').value;
    const category = transactionCategorySelect.value;
    const isRecurring = transactionRecurringCheckbox.checked;
    const totalParcels = parseInt(transactionTotalParcelsSelect.value);

    if (!dateInputVal || !description || isNaN(value) || value <= 0 || !category || !type) {
        alert('Por favor, preencha todos os campos obrigatórios: Data, Descrição, Valor, Tipo e Categoria.');
        return;
    }

    const lancamentoData = {
        // Para compatibilidade com dados existentes e flexibilidade futura:
        // 'date' será um Timestamp para novas entradas/edições, facilitando ordenação e manipulação de data.
        // 'ano', 'mes', 'dia' são mantidos para compatibilidade com dados legados ou se forem desejados.
        date: Timestamp.fromDate(new Date(dateInputVal)), // Salva a data completa como Timestamp
        ano: year,
        mes: month,
        dia: day,
        description: description,
        value: value,
        category: category,
        type: type,
        isRecurring: isRecurring,
        userId: currentUser.uid,
        userName: currentUserName,
        householdId: currentHouseholdId,
    };

    if (isRecurring && totalParcels > 1) {
        lancamentoData.parcelaAtual = 1; // Lançamento "pai" da recorrência
        lancamentoData.totalParcelas = totalParcels;
        lancamentoData.originalPurchaseAno = year;
        lancamentoData.originalPurchaseMes = month;
        lancamentoData.originalPurchaseDia = day;
        lancamentoData.recurringGroupId = lancamentoData.recurringGroupId || (Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + Date.now());
    } else {
        lancamentoData.parcelaAtual = 1;
        lancamentoData.totalParcelas = 1;
        // remove campos de recorrência se não for aplicável
        delete lancamentoData.originalPurchaseAno;
        delete lancamentoData.originalPurchaseMes;
        delete lancamentoData.originalPurchaseDia;
        delete lancamentoData.recurringGroupId;
    }

    try {
        // Caminho corrigido para a coleção de lançamentos
        const lancamentosCollectionRef = collection(db, 'artifacts', 'controle-financeiro-c1a0b', 'public', 'data', 'lancamentos');

        if (editingTransactionId) {
            lancamentoData.createdAt = serverTimestamp(); // ATUALIZA O TIMESTAMP NA EDIÇÃO
            await updateDoc(doc(db, lancamentosCollectionRef, editingTransactionId), lancamentoData);
            alert('Lançamento atualizado com sucesso!');
        } else {
            lancamentoData.createdAt = serverTimestamp(); // NOVO TIMESTAMP PARA NOVOS LANÇAMENTOS
            await addDoc(lancamentosCollectionRef, lancamentoData);
            alert('Lançamento adicionado com sucesso!');
        }
        transactionForm.reset();
        transactionTotalParcelsSelect.value = 1;
        cancelEdit(); // Reseta o formulário após adicionar/editar
    } catch (error) {
        console.error("Erro ao adicionar/atualizar transação:", error);
        alert(`Erro ao adicionar/atualizar transação: ${error.message}`);
    }
};

// Carregar transações
const loadTransactions = () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
        console.warn('Usuário não logado. Não é possível carregar lançamentos.');
        transactionsTableBody.innerHTML = '<tr><td colspan="9" class="py-4 text-center">Faça login para ver os lançamentos.</td></tr>';
        clearMonthlySummary();
        return;
    }

    if (!currentHouseholdId) {
        console.warn('Nenhuma Chave de Acesso definida. Os lançamentos não serão filtrados por householdId.');
        transactionsTableBody.innerHTML = '<tr><td colspan="9" class="py-4 text-center">Defina uma Chave de Acesso (ID da Família/Grupo) para ver os lançamentos compartilhados.</td></tr>';
        clearMonthlySummary();
        return;
    }

    // Caminho corrigido para a coleção de lançamentos
    console.log(`Tentando carregar lançamentos do caminho: artifacts/controle-financeiro-c1a0b/public/data/lancamentos com householdId: "${currentHouseholdId}"`);

    // Ajuste da query para ordenar por 'ano', 'mes' e 'dia' para compatibilidade com dados existentes
    // Se 'createdAt' for sempre presente e um Timestamp, 'orderBy("createdAt", "desc")' seria o ideal.
    // Usando 'ano' e 'mes' para compatibilidade e como alternativa se 'createdAt' não for consistente.
    let q = query(
        collection(db, 'artifacts', 'controle-financeiro-c1a0b', 'public', 'data', 'lancamentos'),
        where('householdId', '==', currentHouseholdId),
        orderBy('ano', 'desc'), // Ordena por ano
        orderBy('mes', 'desc'), // Depois por mês
        orderBy('dia', 'desc')  // Depois por dia
    );

    const selectedYear = filterYearSelect.value;
    const selectedMonths = Array.from(monthsCheckboxesDiv.querySelectorAll('input[type="checkbox"]:checked')).map(cb => parseInt(cb.value));
    const searchDescription = filterDescriptionInput.value.toLowerCase().trim();

    // Remover listener anterior se existir para evitar duplicação
    if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
    }

    unsubscribeSnapshot = onSnapshot(q, snapshot => {
        let transactions = [];
        console.log(`Snapshot recebido. Documentos brutos do Firebase (após filtro de householdId e ordenação): ${snapshot.size}`);

        if (snapshot.empty) {
            console.log(`Nenhum documento encontrado para o caminho, ou as regras do Firebase estão bloqueando o acesso, ou nenhum lançamento corresponde à householdId: "${currentHouseholdId}".`);
        }

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            // Normaliza as datas para objetos Date para facilitar a filtragem no cliente
            let transactionDateObject = null;
            let originalDateObject = null;

            // Se 'date' for um Timestamp (novos lançamentos)
            if (data.date && typeof data.date.toDate === 'function') {
                transactionDateObject = data.date.toDate();
            } else if (data.ano && data.mes && data.dia) { // Se for a estrutura antiga (ano, mes, dia)
                // Usamos o dia para o mês atual
                transactionDateObject = new Date(data.ano, data.mes - 1, data.dia);
            }

            // Para originalDate, se existir
            if (data.originalPurchaseAno && data.originalPurchaseMes && data.originalPurchaseDia) {
                originalDateObject = new Date(data.originalPurchaseAno, data.originalPurchaseMes - 1, data.originalPurchaseDia);
            } else if (transactionDateObject) { // Se não tem originalPurchase, usa a data da transação como original
                originalDateObject = transactionDateObject;
            }

            transactions.push({ id: docSnap.id, ...data, transactionDateObject, originalDateObject });
        });

        // Filtragem no cliente por ano, mês e descrição
        let filteredTransactions = transactions.filter(t => {
            if (!t.transactionDateObject) return false;

            const transactionYear = t.transactionDateObject.getFullYear().toString();
            const transactionMonth = t.transactionDateObject.getMonth() + 1;

            const matchesYear = (selectedYear === 'all' || transactionYear === selectedYear);
            const matchesMonth = selectedMonths.length === 0 || selectedMonths.includes(transactionMonth);
            const matchesDescription = searchDescription === '' || t.description.toLowerCase().includes(searchDescription);

            return matchesYear && matchesMonth && matchesDescription;
        });

        console.log(`Número de transações após filtragem de ano/mês/descrição no cliente: ${filteredTransactions.length}`);

        displayTransactions(filteredTransactions);
        updateMonthlySummary(filteredTransactions);
    }, error => {
        console.error(`Erro ao carregar lançamentos:`, error);
        let errorMessage = 'Erro ao carregar lançamentos. Verifique sua conexão ou Chave de Acesso.';
        if (error.code === 'permission-denied') {
            errorMessage = 'Permissão negada! Verifique as regras de segurança do Firebase Firestore.';
        } else if (error.code === 'failed-precondition' && error.message.includes('The query requires an index')) {
            // Extrai o link para criar o índice
            const indexLinkMatch = error.message.match(/https:\/\/[^\s]+/);
            const indexLink = indexLinkMatch ? indexLinkMatch[0] : '#';
            errorMessage = `Erro: A consulta requer um índice. Por favor, crie-o no Firebase Console clicando neste link: <a href="${indexLink}" target="_blank" class="text-blue-400 hover:underline">Criar Índice</a>`;
        }
        transactionsTableBody.innerHTML = `<tr><td colspan="9" class="py-4 text-center text-red-500">${errorMessage}</td></tr>`;
        clearMonthlySummary();
    });
};

const displayTransactions = (transactions) => {
    transactionsTableBody.innerHTML = '';
    if (transactions.length === 0) {
        transactionsTableBody.innerHTML = '<tr><td colspan="9" class="py-4 text-center">Nenhum lançamento encontrado para esta Chave de Acesso (ou após os filtros).</td></tr>';
        return;
    }

    transactions.forEach(transaction => {
        const row = transactionsTableBody.insertRow();
        
        // Data Original: pode ser do originalPurchase ou do dia/mes/ano dos dados antigos
        let originalDateDisplay = 'N/A';
        if (transaction.originalDateObject) {
            originalDateDisplay = transaction.originalDateObject.toLocaleDateString('pt-BR');
        } else if (transaction.ano && transaction.mes && transaction.dia) {
            originalDateDisplay = `${String(transaction.dia).padStart(2, '0')}/${String(transaction.mes).padStart(2, '0')}/${transaction.ano}`;
        }

        // Data da Parcela/Transação: usa transactionDateObject que já normaliza Timestamps ou ano/mes/dia
        const transactionDateDisplay = transaction.transactionDateObject ? transaction.transactionDateObject.toLocaleDateString('pt-BR') : 'N/A';
        
        const valueClass = transaction.type === 'entrada' ? 'text-green-400' : 'text-red-400';
        const formattedValue = transaction.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const recurrenceText = transaction.isRecurring ? 'Sim' : 'Não';
        const parcelText = transaction.totalParcels > 1 ? `${transaction.parcelaAtual || 1}/${transaction.totalParcels}` : '1/1';
        const householdIdDisplay = transaction.householdId || 'N/A';

        row.innerHTML = `
            <td class="px-4 py-2">${originalDateDisplay}</td>
            <td class="px-4 py-2">${transactionDateDisplay} (${parcelText})</td>
            <td class="px-4 py-2">${transaction.description}</td>
            <td class="px-4 py-2 ${valueClass}">${formattedValue}</td>
            <td class="px-4 py-2">${transaction.category}</td>
            <td class="px-4 py-2">${transaction.type === 'entrada' ? 'Entrada' : 'Saída'}</td>
            <td class="px-4 py-2">${recurrenceText}</td>
            <td class="px-4 py-2">${householdIdDisplay}</td>
            <td class="px-4 py-2">
                <button class="bg-blue-600 hover:bg-blue-700 text-white text-sm py-1 px-2 rounded-md edit-btn" data-id="${transaction.id}">Editar</button>
                <button class="bg-red-600 hover:bg-red-700 text-white text-sm py-1 px-2 rounded-md delete-btn" data-id="${transaction.id}">Excluir</button>
            </td>
        `;

        row.querySelector('.edit-btn').addEventListener('click', () => editTransaction(transaction.id, transaction));
        row.querySelector('.delete-btn').addEventListener('click', () => deleteTransaction(transaction.id));
    });
};

const editTransaction = async (id) => {
    if (!currentUserId || !currentHouseholdId) {
        alert('Faça login e defina a Chave de Acesso para editar.');
        return;
    }

    try {
        // Caminho corrigido para o documento
        const docRef = doc(db, 'artifacts', 'controle-financeiro-c1a0b', 'public', 'data', 'lancamentos', id);
        const docSnap = await docRef.get();

        if (!docSnap.exists()) {
            alert('Lançamento não encontrado.');
            return;
        }

        const data = docSnap.data();

        // Verificação de Autorização: A householdId deve ser a mesma E o usuário deve ser o criador (ou pelo menos householdId)
        if (data.householdId !== currentHouseholdId && data.userId !== currentUserId) {
            alert('Você não tem permissão para editar este lançamento ou ele não pertence à sua Chave de Acesso.');
            return;
        }

        editingTransactionId = id;

        // Preenche o formulário
        // Se 'date' for Timestamp, usa toISOString(). Se for data antiga (ano, mes, dia), reconstrói.
        if (data.date && typeof data.date.toDate === 'function') {
            transactionDateInput.value = data.date.toDate().toISOString().split('T')[0];
        } else if (data.ano && data.mes && data.dia) {
            const d = new Date(data.ano, data.mes - 1, data.dia);
            transactionDateInput.value = d.toISOString().split('T')[0];
        } else {
            transactionDateInput.value = ''; // Reseta se não houver data válida
        }
        
        transactionDescriptionInput.value = data.description;
        transactionValueInput.value = data.value;
        document.querySelector(`input[name="transaction-type"][value="${data.type}"]`).checked = true;
        transactionCategorySelect.value = data.category;
        transactionRecurringCheckbox.checked = data.isRecurring || false;
        transactionTotalParcelsSelect.value = data.totalParcels || 1;

        transactionSubmitButton.textContent = 'Atualizar Lançamento';
        cancelEditButton.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
        console.error("Erro ao carregar lançamento para edição:", error);
        alert(`Erro ao carregar lançamento para edição: ${error.message}`);
    }
};

const cancelEdit = () => {
    editingTransactionId = null;
    transactionForm.reset();
    transactionSubmitButton.textContent = 'Adicionar Lançamento';
    cancelEditButton.classList.add('hidden');
    transactionTotalParcelsSelect.value = 1;
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    transactionDateInput.value = `${year}-${month}-${day}`;
};

// Delete transaction function
const deleteTransaction = async (id) => {
    if (!currentUserId || !currentHouseholdId) {
        alert('Faça login e defina a Chave de Acesso para excluir lançamentos.');
        return;
    }

    if (!confirm('Tem certeza que deseja excluir este lançamento?')) {
        return;
    }

    try {
        // Caminho corrigido para o documento
        const docRef = doc(db, 'artifacts', 'controle-financeiro-c1a0b', 'public', 'data', 'lancamentos', id);
        const docSnap = await docRef.get();

        if (!docSnap.exists()) {
            alert('Lançamento não encontrado para exclusão.');
            return;
        }

        const data = docSnap.data();

        // Verificação de Autorização: A householdId deve ser a mesma E o usuário deve ser o criador (ou pelo menos householdId)
        if (data.householdId !== currentHouseholdId && data.userId !== currentUserId) {
            alert('Você não tem permissão para excluir este lançamento ou ele não pertence à sua Chave de Acesso.');
            return;
        }

        console.log(`Tentando excluir transação ${id} do caminho: artifacts/controle-financeiro-c1a0b/public/data/lancamentos`);
        await deleteDoc(docRef);
        alert('Lançamento excluído com sucesso!');
    } catch (error) {
        alert(`Erro ao excluir lançamento: ${error.message}`);
        console.error("Erro ao excluir lançamento:", error);
    }
};

// Funções de Resumo Mensal
const updateMonthlySummary = (transactions = []) => {
    const selectedYear = filterYearSelect.value;
    const selectedMonths = Array.from(monthsCheckboxesDiv.querySelectorAll('input[type="checkbox"]:checked')).map(cb => parseInt(cb.value));

    let totalEntradas = 0;
    let totalSaidas = 0;
    let daysInPeriod = 0;

    // Calcula os dias no período apenas se houver pelo menos um mês selecionado
    if (selectedMonths.length > 0 && selectedYear !== 'all') {
        const uniqueMonths = new Set(selectedMonths);
        let calculatedDays = 0;
        uniqueMonths.forEach(month => {
            const date = new Date(parseInt(selectedYear), month, 0); // O dia 0 do próximo mês nos dá o último dia do mês atual
            calculatedDays += date.getDate(); // Número de dias no mês
        });
        daysInPeriod = calculatedDays;
    } else if (selectedYear !== 'all') { // Se apenas o ano está selecionado, e não há meses específicos
        daysInPeriod = 365; // Ou 366 para anos bissextos, simplificando
    }


    transactions.forEach(transaction => {
        if (transaction.type === 'entrada') {
            totalEntradas += transaction.value;
        } else {
            totalSaidas += transaction.value;
        }
    });

    const saldoMes = totalEntradas - totalSaidas;
    const mediaGastoDiario = daysInPeriod > 0 ? (totalSaidas / daysInPeriod) : 0;

    totalEntradasSpan.textContent = totalEntradas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    totalSaidasSpan.textContent = totalSaidas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    mediaGastoDiarioSpan.textContent = mediaGastoDiario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    saldoMesSpan.textContent = saldoMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    saldoMesSpan.classList.remove('positive', 'negative');
    if (saldoMes >= 0) {
        saldoMesSpan.classList.add('positive');
    } else {
        saldoMesSpan.classList.add('negative');
    }
};

const clearMonthlySummary = () => {
    totalEntradasSpan.textContent = 'R$ 0.00';
    totalSaidasSpan.textContent = 'R$ 0.00';
    mediaGastoDiarioSpan.textContent = 'R$ 0.00';
    saldoMesSpan.textContent = 'R$ 0.00';
    saldoMesSpan.classList.remove('positive', 'negative');
};


// Funções de Filtro
const populateFilterYears = () => {
    const currentYear = new Date().getFullYear();
    filterYearSelect.innerHTML = '<option value="all">Todos os Anos</option>';
    for (let i = currentYear; i >= 2020; i--) { // Exibe 5 anos para trás
        const option = document.createElement('option');
        option.value = i;
        option.textContent = i;
        filterYearSelect.appendChild(option);
    }
    filterYearSelect.value = currentYear; // Seleciona o ano atual como padrão
};

const renderMonthCheckboxes = () => {
    monthsCheckboxesDiv.innerHTML = '';
    const months = [
        { name: 'Janeiro', value: 1 }, { name: 'Fevereiro', value: 2 }, { name: 'Março', value: 3 },
        { name: 'Abril', value: 4 }, { name: 'Maio', value: 5 }, { name: 'Junho', value: 6 },
        { name: 'Julho', value: 7 }, { name: 'Agosto', value: 8 }, { name: 'Setembro', value: 9 },
        { name: 'Outubro', value: 10 }, { name: 'Novembro', value: 11 }, { name: 'Dezembro', value: 12 }
    ];

    months.forEach(month => {
        const div = document.createElement('div');
        div.classList.add('flex', 'items-center');
        div.innerHTML = `
            <input type="checkbox" id="month-${month.value}" value="${month.value}" class="form-checkbox h-4 w-4 text-primary rounded border-gray-700 bg-dark-bg focus:ring-primary">
            <label for="month-${month.value}" class="ml-2 text-sm">${month.name}</label>
        `;
        monthsCheckboxesDiv.appendChild(div);
    });

    const currentMonth = new Date().getMonth() + 1;
    const currentMonthCheckbox = document.getElementById(`month-${currentMonth}`);
    if (currentMonthCheckbox) {
        currentMonthCheckbox.checked = true;
    }
};

filterYearSelect.addEventListener('change', loadTransactions);
filterDescriptionInput.addEventListener('input', loadTransactions);
monthsCheckboxesDiv.addEventListener('change', loadTransactions);
cancelEditButton.addEventListener('click', cancelEdit);


// Define a data atual como padrão para o input de data
document.addEventListener('DOMContentLoaded', () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    transactionDateInput.value = `${year}-${month}-${day}`;

    updateHouseholdDisplay();
    // loadTransactions() é chamado no onAuthStateChanged
});
