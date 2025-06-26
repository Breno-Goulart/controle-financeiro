// firebase-config.js content integrado aqui
const firebaseConfig = {
    apiKey: "SUA_API_KEY", // Substitua pela sua chave
    authDomain: "controle-financeiro-c1a0b.firebaseapp.com",
    projectId: "controle-financeiro-c1a0b",
    storageBucket: "controle-financeiro-c1a0b.appspot.com",
    messagingSenderId: "SEU_MESSAGING_SENDER_ID", // Substitua pelo seu ID
    appId: "SEU_APP_ID" // Substitua pelo seu ID
};

// Inicialize o Firebase
firebase.initializeApp(firebaseConfig);

// Referências aos serviços do Firebase
const auth = firebase.auth();
const db = firebase.firestore();

// Referências aos elementos do DOM
const googleLoginBtn = document.getElementById('google-login-btn');
const emailSignupBtn = document.getElementById('email-signup-btn');
const emailLoginBtn = document.getElementById('email-login-btn');
const logoutBtn = document.getElementById('logout-btn');
const authButtons = document.getElementById('auth-buttons');
const userInfo = document.getElementById('user-info');
const userDisplay = document.getElementById('user-display');
const authForms = document.getElementById('auth-forms');
const authFormTitle = document.getElementById('auth-form-title');
const emailInput = document.getElementById('email-input');
const passwordInput = document.getElementById('password-input');
const submitAuthBtn = document.getElementById('submit-auth-btn');
const cancelAuthBtn = document.getElementById('cancel-auth-btn');
const transactionSection = document.getElementById('transaction-section');
const transactionDescriptionInput = document.getElementById('transaction-description');
const transactionAmountInput = document.getElementById('transaction-amount');
const transactionTypeSelect = document.getElementById('transaction-type');
const transactionDateInput = document.getElementById('transaction-date');
const installmentsSelect = document.getElementById('installments'); // Novo seletor de parcelas
const addTransactionBtn = document.getElementById('add-transaction-btn');
const transactionsList = document.getElementById('transactions-list');
const monthlySummaryDiv = document.getElementById('monthly-summary'); // Novo elemento para resumo mensal
const firebaseStatusDiv = document.getElementById('firebase-status'); // Novo elemento para status do Firebase

let currentUser = null;
let currentAuthMode = ''; // 'signup' ou 'login'

// --- Funções de Autenticação ---

// Provedor de autenticação Google
const googleProvider = new firebase.auth.GoogleAuthProvider();

// Login com Google
googleLoginBtn.addEventListener('click', async () => {
    try {
        await auth.signInWithPopup(googleProvider);
    } catch (error) {
        console.error("Erro no login com Google:", error);
        alert(`Erro no login com Google: ${error.message}`);
    }
});

// Exibir formulário de cadastro/login
emailSignupBtn.addEventListener('click', () => {
    authFormTitle.textContent = 'Cadastrar com E-mail';
    submitAuthBtn.textContent = 'Cadastrar';
    currentAuthMode = 'signup';
    authForms.classList.remove('hidden');
    authButtons.classList.add('hidden');
    transactionSection.classList.add('hidden');
});

emailLoginBtn.addEventListener('click', () => {
    authFormTitle.textContent = 'Login com E-mail';
    submitAuthBtn.textContent = 'Login';
    currentAuthMode = 'login';
    authForms.classList.remove('hidden');
    authButtons.classList.add('hidden');
    transactionSection.classList.add('hidden');
});

cancelAuthBtn.addEventListener('click', () => {
    authForms.classList.add('hidden');
    authButtons.classList.remove('hidden');
    // Se o usuário já estiver logado, mostre a seção de transações
    if (currentUser) {
        transactionSection.classList.remove('hidden');
    }
    emailInput.value = '';
    passwordInput.value = '';
});

submitAuthBtn.addEventListener('click', async () => {
    const email = emailInput.value;
    const password = passwordInput.value;

    if (!email || !password) {
        alert('Por favor, preencha e-mail e senha.');
        return;
    }

    try {
        if (currentAuthMode === 'signup') {
            await auth.createUserWithEmailAndPassword(email, password);
            alert('Cadastro realizado com sucesso!');
        } else {
            await auth.signInWithEmailAndPassword(email, password);
            alert('Login realizado com sucesso!');
        }
        authForms.classList.add('hidden');
        emailInput.value = '';
        passwordInput.value = '';
    } catch (error) {
        console.error(`Erro no ${currentAuthMode}:`, error);
        alert(`Erro no ${currentAuthMode}: ${error.message}`);
    }
});

// Logout
logoutBtn.addEventListener('click', async () => {
    try {
        await auth.signOut();
    } catch (error) {
        console.error("Erro ao sair:", error);
        alert(`Erro ao sair: ${error.message}`);
    }
});

// Observador de estado de autenticação
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        userDisplay.textContent = `Olá, ${user.displayName || user.email}!`;
        authButtons.classList.add('hidden');
        userInfo.classList.remove('hidden');
        transactionSection.classList.remove('hidden');
        loadTransactions(user.uid); // Carrega transações do usuário logado
    } else {
        currentUser = null;
        authButtons.classList.remove('hidden');
        userInfo.classList.add('hidden');
        transactionSection.classList.add('hidden');
        transactionsList.innerHTML = ''; // Limpa a lista de transações
        monthlySummaryDiv.textContent = ''; // Limpa o resumo mensal
        authForms.classList.add('hidden'); // Esconde formulários de auth se não logado
    }
});

// --- Funções de Transação ---

// Adicionar transação
addTransactionBtn.addEventListener('click', async () => {
    if (!currentUser) {
        alert('Você precisa estar logado para adicionar transações.');
        return;
    }

    const description = transactionDescriptionInput.value;
    const amount = parseFloat(transactionAmountInput.value);
    const type = transactionTypeSelect.value;
    const date = transactionDateInput.value;
    const installments = parseInt(installmentsSelect.value); // Pega o número de parcelas

    if (!description || isNaN(amount) || !date) {
        alert('Por favor, preencha todos os campos: Descrição, Valor e Data.');
        return;
    }

    try {
        const transactionRef = db.collection('users').doc(currentUser.uid).collection('transactions');

        // Lógica para parcelas
        for (let i = 0; i < installments; i++) {
            const transactionDate = new Date(date);
            transactionDate.setMonth(transactionDate.getMonth() + i); // Adiciona meses para cada parcela

            const newTransaction = {
                description: installments > 1 ? `${description} (${i + 1}/${installments})` : description,
                amount: amount,
                type: type,
                date: firebase.firestore.Timestamp.fromDate(transactionDate), // Salva como Timestamp
                installmentsTotal: installments, // Salva o total de parcelas
                installmentNumber: i + 1 // Salva o número da parcela atual
            };
            await transactionRef.add(newTransaction);
        }

        alert('Transação(ões) adicionada(s) com sucesso!');
        transactionDescriptionInput.value = '';
        transactionAmountInput.value = '';
        transactionDateInput.value = '';
        installmentsSelect.value = '1'; // Reseta o seletor de parcelas
        loadTransactions(currentUser.uid); // Recarrega a lista
    } catch (error) {
        console.error("Erro ao adicionar transação:", error);
        alert(`Erro ao adicionar transação: ${error.message}`);
    }
});


// Carregar transações
async function loadTransactions(uid) {
    transactionsList.innerHTML = ''; // Limpa a lista
    let totalIncome = 0;
    let totalExpense = 0;

    try {
        const snapshot = await db.collection('users').doc(uid).collection('transactions')
                                .orderBy('date', 'desc') // Ordena por data
                                .get();

        snapshot.forEach(doc => {
            const transaction = doc.data();
            const transactionId = doc.id;
            const amount = transaction.amount;
            const type = transaction.type;
            const date = transaction.date.toDate().toLocaleDateString('pt-BR'); // Converte Timestamp para data legível

            if (type === 'income') {
                totalIncome += amount;
            } else {
                totalExpense += amount;
            }

            const listItem = document.createElement('li');
            listItem.className = `transaction-item p-3 border-b border-gray-200 flex justify-between items-center ${type === 'income' ? 'text-green-600' : 'text-red-600'}`;
            listItem.innerHTML = `
                <div>
                    <span class="font-semibold">${transaction.description}</span> - R$ ${amount.toFixed(2)} (${date})
                    ${transaction.installmentsTotal > 1 ? ` <span class="text-gray-500 text-sm">(${transaction.installmentNumber}/${transaction.installmentsTotal})</span>` : ''}
                </div>
                <div class="transaction-actions">
                    <button class="edit-btn bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded" data-id="${transactionId}">Editar</button>
                    <button class="delete-btn bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded" data-id="${transactionId}">Excluir</button>
                </div>
            `;
            transactionsList.appendChild(listItem);
        });

        updateMonthlySummary(totalIncome, totalExpense);

    } catch (error) {
        console.error("Erro ao carregar transações:", error);
        alert(`Erro ao carregar transações: ${error.message}`);
    }
}

// Atualizar Resumo Mensal
function updateMonthlySummary(income, expense) {
    const balance = income - expense;
    monthlySummaryDiv.innerHTML = `
        Receitas: <span class="text-green-400">R$ ${income.toFixed(2)}</span> |
        Despesas: <span class="text-red-400">R$ ${expense.toFixed(2)}</span> |
        Saldo: <span class="${balance >= 0 ? 'text-green-400' : 'text-red-400'}">R$ ${balance.toFixed(2)}</span>
    `;
}

// Excluir transação
transactionsList.addEventListener('click', async (e) => {
    if (e.target.classList.contains('delete-btn')) {
        const transactionId = e.target.dataset.id;
        if (confirm('Tem certeza que deseja excluir esta transação?')) {
            try {
                await db.collection('users').doc(currentUser.uid).collection('transactions').doc(transactionId).delete();
                alert('Transação excluída com sucesso!');
                loadTransactions(currentUser.uid); // Recarrega a lista
            } catch (error) {
                console.error("Erro ao excluir transação:", error);
                alert(`Erro ao excluir transação: ${error.message}`);
            }
        }
    }
    // Lógica para editar transação (a ser implementada)
    if (e.target.classList.contains('edit-btn')) {
        const transactionId = e.target.dataset.id;
        alert(`Funcionalidade de edição para a transação ${transactionId} será implementada em breve!`);
        // Aqui você implementaria a lógica para carregar os dados da transação no formulário
        // e permitir a edição.
    }
});

// --- Validação de Chave ID do Firebase ---
// Esta função é chamada uma vez na inicialização
function checkFirebaseConnectionStatus() {
    try {
        // Se o Firebase foi inicializado com sucesso, esta linha não dará erro
        // e podemos considerar a conexão como estabelecida.
        firebase.app();
        firebaseStatusDiv.textContent = '✅ Conectado ao Firebase';
        firebaseStatusDiv.style.backgroundColor = 'rgba(16, 185, 129, 0.5)'; // green-500 com transparência
    } catch (error) {
        firebaseStatusDiv.textContent = '❌ Erro de Conexão Firebase';
        firebaseStatusDiv.style.backgroundColor = 'rgba(239, 68, 68, 0.5)'; // red-500 com transparência
        console.error("Erro ao verificar conexão Firebase:", error);
    }
}

// Chama a função de verificação de status quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', checkFirebaseConnectionStatus);

// Define a data atual como padrão para o input de data
document.addEventListener('DOMContentLoaded', () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    transactionDateInput.value = `${year}-${month}-${day}`;
});
