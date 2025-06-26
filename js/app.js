// Este arquivo deve ser salvo em 'js/app.js'

// Configuração do Firebase - SUAS CHAVES JÁ FORAM INSERIDAS AQUI!
const firebaseConfig = {
    apiKey: "AIzaSyD998NH9Vco8Yfk-7n3XgMjLW-LkQkAgLA",
    authDomain: "controle-financeiro-c1a0b.firebaseapp.com",
    projectId: "controle-financeiro-c1a0b",
    storageBucket: "controle-financeiro-c1a0b.firebasestorage.app",
    messagingSenderId: "471645962387",
    appId: "1:471645962387:web:fd500fdeb62475596c0d66"
};

// Inicializa o Firebase e verifica a conexão
let db;
const firebaseStatusDiv = document.getElementById('firebase-status');

try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    firebaseStatusDiv.textContent = 'Conexão Firebase: OK';
    firebaseStatusDiv.classList.add('success');
    console.log('Firebase inicializado com sucesso.');
} catch (error) {
    firebaseStatusDiv.textContent = `Conexão Firebase: ERRO - ${error.message}`;
    firebaseStatusDiv.classList.add('error');
    console.error('Erro ao inicializar Firebase:', error);
}

// Elementos do DOM
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
const transactionCurrentParcelInput = document.getElementById('transaction-current-parcel');
const transactionTotalParcelsSelect = document.getElementById('transaction-total-parcels');

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

// --- Funções de Autenticação ---
const updateUIForAuthStatus = (user) => {
    if (user) {
        currentUserId = user.uid;
        currentUserName = user.displayName || user.email;
        loggedUserNameSpan.textContent = `Olá, ${currentUserName}!`;
        logoutButton.classList.remove('hidden');
        dashboardSection.classList.remove('hidden');
        authModal.style.display = 'none';

        // Exibe e preenche o campo householdId
        householdIdInput.value = currentHouseholdId;
        updateHouseholdDisplay();

        loadTransactions(); // Carrega transações do usuário/household logado
        populateFilterYears();
        renderMonthCheckboxes();
    } else {
        currentUserId = null;
        currentUserName = null;
        loggedUserNameSpan.textContent = '';
        logoutButton.classList.add('hidden');
        dashboardSection.classList.add('hidden');
        authModal.style.display = 'flex';
        transactionsTableBody.innerHTML = ''; // Limpa a tabela
        clearMonthlySummary(); // Limpa o resumo ao deslogar
        currentHouseholdId = ''; // Limpa householdId ao deslogar
        localStorage.removeItem('householdId'); // Remove do localStorage
        updateHouseholdDisplay();
    }
};

const handleLogin = async (e) => {
    e.preventDefault();
    const email = loginForm['login-email'].value;
    const password = loginForm['login-password'].value;
    try {
        await firebase.auth().signInWithEmailAndPassword(email, password);
        console.log('Login com e-mail/senha bem-sucedido!');
    } catch (error) {
        alert(`Erro de login: ${error.message}`);
        console.error("Erro de login:", error);
    }
};

const handleRegister = async (e) => {
    e.preventDefault();
    const name = registerForm['register-name'].value;
    const email = registerForm['register-email'].value;
    const password = registerForm['register-password'].value;
    try {
        const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
        await userCredential.user.updateProfile({ displayName: name });
        alert('Cadastro realizado com sucesso! Faça login.');
        console.log('Cadastro de usuário bem-sucedido!');
        showLoginForm();
    } catch (error) {
        alert(`Erro de cadastro: ${error.message}`);
        console.error("Erro de cadastro:", error);
    }
};

const handleGoogleLogin = async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        await firebase.auth().signInWithPopup(provider);
        console.log('Login com Google bem-sucedido!');
    } catch (error) {
        alert(`Erro de login com Google: ${error.message}`);
        console.error("Erro de login com Google:", error);
    }
};

const handleLogout = async () => {
    try {
        await firebase.auth().signOut();
        console.log('Logout bem-sucedido!');
    } catch (error) {
        console.error("Erro ao fazer logout:", error);
    }
};

const handleForgotPassword = async (e) => {
    e.preventDefault();
    const email = prompt("Por favor, digite seu e-mail para resetar a senha:");
    if (email) {
        try {
            await firebase.auth().sendPasswordResetEmail(email);
            alert("Um e-mail para resetar sua senha foi enviado!");
            console.log('E-mail de reset de senha enviado!');
        } catch (error) {
            alert(`Erro ao resetar senha: ${error.message}`);
            console.error("Erro ao resetar senha:", error);
        }
    }
};

// Exibir/Esconder formulários de autenticação
const showRegisterForm = () => {
    loginForm.style.display = 'none';
    registerForm.style.display = 'flex';
};

const showLoginForm = () => {
    loginForm.style.display = 'flex';
    registerForm.style.display = 'none';
};

// Event Listeners de Autenticação
firebase.auth().onAuthStateChanged(updateUIForAuthStatus);
loginForm.addEventListener('submit', handleLogin);
registerForm.addEventListener('submit', handleRegister);
logoutButton.addEventListener('click', handleLogout);
googleLoginBtn.addEventListener('click', handleGoogleLogin);
showRegisterLink.addEventListener('click', (e) => { e.preventDefault(); showRegisterForm(); });
showLoginLink.addEventListener('click', (e) => { e.preventDefault(); showLoginForm(); });
forgotPasswordLink.addEventListener('click', handleForgotPassword);

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

// --- Funções de Transação ---

// Adicionar transação
transactionForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const currentUser = firebase.auth().currentUser; // Garante que currentUser está atualizado
    if (!currentUser) {
        alert('Você precisa estar logado para adicionar lançamentos.');
        return;
    }

    // A householdId é usada como um CAMPO no documento, não no caminho da coleção
    if (!currentHouseholdId) {
        alert('Por favor, defina uma Chave de Acesso (ID da Família/Grupo) para adicionar lançamentos.');
        return;
    }

    const date = transactionDateInput.value;
    const description = transactionDescriptionInput.value.trim();
    const value = parseFloat(transactionValueInput.value);
    const type = document.querySelector('input[name="transaction-type"]:checked').value;
    const category = transactionCategorySelect.value;
    const isRecurring = transactionRecurringCheckbox.checked;
    const totalParcels = parseInt(transactionTotalParcelsSelect.value);

    if (!date || !description || isNaN(value) || value <= 0 || !category || !type) {
        alert('Por favor, preencha todos os campos obrigatórios: Data, Descrição, Valor, Tipo e Categoria.');
        return;
    }

    const transactionData = {
        date: firebase.firestore.Timestamp.fromDate(new Date(date)),
        description: description,
        value: value,
        category: category,
        type: type,
        isRecurring: isRecurring,
        userId: currentUser.uid, // O ID do usuário que fez o lançamento
        userName: currentUserName,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        householdId: currentHouseholdId, // Isso adicionará a householdId como um campo dentro do documento
    };

    try {
        console.log(`Tentando adicionar transação para o caminho fixo: public/data/lancamentos (com campo householdId: "${currentHouseholdId}")`);
        // Caminho fixo para sua estrutura no Firebase
        const transactionRef = db.collection('public').doc('data').collection('lancamentos');

        if (totalParcels > 1) {
            for (let i = 1; i <= totalParcels; i++) {
                const parcelDate = new Date(date);
                parcelDate.setMonth(parcelDate.getMonth() + (i - 1)); // Avança o mês para cada parcela

                await transactionRef.add({
                    ...transactionData,
                    date: firebase.firestore.Timestamp.fromDate(parcelDate),
                    parcel: i,
                    totalParcels: totalParcels,
                    originalDate: firebase.firestore.Timestamp.fromDate(new Date(date)),
                });
            }
            alert(`Lançamento parcelado (${totalParcels}x) adicionado com sucesso em public/data/lancamentos!`);
        } else {
            await transactionRef.add({
                ...transactionData,
                parcel: 1,
                totalParcels: 1,
                originalDate: firebase.firestore.Timestamp.fromDate(new Date(date)),
            });
            alert(`Lançamento adicionado com sucesso em public/data/lancamentos!`);
        }
        transactionForm.reset();
        transactionTotalParcelsSelect.value = 1; // Reseta o seletor de parcelas
    } catch (error) {
        console.error("Erro ao adicionar transação:", error);
        alert(`Erro ao adicionar transação: ${error.message}`);
    }
});


// Carregar transações
const loadTransactions = () => {
    const currentUser = firebase.auth().currentUser; // Garante que currentUser está atualizado

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

    console.log(`Tentando carregar lançamentos do caminho fixo: public/data/lancamentos`);

    // Caminho fixo para sua estrutura no Firebase
    let query = db.collection('public').doc('data').collection('lancamentos');

    // Se a householdId é um CAMPO dentro do documento, e você quer filtrar por ela:
    if (currentHouseholdId) {
        console.log(`Aplicando filtro de campo householdId === "${currentHouseholdId}"`);
        query = query.where('householdId', '==', currentHouseholdId);
    }


    const selectedYear = filterYearSelect.value;
    const selectedMonths = Array.from(monthsCheckboxesDiv.querySelectorAll('input[type="checkbox"]:checked')).map(cb => parseInt(cb.value));
    const searchDescription = filterDescriptionInput.value.toLowerCase().trim();

    query.orderBy('date', 'desc').onSnapshot(snapshot => {
        let transactions = [];
        console.log(`Snapshot recebido para public/data/lancamentos. Número de documentos brutos (após filtro de householdId se aplicado): ${snapshot.size}`);

        if (snapshot.empty) {
            console.log(`Nenhum documento encontrado para o caminho ou as regras do Firebase estão bloqueando o acesso, ou nenhum lançamento corresponde à householdId: "${currentHouseholdId}".`);
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            data.id = doc.id;
            transactions.push(data);
        });

        // Filtragem no cliente por ano, mês e descrição
        let filteredTransactions = transactions.filter(t => {
            const transactionDate = t.date.toDate();
            const transactionYear = transactionDate.getFullYear().toString();
            const transactionMonth = transactionDate.getMonth() + 1;

            const matchesYear = (selectedYear === 'all' || transactionYear === selectedYear);
            const matchesMonth = selectedMonths.length === 0 || selectedMonths.includes(transactionMonth);
            const matchesDescription = searchDescription === '' || t.description.toLowerCase().includes(searchDescription);

            return matchesYear && matchesMonth && matchesDescription;
        });

        console.log(`Número de transações após filtragem de ano/mês/descrição no cliente: ${filteredTransactions.length}`);

        displayTransactions(filteredTransactions);
        updateMonthlySummary(filteredTransactions);
    }, error => {
        console.error(`Erro ao carregar lançamentos para public/data/lancamentos:`, error);
        let errorMessage = 'Erro ao carregar lançamentos. Verifique sua conexão ou Chave de Acesso.';
        if (error.code === 'permission-denied') {
            errorMessage = 'Permissão negada! Verifique as regras de segurança do Firebase Firestore.';
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
        const originalDate = transaction.originalDate ? transaction.originalDate.toDate().toLocaleDateString('pt-BR') : 'N/A';
        const displayDate = transaction.date.toDate().toLocaleDateString('pt-BR');
        const valueClass = transaction.type === 'entrada' ? 'text-income' : 'text-expense';
        const formattedValue = transaction.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const recurrenceText = transaction.isRecurring ? 'Sim' : 'Não';
        const parcelText = transaction.totalParcels > 1 ? `${transaction.parcel}/${transaction.totalParcels}` : 'N/A';
        const householdIdDisplay = transaction.householdId || 'N/A'; // Exibe a householdId se existir

        row.innerHTML = `
            <td class="py-2 px-4">${originalDate}</td>
            <td class="py-2 px-4">${displayDate} (${parcelText})</td>
            <td class="py-2 px-4">${transaction.description}</td>
            <td class="py-2 px-4 ${valueClass}">${formattedValue}</td>
            <td class="py-2 px-4">${transaction.category}</td>
            <td class="py-2 px-4">${transaction.type === 'entrada' ? 'Entrada' : 'Saída'}</td>
            <td class="py-2 px-4">${recurrenceText}</td>
            <td class="py-2 px-4">${householdIdDisplay}</td> <td class="py-2 px-4">
                <button class="bg-blue-600 hover:bg-blue-700 text-white text-sm py-1 px-2 rounded-md edit-btn" data-id="${transaction.id}">Editar</button>
                <button class="bg-red-600 hover:bg-red-700 text-white text-sm py-1 px-2 rounded-md delete-btn" data-id="${transaction.id}">Excluir</button>
            </td>
        `;

        row.querySelector('.edit-btn').addEventListener('click', () => editTransaction(transaction.id));
        row.querySelector('.delete-btn').addEventListener('click', () => deleteTransaction(transaction.id));
    });
};

const editTransaction = async (id) => {
    alert(`Funcionalidade de edição para ${id} será implementada.`);
};

// Delete transaction function
const deleteTransaction = async (id) => {
    if (!currentHouseholdId) { // Manter a verificação para ter certeza que há uma householdId ativa
        alert('Nenhuma Chave de Acesso definida. Não é possível excluir lançamentos relacionados a uma householdId específica.');
        return;
    }
    if (!confirm('Tem certeza que deseja excluir este lançamento?')) {
        return;
    }
    try {
        console.log(`Tentando excluir transação ${id} do caminho fixo: public/data/lancamentos`);
        // Caminho fixo para sua estrutura no Firebase
        await db.collection('public').doc('data').collection('lancamentos').doc(id).delete();
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

    // Filtra transações apenas para o ano e meses selecionados no resumo
    let transactionsForSummary = transactions.filter(t => {
        const transactionDate = t.date.toDate();
        const transactionYear = transactionDate.getFullYear().toString();
        const transactionMonth = transactionDate.getMonth() + 1; // Mês é base 0

        const matchesYear = (selectedYear === 'all' || transactionYear === selectedYear);
        const matchesMonth = selectedMonths.length === 0 || selectedMonths.includes(transactionMonth);

        return matchesYear && matchesMonth;
    });

    let totalEntradas = 0;
    let totalSaidas = 0;
    let daysInPeriod = 0; // Calcularemos os dias do período filtrado

    if (selectedYear && selectedYear !== 'all') {
        let startDate, endDate;
        if (selectedMonths.length === 1) { // Mês único selecionado
            const month = selectedMonths[0];
            startDate = new Date(parseInt(selectedYear), month - 1, 1);
            endDate = new Date(parseInt(selectedYear), month, 0); // Último dia do mês
        } else if (selectedMonths.length > 1) { // Múltiplos meses selecionados (período não contíguo)
            // Para média diária em múltiplos meses não contíguos, seria mais complexo.
            // Por simplicidade, vamos calcular dias apenas se for um mês único ou ano inteiro.
            startDate = new Date(parseInt(selectedYear), Math.min(...selectedMonths) - 1, 1);
            endDate = new Date(parseInt(selectedYear), Math.max(...selectedMonths), 0);
        } else { // Ano inteiro
            startDate = new Date(parseInt(selectedYear), 0, 1);
            endDate = new Date(parseInt(selectedYear), 11, 31);
        }
        daysInPeriod = Math.ceil((endDate - startDate + 1) / (1000 * 60 * 60 * 24)); // Dias de diferença + 1
    }

    transactionsForSummary.forEach(transaction => {
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
    for (let i = currentYear; i >= currentYear - 5; i--) { // Últimos 5 anos
        const option = document.createElement('option');
        option.value = i;
        option.textContent = i;
        filterYearSelect.appendChild(option);
    }
    filterYearSelect.value = currentYear; // Seleciona o ano atual por padrão
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

    // Seleciona o mês atual por padrão (se nenhum checkbox foi marcado antes)
    const currentMonth = new Date().getMonth() + 1;
    const currentMonthCheckbox = document.getElementById(`month-${currentMonth}`);
    if (currentMonthCheckbox) {
        currentMonthCheckbox.checked = true;
    }
};

// Event Listeners de Filtro
filterYearSelect.addEventListener('change', loadTransactions);
filterDescriptionInput.addEventListener('input', loadTransactions);
monthsCheckboxesDiv.addEventListener('change', loadTransactions);
// O event listener para o formulário de transação já está no início do script
transactionForm.addEventListener('submit', addTransaction);


// Define a data atual como padrão para o input de data
document.addEventListener('DOMContentLoaded', () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    transactionDateInput.value = `${year}-${month}-${day}`;

    updateHouseholdDisplay(); // Atualiza display da chave ao carregar
});
