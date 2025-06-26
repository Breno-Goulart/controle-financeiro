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
const transactionTypeSelect = document.getElementById('transaction-type');
const transactionCategorySelect = document.getElementById('transaction-category');
const transactionRecurringCheckbox = document.getElementById('transaction-recurring');
const transactionDescriptionInput = document.getElementById('transaction-description');
const transactionDateInput = document.getElementById('transaction-date');
const transactionKeyInput = document.getElementById('transaction-key');
const transactionCurrentParcelInput = document.getElementById('transaction-current-parcel');
const transactionTotalParcelsSelect = document.getElementById('transaction-total-parcels'); // Seletor de parcelas

const transactionsTableBody = document.getElementById('transactions-table-body');

// Elementos do resumo mensal (agora no rodapé)
const totalEntradasSpan = document.getElementById('total-entradas');
const totalSaidasSpan = document.getElementById('total-saidas');
const mediaGastoDiarioSpan = document.getElementById('media-gasto-diario');
const saldoMesSpan = document.getElementById('saldo-mes');

// Filtros
const filterYearSelect = document.getElementById('filter-year');
const filterDescriptionInput = document.getElementById('filter-description');
const monthsCheckboxesDiv = document.querySelector('.months-checkboxes');

let currentUserId = null;
let currentUserName = null;

// Funções de Autenticação
const updateUIForAuthStatus = (user) => {
    if (user) {
        currentUserId = user.uid;
        currentUserName = user.displayName || user.email;
        loggedUserNameSpan.textContent = `Olá, ${currentUserName}!`;
        logoutButton.classList.remove('hidden');
        dashboardSection.classList.remove('hidden');
        authModal.style.display = 'none';
        loadTransactions();
        populateFilterYears();
        renderMonthCheckboxes();
        updateMonthlySummary(); // Atualiza o resumo ao logar
    } else {
        currentUserId = null;
        currentUserName = null;
        loggedUserNameSpan.textContent = '';
        logoutButton.classList.add('hidden');
        dashboardSection.classList.add('hidden');
        authModal.style.display = 'flex';
        transactionsTableBody.innerHTML = ''; // Limpa a tabela
        clearMonthlySummary(); // Limpa o resumo ao deslogar
    }
};

const handleLogin = async (e) => {
    e.preventDefault();
    const email = loginForm['login-email'].value;
    const password = loginForm['login-password'].value;
    try {
        await firebase.auth().signInWithEmailAndPassword(email, password);
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
    } catch (error) {
        alert(`Erro de login com Google: ${error.message}`);
        console.error("Erro de login com Google:", error);
    }
};

const handleLogout = async () => {
    try {
        await firebase.auth().signOut();
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

// Funções de Transações
const addTransaction = async (e) => {
    e.preventDefault();

    if (!currentUserId) {
        alert('Você precisa estar logado para adicionar lançamentos.');
        return;
    }

    const key = transactionKeyInput.value.trim();
    const date = transactionDateInput.value;
    const description = transactionDescriptionInput.value.trim();
    const value = parseFloat(transactionValueInput.value);
    const category = transactionCategorySelect.value;
    const type = transactionTypeSelect.value;
    const isRecurring = transactionRecurringCheckbox.checked;
    let currentParcel = parseInt(transactionCurrentParcelInput.value);
    const totalParcels = parseInt(transactionTotalParcelsSelect.value); // Pega do seletor

    if (!key || !date || !description || isNaN(value) || value <= 0 || !category || !type) {
        alert('Por favor, preencha todos os campos corretamente.');
        return;
    }

    const transactionData = {
        key: key,
        date: firebase.firestore.Timestamp.fromDate(new Date(date)),
        description: description,
        value: value,
        category: category,
        type: type,
        isRecurring: isRecurring,
        userId: currentUserId,
        userName: currentUserName,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    try {
        if (totalParcels > 1) {
            for (let i = 1; i <= totalParcels; i++) {
                const parcelDate = new Date(date);
                parcelDate.setMonth(parcelDate.getMonth() + (i - 1)); // Avança o mês para cada parcela

                await db.collection('transactions').add({
                    ...transactionData,
                    date: firebase.firestore.Timestamp.fromDate(parcelDate),
                    parcel: i,
                    totalParcels: totalParcels,
                    originalDate: firebase.firestore.Timestamp.fromDate(new Date(date)), // Salva a data original
                });
            }
            alert(`Lançamento parcelado (${totalParcels}x) adicionado com sucesso!`);
        } else {
            await db.collection('transactions').add({
                ...transactionData,
                parcel: 1, // Assume 1/1 para não parcelado
                totalParcels: 1,
                originalDate: firebase.firestore.Timestamp.fromDate(new Date(date)),
            });
            alert('Lançamento adicionado com sucesso!');
        }
        transactionForm.reset();
        transactionCurrentParcelInput.value = 1; // Reseta para 1
        transactionTotalParcelsSelect.value = 1; // Reseta para 1
    } catch (error) {
        alert(`Erro ao adicionar lançamento: ${error.message}`);
        console.error("Erro ao adicionar lançamento:", error);
    }
};

const loadTransactions = () => {
    if (!currentUserId) return;

    let query = db.collection('transactions').where('userId', '==', currentUserId);

    const selectedYear = filterYearSelect.value;
    const selectedMonths = Array.from(monthsCheckboxesDiv.querySelectorAll('input[type="checkbox"]:checked')).map(cb => parseInt(cb.value));
    const searchDescription = filterDescriptionInput.value.toLowerCase().trim();

    if (selectedYear && selectedYear !== 'all') {
        const startOfYear = new Date(parseInt(selectedYear), 0, 1);
        const endOfYear = new Date(parseInt(selectedYear) + 1, 0, 1);
        query = query.where('date', '>=', startOfYear).where('date', '<', endOfYear);
    }

    if (selectedMonths.length > 0) {
        // Para múltiplos meses, precisamos buscar tudo no ano e filtrar no cliente
        // ou fazer várias consultas (que é mais complexo com Firestore).
        // Por simplicidade e eficiência em pequenas coleções, filtramos após buscar.
    }

    query.orderBy('date', 'desc').onSnapshot(snapshot => {
        let transactions = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            data.id = doc.id;
            transactions.push(data);
        });

        // Filtragem por mês e descrição (se necessário)
        let filteredTransactions = transactions.filter(t => {
            const transactionDate = t.date.toDate();
            const transactionYear = transactionDate.getFullYear().toString();
            const transactionMonth = transactionDate.getMonth() + 1; // Mês é base 0

            const matchesYear = (selectedYear === 'all' || transactionYear === selectedYear);
            const matchesDescription = searchDescription === '' || t.description.toLowerCase().includes(searchDescription);

            return matchesMonth && matchesDescription;
        });

        displayTransactions(filteredTransactions);
        updateMonthlySummary(filteredTransactions);
    }, error => {
        console.error("Erro ao carregar lançamentos:", error);
    });
};

const displayTransactions = (transactions) => {
    transactionsTableBody.innerHTML = '';
    if (transactions.length === 0) {
        transactionsTableBody.innerHTML = '<tr><td colspan="9" class="py-4 text-center">Nenhum lançamento encontrado.</td></tr>';
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

        row.innerHTML = `
            <td class="py-2 px-4">${originalDate}</td>
            <td class="py-2 px-4">${displayDate} (${parcelText})</td>
            <td class="py-2 px-4">${transaction.description}</td>
            <td class="py-2 px-4 ${valueClass}">${formattedValue}</td>
            <td class="py-2 px-4">${transaction.category}</td>
            <td class="py-2 px-4">${transaction.type === 'entrada' ? 'Entrada' : 'Saída'}</td>
            <td class="py-2 px-4">${recurrenceText}</td>
            <td class="py-2 px-4">${transaction.userName}</td>
            <td class="py-2 px-4">
                <button class="bg-blue-600 hover:bg-blue-700 text-white text-sm py-1 px-2 rounded-md edit-btn" data-id="${transaction.id}">Editar</button>
                <button class="bg-red-600 hover:bg-red-700 text-white text-sm py-1 px-2 rounded-md delete-btn" data-id="${transaction.id}">Excluir</button>
            </td>
        `;

        row.querySelector('.edit-btn').addEventListener('click', () => editTransaction(transaction.id));
        row.querySelector('.delete-btn').addEventListener('click', () => deleteTransaction(transaction.id));
    });
};

const editTransaction = async (id) => {
    // Implementar lógica de edição aqui (ex: abrir modal de edição)
    alert(`Funcionalidade de edição para ${id} será implementada.`);
};

const deleteTransaction = async (id) => {
    if (!confirm('Tem certeza que deseja excluir este lançamento?')) {
        return;
    }
    try {
        await db.collection('transactions').doc(id).delete();
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
    let daysInMonth = 0;

    if (selectedMonths.length === 1 && selectedYear && selectedYear !== 'all') {
        const month = selectedMonths[0];
        daysInMonth = new Date(parseInt(selectedYear), month, 0).getDate();
    } else if (selectedMonths.length === 0 && selectedYear && selectedYear !== 'all') {
        // Se nenhum mês selecionado, mas ano sim, considera todos os dias do ano
        daysInMonth = (new Date(parseInt(selectedYear) + 1, 0, 1) - new Date(parseInt(selectedYear), 0, 1)) / (1000 * 60 * 60 * 24);
    } else {
        // Caso de "todos os anos" ou múltiplos meses, média diária é mais complexa, pode ser 0 ou N/A
        daysInMonth = 0; // Ou calcular a diferença de dias entre a primeira e a última transação
    }


    transactionsForSummary.forEach(transaction => {
        if (transaction.type === 'entrada') {
            totalEntradas += transaction.value;
        } else {
            totalSaidas += transaction.value;
        }
    });

    const saldoMes = totalEntradas - totalSaidas;
    const mediaGastoDiario = daysInMonth > 0 ? (totalSaidas / daysInMonth) : 0;

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

filterYearSelect.addEventListener('change', loadTransactions);
filterDescriptionInput.addEventListener('input', loadTransactions);
monthsCheckboxesDiv.addEventListener('change', loadTransactions);
transactionForm.addEventListener('submit', addTransaction);

// Inicialização (será chamado por updateUIForAuthStatus se houver login)
// populateFilterYears();
// renderMonthCheckboxes();
