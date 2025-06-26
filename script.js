// Importa as funções necessárias do Firebase SDK (versões modulares padrão)
import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
    getAuth,
    signInAnonymously,
    signInWithCustomToken,
    onAuthStateChanged,
    createUserWithEmailAndPassword, // Adicionado para registo
    signInWithEmailAndPassword,     // Adicionado para login com email/senha
    sendPasswordResetEmail,         // Adicionado para redefinição de palavra-passe
    signOut,                        // Adicionado para logout
    GoogleAuthProvider,             // Adicionado para autenticação Google
    signInWithPopup                 // Adicionado para autenticação Google
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
    getDocs,
    writeBatch // Adicionado para operações em lote (batch)
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Variáveis de configuração do Firebase
// Para desenvolvimento local, use as suas credenciais diretamente.
// Se estiver em um ambiente que injeta __app_id ou __firebase_config,
// você pode manter a lógica anterior, mas para evitar ReferenceError localmente,
// é mais seguro usar a config diretamente.
const firebaseConfig = {
    apiKey: "AIzaSyD998NH9Vco8Yfk-7n3XgMjLW-LkQkAgLA",
    authDomain: "controle-financeiro-c1a0b.firebaseapp.com",
    projectId: "controle-financeiro-c1a0b",
    storageBucket: "controle-financeiro-c1a0b.firebaseapp.com", // Corrigido .firebase-storage.app para .firebaseapp.com (comum)
    messagingSenderId: "471645962387",
    appId: "1:471645962387:web:fd500fdeb62475596c0d66"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ... (Restante do seu código permanece o mesmo) ...

// REFERÊNCIAS DO DOM
const userIdDisplay = document.getElementById('user-id-display');
const authStatusDisplay = document.getElementById('auth-status-display');
const openAuthModalBtn = document.getElementById('openAuthModalBtn');
const logoutBtn = document.getElementById('logoutBtn');
const authModal = document.getElementById('authModal');
const closeAuthModal = document.getElementById('closeAuthModal');
const loginSection = document.getElementById('loginSection');
const registerSection = document.getElementById('registerSection');
const resetPasswordSection = document.getElementById('resetPasswordSection');
const emailLoginInput = document.getElementById('emailLoginInput');
const passwordLoginInput = document.getElementById('passwordLoginInput');
const loginBtn = document.getElementById('loginBtn');
const loginGoogleBtn = document.getElementById('loginGoogleBtn');
const switchToRegisterBtn = document.getElementById('switchToRegisterBtn');
const emailRegisterInput = document.getElementById('emailRegisterInput');
const passwordRegisterInput = document.getElementById('passwordRegisterInput');
const confirmPasswordRegisterInput = document.getElementById('confirmPasswordRegisterInput');
const registerBtn = document.getElementById('registerBtn');
const switchToLoginFromRegisterBtn = document.getElementById('switchToLoginFromRegisterBtn');
const forgotPasswordLink = document.getElementById('forgotPasswordLink');
const emailResetPasswordInput = document.getElementById('emailResetPasswordInput');
const resetPasswordBtn = document.getElementById('resetPasswordBtn');
const switchToLoginFromResetBtn = document.getElementById('switchToLoginFromResetBtn');
const authLoadingSpinner = document.getElementById('auth-loading-spinner');

const joinHouseholdIdInput = document.getElementById('joinHouseholdIdInput');
const joinHouseholdBtn = document.getElementById('joinHouseholdBtn');
const householdIdValue = document.getElementById('householdIdValue');

const dateInput = document.getElementById('date');
const monthInput = document.getElementById('month');
const yearInput = document.getElementById('year');
const descriptionInput = document.getElementById('description');
const valueInput = document.getElementById('value');
const categoryInput = document.getElementById('category');
const typeInput = document.getElementById('type');
const isInstallmentCheckbox = document.getElementById('is-installment');
const currentInstallmentInput = document.getElementById('current-installment');
const totalInstallmentsInput = document.getElementById('total-installments');
const addEntryButton = document.getElementById('addEntryButton');

const filterMonthSelect = document.getElementById('filterMonth');
const filterYearSelect = document.getElementById('filterYear');

const totalEntradas = document.getElementById('totalEntradas');
const totalSaidas = document.getElementById('totalSaidas');
const saldoMes = document.getElementById('saldoMes');
const gastosTableBody = document.getElementById('gastosTableBody');

const alertModal = document.getElementById('alertModal');
const alertMessage = document.getElementById('alertMessage');
const closeAlertModal = document.getElementById('closeAlertModal');
const okButton = document.getElementById('okButton');

// VARIÁVEIS DE ESTADO
let currentHouseholdId = localStorage.getItem('currentHouseholdId') || `temp-user-${Math.random().toString(36).substring(2, 15)}-${Math.random().toString(36).substring(2, 15)}`;
let currentUser = null; // Para armazenar o objeto de usuário do Firebase

// FUNÇÕES AUXILIARES
function showMessage(message, duration = 3000) {
    alertMessage.textContent = message;
    alertModal.style.display = 'flex'; // Use flex para centralizar

    // Fecha o modal ao clicar em OK ou no X
    closeAlertModal.onclick = () => alertModal.style.display = 'none';
    okButton.onclick = () => alertModal.style.display = 'none';

    // Fecha o modal se clicar fora dele
    window.onclick = (event) => {
        if (event.target == alertModal) {
            alertModal.style.display = 'none';
        }
    };

    // Opcional: fechar automaticamente após 'duration'
    if (duration > 0) {
        setTimeout(() => {
            alertModal.style.display = 'none';
        }, duration);
    }
}

function showLoading(show) {
    if (show) {
        authLoadingSpinner.classList.remove('hidden');
        loginBtn.disabled = true;
        registerBtn.disabled = true;
        resetPasswordBtn.disabled = true;
        loginGoogleBtn.disabled = true;
    } else {
        authLoadingSpinner.classList.add('hidden');
        loginBtn.disabled = false;
        registerBtn.disabled = false;
        resetPasswordBtn.disabled = false;
        loginGoogleBtn.disabled = false;
    }
}

function showAuthSection(section) {
    loginSection.classList.add('hidden');
    registerSection.classList.add('hidden');
    resetPasswordSection.classList.add('hidden');

    if (section === 'login') {
        loginSection.classList.remove('hidden');
    } else if (section === 'register') {
        registerSection.classList.remove('hidden');
    } else if (section === 'resetPassword') {
        resetPasswordSection.classList.remove('hidden');
    }
}

function updateUIForAuthState(user) {
    currentUser = user; // Atualiza a variável global do usuário

    if (user) {
        // Usuário logado
        userIdDisplay.textContent = `ID de Usuário: ${user.uid}`;
        authStatusDisplay.textContent = `Status: Conectado (${user.email || 'Anônimo'})`;
        openAuthModalBtn.classList.add('hidden'); // Esconde o botão de login
        logoutBtn.classList.remove('hidden'); // Mostra o botão de logout
        authModal.style.display = 'none'; // Fecha o modal de autenticação se estiver aberto

        // Verifica o Household/Grupo do usuário
        checkUserHousehold(user.uid);

    } else {
        // Usuário deslogado (ou modo local)
        userIdDisplay.textContent = `ID de Usuário: ${currentHouseholdId} (Local)`;
        authStatusDisplay.textContent = `Status: Modo Local`;
        openAuthModalBtn.classList.remove('hidden'); // Mostra o botão de login
        logoutBtn.classList.add('hidden'); // Esconde o botão de logout
        householdIdValue.textContent = currentHouseholdId; // Garante que o ID local seja exibido

        // Limpa a tabela e totais em modo local, pois não há dados do Firebase
        gastosTableBody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-gray-500">Dados da base de dados não disponíveis em modo local. Por favor, faça login.</td></tr>';
        totalEntradas.textContent = 'R$ 0,00';
        totalSaidas.textContent = 'R$ 0,00';
        saldoMes.textContent = 'R$ 0,00';
    }
}

async function checkUserHousehold(userId) {
    try {
        const userDocRef = doc(db, "users", userId);
        const userDocSnap = await getDocs(query(collection(db, "users"), where("userId", "==", userId)));

        if (!userDocSnap.empty) {
            const userData = userDocSnap.docs[0].data();
            currentHouseholdId = userData.householdId || userId; // Usa o ID existente ou cria um novo
            localStorage.setItem('currentHouseholdId', currentHouseholdId);
            householdIdValue.textContent = currentHouseholdId;
            showMessage(`Conectado ao grupo: ${currentHouseholdId}`, 2000);
        } else {
            // Se o usuário não tem um householdId, cria um com base no UID
            currentHouseholdId = userId;
            localStorage.setItem('currentHouseholdId', currentHouseholdId);
            await setDoc(userDocRef, {
                userId: userId,
                householdId: currentHouseholdId,
                createdAt: new Date()
            }, {
                merge: true
            });
            householdIdValue.textContent = currentHouseholdId;
            showMessage(`Novo grupo criado com ID: ${currentHouseholdId}`, 2000);
        }
        // Após definir o householdId, carrega os dados
        loadGastos();
    } catch (error) {
        console.error("Erro ao verificar/criar household para o usuário:", error);
        showMessage("Erro ao carregar configurações do grupo. Tente novamente.", 5000);
    }
}


// FUNÇÕES DE AUTENTICAÇÃO
async function handleLogin() {
    const email = emailLoginInput.value;
    const password = passwordLoginInput.value;
    if (!email || !password) {
        showMessage("Por favor, preencha todos os campos de login.");
        return;
    }
    showLoading(true);
    try {
        await signInWithEmailAndPassword(auth, email, password);
        showMessage("Login realizado com sucesso!", 2000);
        // onAuthStateChanged irá lidar com updateUIForAuthState
    } catch (error) {
        console.error("Erro no login:", error);
        let errorMessage = "Erro ao fazer login.";
        if (error.code === 'auth/user-not-found') {
            errorMessage = "Usuário não encontrado. Verifique seu e-mail ou registre-se.";
        } else if (error.code === 'auth/wrong-password') {
            errorMessage = "Senha incorreta.";
        } else if (error.code === 'auth/invalid-credential') {
            errorMessage = "Credenciais inválidas. Verifique seu e-mail e senha.";
        }
        showMessage(errorMessage, 5000);
    } finally {
        showLoading(false);
    }
}

async function handleGoogleLogin() {
    showLoading(true);
    try {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
        showMessage("Login com Google realizado com sucesso!", 2000);
    } catch (error) {
        console.error("Erro no login com Google:", error);
        let errorMessage = "Erro ao fazer login com Google.";
        if (error.code === 'auth/popup-closed-by-user') {
            errorMessage = "Login cancelado pelo usuário.";
        } else if (error.code === 'auth/cancelled-popup-request') {
            errorMessage = "Já existe uma janela pop-up aberta ou a solicitação foi cancelada.";
        }
        showMessage(errorMessage, 5000);
    } finally {
        showLoading(false);
    }
}


async function handleRegister() {
    const email = emailRegisterInput.value;
    const password = passwordRegisterInput.value;
    const confirmPassword = confirmPasswordRegisterInput.value;

    if (!email || !password || !confirmPassword) {
        showMessage("Por favor, preencha todos os campos de registro.");
        return;
    }
    if (password.length < 6) {
        showMessage("A senha deve ter pelo menos 6 caracteres.");
        return;
    }
    if (password !== confirmPassword) {
        showMessage("As senhas não coincidem.");
        return;
    }

    showLoading(true);
    try {
        await createUserWithEmailAndPassword(auth, email, password);
        showMessage("Registro realizado com sucesso! Você está logado.", 2000);
        // onAuthStateChanged irá lidar com updateUIForAuthState
    } catch (error) {
        console.error("Erro no registro:", error);
        let errorMessage = "Erro ao registrar.";
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = "Este e-mail já está em uso.";
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = "Endereço de e-mail inválido.";
        }
        showMessage(errorMessage, 5000);
    } finally {
        showLoading(false);
    }
}

async function handleResetPassword() {
    const email = emailResetPasswordInput.value;
    if (!email) {
        showMessage("Por favor, insira seu e-mail para redefinir a senha.");
        return;
    }
    showLoading(true);
    try {
        await sendPasswordResetEmail(auth, email);
        showMessage("Link de redefinição de senha enviado para o seu e-mail!", 5000);
        showAuthSection('login'); // Volta para a tela de login
    } catch (error) {
        console.error("Erro ao enviar link de redefinição:", error);
        let errorMessage = "Erro ao enviar link de redefinição.";
        if (error.code === 'auth/user-not-found') {
            errorMessage = "E-mail não registrado.";
        }
        showMessage(errorMessage, 5000);
    } finally {
        showLoading(false);
    }
}

async function handleLogout() {
    try {
        await signOut(auth);
        // A função onAuthStateChanged irá ser acionada e chamar updateUIForAuthState(null)
        showMessage("Logout realizado com sucesso!", 2000);
        // Ao deslogar, redefina o householdId para o modo local
        currentHouseholdId = `temp-user-${Math.random().toString(36).substring(2, 15)}-${Math.random().toString(36).substring(2, 15)}`;
        localStorage.setItem('currentHouseholdId', currentHouseholdId);
        householdIdValue.textContent = currentHouseholdId;
    } catch (error) {
        console.error("Erro ao fazer logout:", error);
        showMessage("Erro ao fazer logout. Tente novamente.", 5000);
    }
}

// FUNÇÕES DE DADOS (Firestore)
async function addGasto(gasto) {
    if (!currentUser) {
        showMessage("Por favor, faça login para adicionar lançamentos.", 3000);
        return;
    }
    if (!currentHouseholdId || currentHouseholdId.includes('temp-user')) {
        showMessage("Aguarde a configuração do ID do grupo ou faça login.", 3000);
        return;
    }
    try {
        await addDoc(collection(db, "gastos"), {
            ...gasto,
            userId: currentUser.uid,
            householdId: currentHouseholdId, // Adiciona o ID do grupo ao lançamento
            timestamp: new Date() // Adiciona um timestamp para ordenação
        });
        showMessage("Lançamento adicionado com sucesso!", 1500);
        clearForm();
    } catch (error) {
        console.error("Erro ao adicionar gasto:", error);
        showMessage("Erro ao adicionar lançamento. Tente novamente.", 5000);
    }
}

async function deleteGasto(id) {
    if (!currentUser) {
        showMessage("Por favor, faça login para excluir lançamentos.", 3000);
        return;
    }
    try {
        await deleteDoc(doc(db, "gastos", id));
        showMessage("Lançamento excluído com sucesso!", 1500);
    } catch (error) {
        console.error("Erro ao excluir gasto:", error);
        showMessage("Erro ao excluir lançamento. Tente novamente.", 5000);
    }
}

async function loadGastos() {
    if (!currentUser || !currentHouseholdId || currentHouseholdId.includes('temp-user')) {
        gastosTableBody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-gray-500">Faça login para ver seus lançamentos.</td></tr>';
        totalEntradas.textContent = 'R$ 0,00';
        totalSaidas.textContent = 'R$ 0,00';
        saldoMes.textContent = 'R$ 0,00';
        return;
    }

    const selectedMonth = filterMonthSelect.value;
    const selectedYear = filterYearSelect.value;

    let q = query(collection(db, "gastos"), where("householdId", "==", currentHouseholdId));

    if (selectedMonth !== 'all' && selectedYear !== 'all') {
        const startOfMonth = new Date(selectedYear, selectedMonth - 1, 1);
        const endOfMonth = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999);
        q = query(q,
            where("timestamp", ">=", startOfMonth),
            where("timestamp", "<=", endOfMonth)
        );
    } else if (selectedYear !== 'all') {
        const startOfYear = new Date(selectedYear, 0, 1);
        const endOfYear = new Date(selectedYear, 11, 31, 23, 59, 59, 999);
        q = query(q,
            where("timestamp", ">=", startOfYear),
            where("timestamp", "<=", endOfYear)
        );
    }

    onSnapshot(q, (snapshot) => {
        let gastos = [];
        let totalIncome = 0;
        let totalExpenses = 0;

        snapshot.forEach((doc) => {
            const data = doc.data();
            gastos.push({
                id: doc.id,
                ...data
            });

            const value = parseFloat(data.value);
            if (data.type === 'entrada') {
                totalIncome += value;
            } else if (data.type === 'saida') {
                totalExpenses += value;
            }
        });

        // Ordena os gastos por data (mais recente primeiro)
        gastos.sort((a, b) => b.timestamp.toDate() - a.timestamp.toDate());

        renderGastosTable(gastos);
        totalEntradas.textContent = `R$ ${totalIncome.toFixed(2).replace('.', ',')}`;
        totalSaidas.textContent = `R$ ${totalExpenses.toFixed(2).replace('.', ',')}`;
        saldoMes.textContent = `R$ ${(totalIncome - totalExpenses).toFixed(2).replace('.', ',')}`;
    }, (error) => {
        console.error("Erro ao carregar gastos:", error);
        showMessage("Erro ao carregar lançamentos. Tente recarregar a página.", 5000);
        gastosTableBody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-gray-500">Erro ao carregar dados.</td></tr>';
    });
}

async function handleJoinHousehold() {
    if (!currentUser) {
        showMessage("Por favor, faça login para gerenciar o ID do grupo.", 3000);
        return;
    }
    const newHouseholdId = joinHouseholdIdInput.value.trim();

    if (!newHouseholdId) {
        showMessage("Por favor, insira um ID de grupo.", 3000);
        return;
    }

    if (newHouseholdId === currentHouseholdId) {
        showMessage("Você já está conectado a este ID de grupo.", 2000);
        return;
    }

    showLoading(true);
    try {
        const userDocRef = doc(db, "users", currentUser.uid);
        // Atualiza o householdId do usuário no Firestore
        await setDoc(userDocRef, {
            householdId: newHouseholdId
        }, {
            merge: true
        });

        currentHouseholdId = newHouseholdId;
        localStorage.setItem('currentHouseholdId', currentHouseholdId);
        householdIdValue.textContent = currentHouseholdId;
        showMessage(`Conectado ao novo grupo: ${currentHouseholdId}!`, 2000);

        loadGastos();

    } catch (error) {
        console.error("Erro ao aderir/criar grupo:", error);
        showMessage("Erro ao aderir/criar grupo. Verifique o ID e tente novamente.", 5000);
    } finally {
        showLoading(false);
    }
}


// RENDERIZAÇÃO DA UI
function renderGastosTable(gastos) {
    gastosTableBody.innerHTML = '';
    if (gastos.length === 0) {
        gastosTableBody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-gray-500">Nenhum lançamento encontrado para o período selecionado.</td></tr>';
        return;
    }

    gastos.forEach((gasto) => {
        const row = document.createElement('tr');
        row.className = 'border-b border-gray-200 hover:bg-gray-50';
        const formattedDate = gasto.timestamp ? new Date(gasto.timestamp.toDate()).toLocaleDateString('pt-BR') : 'N/A';
        const formattedValue = `R$ ${parseFloat(gasto.value).toFixed(2).replace('.', ',')}`;
        const valueClass = gasto.type === 'entrada' ? 'text-income' : 'text-expense';

        row.innerHTML = `
            <td class="py-3 px-6 text-left whitespace-nowrap">${formattedDate}</td>
            <td class="py-3 px-6 text-left">${gasto.description}</td>
            <td class="py-3 px-6 text-left">${gasto.category}</td>
            <td class="py-3 px-6 text-right font-semibold ${valueClass}">${formattedValue}</td>
            <td class="py-3 px-6 text-center">
                <span class="py-1 px-3 rounded-full text-xs font-semibold ${gasto.type === 'entrada' ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}">
                    ${gasto.type === 'entrada' ? 'Entrada' : 'Saída'}
                </span>
            </td>
            <td class="py-3 px-6 text-center">
                <button data-id="${gasto.id}" class="delete-btn text-red-500 hover:text-red-700 font-bold py-1 px-2 rounded">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            </td>
        `;
        gastosTableBody.appendChild(row);
    });

    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const idToDelete = e.currentTarget.dataset.id;
            deleteGasto(idToDelete);
        });
    });
}

function clearForm() {
    dateInput.value = '';
    descriptionInput.value = '';
    valueInput.value = '';
    categoryInput.value = '';
    typeInput.value = 'entrada';
    isInstallmentCheckbox.checked = false;
    toggleInstallmentFields(); // Garante que os campos de parcela sejam desativados
}

function populateYearSelects() {
    const currentYear = new Date().getFullYear();
    const startYear = 2020; // Defina um ano de início razoável

    // Populate "Adicionar Novo Lançamento" Year Select
    yearInput.innerHTML = '<option value="">Selecione o Ano</option>';
    for (let year = currentYear; year >= startYear; year--) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearInput.appendChild(option);
    }
    yearInput.value = currentYear; // Seleciona o ano atual por padrão

    // Populate "Resumo de Lançamentos" Filter Year Select
    filterYearSelect.innerHTML = '<option value="all">Todos os Anos</option>';
    for (let year = currentYear; year >= startYear; year--) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        filterYearSelect.appendChild(option);
    }
    filterYearSelect.value = currentYear; // Seleciona o ano atual por padrão
}

function populateMonthSelects() {
    const months = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];
    const currentMonth = new Date().getMonth() + 1; // Mês atual (1-12)

    // Populate "Adicionar Novo Lançamento" Month Select
    monthInput.innerHTML = '<option value="">Selecione o Mês</option>';
    months.forEach((name, index) => {
        const option = document.createElement('option');
        option.value = index + 1;
        option.textContent = name;
        monthInput.appendChild(option);
    });
    monthInput.value = currentMonth; // Seleciona o mês atual por padrão

    // Populate "Resumo de Lançamentos" Filter Month Select
    filterMonthSelect.innerHTML = '<option value="all">Todos os Meses</option>';
    months.forEach((name, index) => {
        const option = document.createElement('option');
        option.value = index + 1;
        option.textContent = name;
        filterMonthSelect.appendChild(option); // Adicionado para garantir que o filtro de mês seja populado
    });
    filterMonthSelect.value = currentMonth; // Seleciona o mês atual por padrão
}

function toggleInstallmentFields() {
    const isDisabled = !isInstallmentCheckbox.checked;
    currentInstallmentInput.disabled = isDisabled;
    totalInstallmentsInput.disabled = isDisabled;

    if (isDisabled) {
        currentInstallmentInput.value = '';
        totalInstallmentsInput.value = '';
        currentInstallmentInput.classList.add('bg-gray-200', 'cursor-not-allowed');
        totalInstallmentsInput.classList.add('bg-gray-200', 'cursor-not-allowed');
    } else {
        currentInstallmentInput.classList.remove('bg-gray-200', 'cursor-not-allowed');
        totalInstallmentsInput.classList.remove('bg-gray-200', 'cursor-not-allowed');
        currentInstallmentInput.value = 1; // Default para 1ª parcela
        totalInstallmentsInput.value = 1; // Default para 1 parcela total
    }
}


// ESCUTADORES DE EVENTOS
document.addEventListener('DOMContentLoaded', () => {
    populateYearSelects();
    populateMonthSelects();
    toggleInstallmentFields(); // Define o estado inicial dos campos de parcela

    // Observa o estado de autenticação
    onAuthStateChanged(auth, (user) => {
        updateUIForAuthState(user);
    });

    // Eventos do Modal de Autenticação
    if (openAuthModalBtn) openAuthModalBtn.addEventListener('click', () => {
        authModal.style.display = 'flex';
        showAuthSection('login'); // Abre no login por padrão
    });
    if (closeAuthModal) closeAuthModal.addEventListener('click', () => authModal.style.display = 'none');
    window.addEventListener('click', (event) => {
        if (event.target == authModal) {
            authModal.style.display = 'none';
        }
    });

    // Eventos de troca de seção no modal
    if (switchToRegisterBtn) switchToRegisterBtn.addEventListener('click', () => showAuthSection('register'));
    if (switchToLoginFromRegisterBtn) switchToLoginFromRegisterBtn.addEventListener('click', () => showAuthSection('login'));
    if (forgotPasswordLink) forgotPasswordLink.addEventListener('click', () => showAuthSection('resetPassword'));
    if (switchToLoginFromResetBtn) switchToLoginFromResetBtn.addEventListener('click', () => showAuthSection('login'));


    // Eventos de autenticação
    if (loginBtn) loginBtn.addEventListener('click', handleLogin);
    if (loginGoogleBtn) loginGoogleBtn.addEventListener('click', handleGoogleLogin);
    if (registerBtn) registerBtn.addEventListener('click', handleRegister);
    if (resetPasswordBtn) resetPasswordBtn.addEventListener('click', handleResetPassword);
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);


    // Evento para gerenciar ID da Família
    if (joinHouseholdBtn) joinHouseholdBtn.addEventListener('click', handleJoinHousehold);

    // Evento para habilitar/desabilitar campos de parcela
    if (isInstallmentCheckbox) isInstallmentCheckbox.addEventListener('change', toggleInstallmentFields);

    // Evento de adicionar lançamento
    if (addEntryButton) addEntryButton.addEventListener('click', () => {
        const date = dateInput.value;
        const month = monthInput.value;
        const year = yearInput.value;
        const description = descriptionInput.value.trim();
        const value = parseFloat(valueInput.value);
        const category = categoryInput.value;
        const type = typeInput.value;
        const isInstallment = isInstallmentCheckbox.checked;
        const currentInstallment = isInstallment ? parseInt(currentInstallmentInput.value) : null;
        const totalInstallments = isInstallment ? parseInt(totalInstallmentsInput.value) : null;

        if (!date || !month || !year || !description || isNaN(value) || value <= 0 || !category || !type) {
            showMessage("Por favor, preencha todos os campos obrigatórios (Dia, Mês, Ano, Descrição, Valor, Categoria, Tipo).");
            return;
        }

        if (isInstallment) {
            if (isNaN(currentInstallment) || currentInstallment <= 0 || isNaN(totalInstallments) || totalInstallments <= 0) {
                showMessage("Para lançamentos parcelados, 'Parcela Atual' e 'Total de Parcelas' devem ser números válidos maiores que zero.");
                return;
            }
            if (currentInstallment > totalInstallments) {
                showMessage("'Parcela Atual' não pode ser maior que 'Total de Parcelas'.");
                return;
            }
        }

        const newGasto = {
            date,
            month: parseInt(month),
            year: parseInt(year),
            description,
            value,
            category,
            type,
            isInstallment,
            currentInstallment,
            totalInstallments
        };

        addGasto(newGasto);
    });

    // Eventos dos filtros de mês e ano
    if (filterMonthSelect) filterMonthSelect.addEventListener('change', loadGastos);
    if (filterYearSelect) filterYearSelect.addEventListener('change', loadGastos);

});


// Inicialização da UI (para o caso de não haver usuário logado inicialmente)
// Isso será atualizado pelo onAuthStateChanged logo que o Firebase carregar o estado de autenticação.
function initializeUI() {
    // Isso será sobreposto por onAuthStateChanged, mas garante um estado inicial.
    // O valor inicial de `currentHouseholdId` é definido no topo do script.
    const storedHouseholdId = localStorage.getItem('currentHouseholdId');
    if (storedHouseholdId) {
        currentHouseholdId = storedHouseholdId;
    } else {
        // Se não houver ID no localStorage, gera um novo temporário
        currentHouseholdId = `temp-user-${Math.random().toString(36).substring(2, 15)}-${Math.random().toString(36).substring(2, 15)}`;
        localStorage.setItem('currentHouseholdId', currentHouseholdId);
    }

    if (householdIdValue) householdIdValue.textContent = currentHouseholdId;
    if (userIdDisplay) userIdDisplay.textContent = `ID de Usuário: ${currentHouseholdId} (Local)`;
    if (joinHouseholdIdInput) joinHouseholdIdInput.value = currentHouseholdId;
    if (authStatusDisplay) authStatusDisplay.textContent = `Status: Modo Local`;
    if (openAuthModalBtn) openAuthModalBtn.classList.remove('hidden'); // Garante que o botão de login esteja visível
    if (logoutBtn) logoutBtn.classList.add('hidden'); // Esconde o botão de logout

    // Renderiza a tabela vazia ou com uma mensagem indicando que não há dados
    if (gastosTableBody) gastosTableBody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-gray-500">Dados da base de dados não disponíveis em modo local.</td></tr>';
    if (totalEntradas) totalEntradas.textContent = 'R$ 0,00';
    if (totalSaidas) totalSaidas.textContent = 'R$ 0,00';
    if (saldoMes) saldoMes.textContent = 'R$ 0,00';
}

// Chame initializeUI() uma vez no final para garantir que os elementos DOM estejam disponíveis.
// No entanto, onAuthStateChanged é o principal driver de atualização.
initializeUI(); // Mantenha esta chamada para garantir que a UI seja inicializada.