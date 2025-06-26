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

// Variáveis globais do ambiente Canvas (já fornecidas pelo ambiente).
// Usar 'default-app-id' e '{}' como fallbacks caso as variáveis não estejam definidas (o que acontece localmente).
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Variáveis globais para o Firebase
let app;
let db;
let auth;
let userId; // Será o UID do Firebase Auth ou um ID temporário
let lancamentosCollection;
let isAuthReady = false; // Indica se a autenticação Firebase foi inicializada
let currentHouseholdId; // ID do agregado familiar/grupo atual

// Mapeamento de meses para facilitar a exibição
const meses = {
    '01': 'Janeiro',
    '02': 'Fevereiro',
    '03': 'Março',
    '04': 'Abril',
    '05': 'Maio',
    '06': 'Junho',
    '07': 'Julho',
    '08': 'Agosto',
    '09': 'Setembro',
    '10': 'Outubro',
    '11': 'Novembro',
    '12': 'Dezembro'
};

// --- Elementos do DOM (inicializados em initializeUI) ---
let addGastoBtn, gastosTableBody, totalEntradas, totalSaidas, saldoMes, modalOverlay, messageBoxOverlay,
    messageBoxTitle, messageBoxMessage, messageBoxOkBtn, filterMonthSelect, filterYearSelect,
    currentMonthDisplay, currentYearDisplay, openAuthModalBtn, authModalOverlay, closeAuthModalBtn,
    loginSection, registerSection, emailLoginInput, passwordLoginInput, loginBtn, switchToRegisterBtn,
    emailRegisterInput, passwordRegisterInput, confirmPasswordRegisterInput, registerBtn,
    switchToLoginBtn, signInGoogleBtn, authStatusDisplay, userIdDisplay, joinHouseholdBtn,
    joinHouseholdIdInput, saveHouseholdIdBtn, leaveHouseholdBtn, resetPasswordModalOverlay,
    resetPasswordEmailInput, sendResetEmailBtn, closeResetPasswordModalBtn, forgotPasswordBtn,
    confirmActionModalOverlay, confirmActionMessage, confirmActionBtn, cancelActionBtn,
    stopRecurringModalOverlay, stopRecurringMessage, stopRecurringSelectDay, stopRecurringSelectMonth,
    stopRecurringSelectYear, confirmStopRecurringBtn, cancelStopRecurringBtn,
    editRecurringChoiceModalOverlay, editRecurringChoiceMessage, applyToThisBtn, applyToFutureBtn,
    cancelEditRecurringBtn, logoutBtn;


/**
 * Inicializa os elementos da UI após o DOM estar pronto.
 * Garante que todos os IDs estão corretamente mapeados.
 */
function initializeUI() {
    addGastoBtn = document.getElementById('addGastoBtn');
    gastosTableBody = document.getElementById('gastosTableBody');
    totalEntradas = document.getElementById('totalEntradas');
    totalSaidas = document.getElementById('totalSaidas');
    saldoMes = document.getElementById('saldoMes');
    modalOverlay = document.getElementById('modalOverlay');
    messageBoxOverlay = document.getElementById('messageBoxOverlay');
    messageBoxTitle = document.getElementById('messageBoxTitle');
    messageBoxMessage = document.getElementById('messageBoxMessage');
    messageBoxOkBtn = document.getElementById('messageBoxOkBtn');
    filterMonthSelect = document.getElementById('filterMonth');
    filterYearSelect = document.getElementById('filterYear');
    currentMonthDisplay = document.getElementById('currentMonthDisplay');
    currentYearDisplay = document.getElementById('currentYearDisplay');
    openAuthModalBtn = document.getElementById('openAuthModalBtn');
    authModalOverlay = document.getElementById('authModalOverlay');
    closeAuthModalBtn = document.getElementById('closeAuthModalBtn');
    loginSection = document.getElementById('loginSection');
    registerSection = document.getElementById('registerSection');
    emailLoginInput = document.getElementById('emailLoginInput');
    passwordLoginInput = document.getElementById('passwordLoginInput');
    loginBtn = document.getElementById('loginBtn');
    switchToRegisterBtn = document.getElementById('switchToRegisterBtn');
    emailRegisterInput = document.getElementById('emailRegisterInput');
    passwordRegisterInput = document.getElementById('passwordRegisterInput');
    confirmPasswordRegisterInput = document.getElementById('confirmPasswordRegisterInput');
    registerBtn = document.getElementById('registerBtn');
    switchToLoginBtn = document.getElementById('switchToLoginBtn');
    signInGoogleBtn = document.getElementById('signInGoogleBtn');
    authStatusDisplay = document.getElementById('auth-status-display');
    userIdDisplay = document.getElementById('user-id-display');
    joinHouseholdBtn = document.getElementById('joinHouseholdBtn');
    joinHouseholdIdInput = document.getElementById('joinHouseholdIdInput');
    saveHouseholdIdBtn = document.getElementById('saveHouseholdIdBtn');
    leaveHouseholdBtn = document.getElementById('leaveHouseholdBtn');
    resetPasswordModalOverlay = document.getElementById('reset-password-modal-overlay');
    resetPasswordEmailInput = document.getElementById('reset-password-email');
    sendResetEmailBtn = document.getElementById('send-reset-email-btn');
    closeResetPasswordModalBtn = document.getElementById('close-reset-password-modal-btn');
    forgotPasswordBtn = document.getElementById('forgot-password-btn');
    confirmActionModalOverlay = document.getElementById('confirmActionModalOverlay');
    confirmActionMessage = document.getElementById('confirmActionMessage');
    confirmActionBtn = document.getElementById('confirmActionBtn');
    cancelActionBtn = document.getElementById('cancelActionBtn');
    stopRecurringModalOverlay = document.getElementById('stopRecurringModalOverlay');
    stopRecurringMessage = document.getElementById('stopRecurringMessage');
    stopRecurringSelectDay = document.getElementById('stopRecurringSelectDay');
    stopRecurringSelectMonth = document.getElementById('stopRecurringSelectMonth');
    stopRecurringSelectYear = document.getElementById('stopRecurringSelectYear');
    confirmStopRecurringBtn = document.getElementById('confirmStopRecurringBtn');
    cancelStopRecurringBtn = document.getElementById('cancelStopRecurringBtn');
    editRecurringChoiceModalOverlay = document.getElementById('editRecurringChoiceModalOverlay');
    editRecurringChoiceMessage = document.getElementById('editRecurringChoiceMessage');
    applyToThisBtn = document.getElementById('applyToThisBtn');
    applyToFutureBtn = document.getElementById('applyToFutureBtn');
    cancelEditRecurringBtn = document.getElementById('cancelEditRecurringBtn');
    logoutBtn = document.getElementById('logoutBtn'); // Novo botão de logout

    // Adicionar listeners de eventos apenas se os elementos existirem
    if (addGastoBtn) addGastoBtn.addEventListener('click', addLancamento);
    if (messageBoxOkBtn) messageBoxOkBtn.addEventListener('click', closeMessageBox);
    if (filterMonthSelect) filterMonthSelect.addEventListener('change', setupFirestoreListener);
    if (filterYearSelect) filterYearSelect.addEventListener('change', setupFirestoreListener);

    if (openAuthModalBtn) openAuthModalBtn.addEventListener('click', openAuthModal);
    if (closeAuthModalBtn) closeAuthModalBtn.addEventListener('click', closeAuthModal);
    if (loginBtn) loginBtn.addEventListener('click', loginUser);
    if (switchToRegisterBtn) switchToRegisterBtn.addEventListener('click', () => switchAuthSection('register'));
    if (registerBtn) registerBtn.addEventListener('click', registerUser);
    if (switchToLoginBtn) switchToLoginBtn.addEventListener('click', () => switchAuthSection('login'));
    if (signInGoogleBtn) signInGoogleBtn.addEventListener('click', signInWithGoogle);
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout); // Listener para o novo botão de logout

    if (joinHouseholdBtn) joinHouseholdBtn.addEventListener('click', joinHousehold);
    if (saveHouseholdIdBtn) saveHouseholdIdBtn.addEventListener('click', saveHouseholdId);
    if (leaveHouseholdBtn) leaveHouseholdBtn.addEventListener('click', leaveHousehold);

    if (forgotPasswordBtn) forgotPasswordBtn.addEventListener('click', openResetPasswordModal);
    if (sendResetEmailBtn) sendResetEmailBtn.addEventListener('click', sendPasswordReset);
    if (closeResetPasswordModalBtn) closeResetPasswordModalBtn.addEventListener('click', closeResetPasswordModal);

    // Inicializa os seletores de mês e ano
    populateMonthAndYearFilters();
}


/**
 * Função para mostrar uma caixa de mensagem personalizada (substitui alert()).
 * @param {string} title - Título da mensagem.
 * @param {string} message - Conteúdo da mensagem.
 * @param {boolean} showCancel - Se deve mostrar um botão de cancelar (para confirmação).
 * @returns {Promise<boolean>} - Resolve com true se 'OK', false se 'Cancelar'.
 */
function showMessageBox(title, message, showCancel = false) {
    return new Promise(resolve => {
        // Verifica se os elementos da caixa de mensagem foram inicializados
        if (!messageBoxOverlay || !messageBoxTitle || !messageBoxMessage || !messageBoxOkBtn) {
            console.error("Erro: Elementos da caixa de mensagem não encontrados. Exibindo mensagem no console:", { title, message });
            // Fallback para console.log se os elementos da UI não estiverem prontos
            console.log(`[${title}]: ${message}`);
            resolve(false); // Considera como cancelado ou erro se não há UI
            return;
        }

        messageBoxTitle.textContent = title;
        messageBoxMessage.textContent = message;
        messageBoxOverlay.classList.remove('hidden');

        // Limpa listeners antigos para evitar múltiplas execuções
        const oldOkBtn = messageBoxOkBtn;
        const newOkBtn = oldOkBtn.cloneNode(true);
        oldOkBtn.parentNode.replaceChild(newOkBtn, oldOkBtn);
        messageBoxOkBtn = newOkBtn; // Atualiza a referência

        messageBoxOkBtn.onclick = () => {
            closeMessageBox();
            resolve(true);
        };

        if (showCancel) {
            let cancelButton = document.createElement('button');
            cancelButton.textContent = 'Cancelar';
            cancelButton.className = 'cancel-btn ml-4'; // Adicione classes Tailwind para estilo
            messageBoxOkBtn.parentNode.appendChild(cancelButton); // Adiciona ao lado do OK

            cancelButton.onclick = () => {
                closeMessageBox();
                resolve(false);
                cancelButton.remove(); // Remove o botão de cancelar após uso
            };
            messageBoxOkBtn.focus(); // Foca no OK para acessibilidade
        } else {
            messageBoxOkBtn.focus(); // Foca no OK para acessibilidade
        }
    });
}


/**
 * Fecha a caixa de mensagem.
 */
function closeMessageBox() {
    if (messageBoxOverlay) {
        messageBoxOverlay.classList.add('hidden');
        // Remove qualquer botão de cancelar que possa ter sido adicionado
        const cancelButton = messageBoxOverlay.querySelector('.cancel-btn');
        if (cancelButton) {
            cancelButton.remove();
        }
    }
}

/**
 * Abre o modal de autenticação.
 */
function openAuthModal() {
    if (authModalOverlay) {
        authModalOverlay.classList.remove('hidden');
        switchAuthSection('login'); // Abre por padrão na seção de login
    }
}

/**
 * Fecha o modal de autenticação.
 */
function closeAuthModal() {
    if (authModalOverlay) {
        authModalOverlay.classList.add('hidden');
    }
}

/**
 * Alterna entre as seções de login e registo no modal de autenticação.
 * @param {string} section - 'login' ou 'register'.
 */
function switchAuthSection(section) {
    if (loginSection && registerSection) {
        if (section === 'login') {
            loginSection.classList.remove('hidden');
            registerSection.classList.add('hidden');
        } else {
            loginSection.classList.remove('hidden');
            registerSection.classList.add('hidden');
        }
    }
}

/**
 * Função para lidar com o registo de utilizadores com email e palavra-passe.
 */
async function registerUser() {
    if (!auth || !emailRegisterInput || !passwordRegisterInput || !confirmPasswordRegisterInput) {
        showMessageBox("Erro", "Elementos de autenticação não encontrados ou Firebase não inicializado corretamente.");
        return;
    }

    const email = emailRegisterInput.value;
    const password = passwordRegisterInput.value;
    const confirmPassword = confirmPasswordRegisterInput.value;

    if (password !== confirmPassword) {
        showMessageBox("Erro de Registo", "As palavras-passe não correspondem.");
        return;
    }
    if (password.length < 6) {
        showMessageBox("Erro de Registo", "A palavra-passe deve ter pelo menos 6 caracteres.");
        return;
    }

    try {
        await createUserWithEmailAndPassword(auth, email, password);
        showMessageBox("Sucesso", "Conta criada com sucesso! Pode agora fazer login.");
        switchAuthSection('login');
    } catch (error) {
        console.error("Erro ao registar:", error);
        let errorMessage = "Erro ao registar. Por favor, tente novamente.";
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = "Este e-mail já está em uso.";
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = "Endereço de e-mail inválido.";
        }
        showMessageBox("Erro de Registo", errorMessage);
    }
}

/**
 * Função para lidar com o login de utilizadores com email e palavra-passe.
 */
async function loginUser() {
    if (!auth || !emailLoginInput || !passwordLoginInput) {
        showMessageBox("Erro", "Elementos de autenticação não encontrados ou Firebase não inicializado corretamente.");
        return;
    }

    const email = emailLoginInput.value;
    const password = passwordLoginInput.value;

    try {
        await signInWithEmailAndPassword(auth, email, password);
        showMessageBox("Sucesso", "Login realizado com sucesso!");
        closeAuthModal();
    } catch (error) {
        console.error("Erro ao fazer login:", error);
        let errorMessage = "Erro ao fazer login. Verifique as suas credenciais.";
        if (error.code === 'auth/invalid-credential') { // Novo código para credenciais inválidas
            errorMessage = "E-mail ou palavra-passe incorretos.";
        } else if (error.code === 'auth/user-disabled') {
            errorMessage = "Esta conta foi desativada.";
        }
        showMessageBox("Erro de Login", errorMessage);
    }
}

/**
 * Função para lidar com o login de utilizadores com Google.
 */
async function signInWithGoogle() {
    if (!auth) {
        showMessageBox("Erro", "Firebase não inicializado corretamente.");
        return;
    }
    const provider = new GoogleAuthProvider();
    try {
        await signInWithPopup(auth, provider);
        showMessageBox("Sucesso", "Login com Google realizado com sucesso!");
        closeAuthModal();
    } catch (error) {
        console.error("Erro ao fazer login com Google:", error);
        let errorMessage = "Erro ao fazer login com Google. Por favor, tente novamente.";
        if (error.code === 'auth/popup-closed-by-user') {
            errorMessage = "A janela de login do Google foi fechada.";
        } else if (error.code === 'auth/cancelled-popup-request') {
            errorMessage = "A solicitação de pop-up foi cancelada.";
        }
        showMessageBox("Erro de Login", errorMessage);
    }
}

/**
 * Função para lidar com o logout.
 */
async function handleLogout() {
    if (!auth) {
        showMessageBox("Erro", "Firebase não inicializado corretamente.");
        return;
    }
    try {
        await signOut(auth);
        showMessageBox("Sucesso", "Logout realizado com sucesso!");
        // O onAuthStateChanged lidará com a atualização da UI
    } catch (error) {
        console.error("Erro ao fazer logout:", error);
        showMessageBox("Erro", "Não foi possível fazer logout. Por favor, tente novamente.");
    }
}

/**
 * Abre o modal para redefinição de palavra-passe.
 */
function openResetPasswordModal() {
    if (resetPasswordModalOverlay) {
        resetPasswordModalOverlay.classList.remove('hidden');
        closeAuthModal(); // Fecha o modal de autenticação
    }
}

/**
 * Fecha o modal para redefinição de palavra-passe.
 */
function closeResetPasswordModal() {
    if (resetPasswordModalOverlay) {
        resetPasswordModalOverlay.classList.add('hidden');
    }
}

/**
 * Envia um email de redefinição de palavra-passe.
 */
async function sendPasswordReset() {
    if (!auth || !resetPasswordEmailInput) {
        showMessageBox("Erro", "Elementos não encontrados ou Firebase não inicializado.");
        return;
    }
    const email = resetPasswordEmailInput.value;
    if (!email) {
        showMessageBox("Atenção", "Por favor, insira o seu endereço de e-mail.");
        return;
    }

    try {
        await sendPasswordResetEmail(auth, email);
        showMessageBox("Sucesso", `Um link de redefinição de palavra-passe foi enviado para ${email}.`);
        closeResetPasswordModal();
    } catch (error) {
        console.error("Erro ao enviar email de redefinição:", error);
        let errorMessage = "Erro ao enviar e-mail de redefinição. Verifique o endereço.";
        if (error.code === 'auth/invalid-email') {
            errorMessage = "Endereço de e-mail inválido.";
        } else if (error.code === 'auth/user-not-found') {
            errorMessage = "Não existe conta para este e-mail.";
        }
        showMessageBox("Erro", errorMessage);
    }
}


/**
 * Adiciona um novo lançamento (gasto ou entrada) à base de dados.
 */
async function addLancamento() {
    if (!db || !lancamentosCollection) {
        showMessageBox("Erro", "Base de dados não inicializada. Por favor, tente novamente mais tarde.");
        return;
    }

    // Obter valores do formulário
    const diaInput = document.getElementById('dia');
    const mesSelect = document.getElementById('mes');
    const anoSelect = document.getElementById('ano');
    const descricaoInput = document.getElementById('descricao');
    const valorInput = document.getElementById('valor');
    const categoriaSelect = document.getElementById('categoria');
    const tipoEntradaRadio = document.getElementById('tipoEntrada');
    const tipoSaidaRadio = document.getElementById('tipoSaida');
    const recorrenteCheckbox = document.getElementById('recorrente');
    const parceladoCheckbox = document.getElementById('parcelado');
    const numParcelasInput = document.getElementById('numParcelas');

    const dia = diaInput.value;
    const mes = mesSelect.value;
    const ano = anoSelect.value;
    const descricao = descricaoInput.value.trim();
    const valor = parseFloat(valorInput.value);
    const categoria = categoriaSelect.value;
    const tipo = tipoEntradaRadio.checked ? 'entrada' : (tipoSaidaRadio.checked ? 'saida' : '');
    const recorrente = recorrenteCheckbox.checked;
    const parcelado = parceladoCheckbox.checked;
    const numParcelas = parcelado ? parseInt(numParcelasInput.value) : 1;

    // Validação básica
    if (!dia || !mes || !ano || !descricao || isNaN(valor) || valor <= 0 || !tipo) {
        showMessageBox("Erro de Validação", "Por favor, preencha todos os campos obrigatórios e garanta que o valor é válido.");
        return;
    }
    if (parcelado && (isNaN(numParcelas) || numParcelas <= 0)) {
        showMessageBox("Erro de Validação", "Por favor, insira um número válido de parcelas.");
        return;
    }

    const dataCompleta = `${ano}-${mes}-${dia}`; // Formato YYYY-MM-DD para fácil ordenação e manipulação

    try {
        // Adicionar um ou múltiplos documentos dependendo se é parcelado/recorrente
        if (recorrente) {
            // Lançamento recorrente é adicionado como um único item com flag 'recorrente'
            await addDoc(lancamentosCollection, {
                userId: userId,
                householdId: currentHouseholdId, // Adiciona o ID do agregado familiar
                data: dataCompleta,
                descricao: descricao,
                valor: valor,
                categoria: categoria,
                tipo: tipo,
                recorrente: true,
                parcelado: false,
                dataCriacao: new Date().toISOString(),
                // Adicione informações sobre quando a recorrência deve parar, se aplicável
                // Por exemplo: dataFimRecorrencia: 'YYYY-MM-DD'
            });
            showMessageBox("Sucesso", "Lançamento recorrente adicionado!");
        } else if (parcelado) {
            const valorPorParcela = valor / numParcelas;
            let dataParcela = new Date(ano, mes - 1, dia); // Mês é 0-indexed no Date

            for (let i = 0; i < numParcelas; i++) {
                // Formata a data para a parcela atual
                const parcelaAno = dataParcela.getFullYear();
                const parcelaMes = String(dataParcela.getMonth() + 1).padStart(2, '0');
                const parcelaDia = String(dataParcela.getDate()).padStart(2, '0');
                const dataParcelaFormatada = `${parcelaAno}-${parcelaMes}-${parcelaDia}`;

                await addDoc(lancamentosCollection, {
                    userId: userId,
                    householdId: currentHouseholdId, // Adiciona o ID do agregado familiar
                    data: dataParcelaFormatada,
                    descricao: `${descricao} (Parcela ${i + 1}/${numParcelas})`,
                    valor: valorPorParcela,
                    categoria: categoria,
                    tipo: tipo,
                    recorrente: false,
                    parcelado: true,
                    parcelaAtual: i + 1,
                    totalParcelas: numParcelas,
                    dataCriacao: new Date().toISOString(),
                });

                // Avança para o próximo mês para a próxima parcela
                dataParcela.setMonth(dataParcela.getMonth() + 1);
            }
            showMessageBox("Sucesso", `${numParcelas} parcelas adicionadas!`);
        } else {
            // Lançamento único
            await addDoc(lancamentosCollection, {
                userId: userId,
                householdId: currentHouseholdId, // Adiciona o ID do agregado familiar
                data: dataCompleta,
                descricao: descricao,
                valor: valor,
                categoria: categoria,
                tipo: tipo,
                recorrente: false,
                parcelado: false,
                dataCriacao: new Date().toISOString(),
            });
            showMessageBox("Sucesso", "Lançamento adicionado!");
        }

        // Limpar o formulário após adicionar
        descricaoInput.value = '';
        valorInput.value = '';
        document.getElementById('recorrente').checked = false;
        document.getElementById('parcelado').checked = false;
        toggleParcelasInput(); // Esconde o campo de parcelas
    } catch (e) {
        console.error("Erro ao adicionar documento: ", e);
        showMessageBox("Erro", `Não foi possível adicionar o lançamento: ${e.message}`);
    }
}


/**
 * Preenche os seletores de mês e ano com valores dinâmicos.
 */
function populateMonthAndYearFilters() {
    const today = new Date();
    const currentMonth = String(today.getMonth() + 1).padStart(2, '0'); // Mês atual (01-12)
    const currentYear = today.getFullYear();

    // Preencher meses
    if (filterMonthSelect) {
        filterMonthSelect.innerHTML = ''; // Limpar opções existentes
        for (const monthNum in meses) {
            const option = document.createElement('option');
            option.value = monthNum;
            option.textContent = meses[monthNum];
            if (monthNum === currentMonth) {
                option.selected = true; // Selecionar o mês atual
            }
            filterMonthSelect.appendChild(option);
        }
    }

    // Preencher anos (por exemplo, 5 anos para trás e 5 para a frente)
    if (filterYearSelect) {
        filterYearSelect.innerHTML = ''; // Limpar opções existentes
        const startYear = currentYear - 5;
        const endYear = currentYear + 5;
        for (let year = startYear; year <= endYear; year++) {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            if (year === currentYear) {
                option.selected = true; // Selecionar o ano atual
            }
            filterYearSelect.appendChild(option);
        }
    }

    // Atualizar exibição do mês e ano atuais
    if (currentMonthDisplay && currentYearDisplay) {
        currentMonthDisplay.textContent = meses[currentMonth];
        currentYearDisplay.textContent = currentYear;
    }
}

/**
 * Renderiza os lançamentos na tabela e atualiza os totais.
 * @param {Array<Object>} lancamentos - Array de objetos de lançamento do Firestore.
 */
function renderLancamentos(lancamentos) {
    if (!gastosTableBody || !totalEntradas || !totalSaidas || !saldoMes) {
        console.error("Elementos da tabela ou totais não encontrados.");
        return;
    }

    gastosTableBody.innerHTML = ''; // Limpa a tabela antes de renderizar
    let entradas = 0;
    let saidas = 0;

    lancamentos.forEach(docData => {
        const row = gastosTableBody.insertRow();

        const dataObj = new Date(docData.data + 'T00:00:00'); // Adiciona T00:00:00 para evitar problemas de fuso horário
        const formattedDate = dataObj.toLocaleDateString('pt-BR');

        row.insertCell(0).textContent = formattedDate;
        row.insertCell(1).textContent = docData.descricao;
        row.insertCell(2).textContent = docData.categoria;

        const valorCell = row.insertCell(3);
        valorCell.textContent = `R$ ${docData.valor.toFixed(2).replace('.', ',')}`;
        valorCell.classList.add(docData.tipo === 'entrada' ? 'text-income' : 'text-expense');

        const tipoCell = row.insertCell(4);
        tipoCell.textContent = docData.tipo === 'entrada' ? 'Entrada' : 'Saída';
        tipoCell.classList.add(docData.tipo === 'entrada' ? 'text-income' : 'text-expense');

        if (docData.tipo === 'entrada') {
            entradas += docData.valor;
        } else {
            saidas += docData.valor;
        }

        // Célula de Ações (Editar e Apagar)
        const actionsCell = row.insertCell(5);
        actionsCell.classList.add('flex', 'space-x-2');

        const editButton = document.createElement('button');
        editButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-indigo-600 hover:text-indigo-800">
            <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
            </svg>`;
        editButton.className = 'p-1 rounded-full hover:bg-gray-200';
        editButton.title = 'Editar';
        editButton.onclick = () => openEditModal(docData.id, docData);
        actionsCell.appendChild(editButton);


        const deleteButton = document.createElement('button');
        deleteButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-red-500 hover:text-red-700">
            <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.924a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m-1.022.165 1.104 12.852c.07.863.635 1.6 1.388 1.815l.349.117a3 3 0 0 0 2.923 0l.35-.117c.753-.215 1.319-.952 1.388-1.815L16.25 5.79m-4.99 0h.008v.008h-.008V5.79Zm.003 0a.75.75 0 1 1-.75-.75.75.7 0 0 1 .75.75ZM9 12.75h.008v.008H9v-.008Zm.003 0a.75.75 0 1 1-.75-.75.75.7 0 0 1 .75.75Zm.003 0a.75.75 0 1 1-.75-.75.75.7 0 0 1 .75.75Z" />
            </svg>`;
        deleteButton.className = 'p-1 rounded-full hover:bg-gray-200';
        deleteButton.title = 'Apagar';
        deleteButton.onclick = () => confirmAndDeleteLancamento(docData.id, docData.recorrente, docData.data);
        actionsCell.appendChild(deleteButton);
    });

    totalEntradas.textContent = `R$ ${entradas.toFixed(2).replace('.', ',')}`;
    totalSaidas.textContent = `R$ ${saidas.toFixed(2).replace('.', ',')}`;
    saldoMes.textContent = `R$ ${(entradas - saidas).toFixed(2).replace('.', ',')}`;
    saldoMes.classList.remove('text-income', 'text-expense');
    if ((entradas - saidas) >= 0) {
        saldoMes.classList.add('text-income');
    } else {
        saldoMes.classList.add('text-expense');
    }
}


/**
 * Abre o modal de edição e preenche-o com os dados do lançamento.
 * @param {string} docId - ID do documento a ser editado.
 * @param {Object} data - Dados do lançamento.
 */
function openEditModal(docId, data) {
    if (!modalOverlay) {
        console.error("Modal de edição não encontrado.");
        return;
    }
    modalOverlay.classList.remove('hidden');
    document.getElementById('editGastoBtn').onclick = () => saveEditedLancamento(docId, data.recorrente, data.parcelado);

    // Preencher o formulário com os dados existentes
    const dataObj = new Date(data.data + 'T00:00:00');
    document.getElementById('editDia').value = String(dataObj.getDate()).padStart(2, '0');
    document.getElementById('editMes').value = String(dataObj.getMonth() + 1).padStart(2, '0');
    document.getElementById('editAno').value = dataObj.getFullYear();
    document.getElementById('editDescricao').value = data.descricao;
    document.getElementById('editValor').value = data.valor.toFixed(2);
    document.getElementById('editCategoria').value = data.categoria;

    if (data.tipo === 'entrada') {
        document.getElementById('editTipoEntrada').checked = true;
    } else {
        document.getElementById('editTipoSaida').checked = true;
    }

    // Gerenciar campos recorrentes/parcelados no modal de edição
    document.getElementById('editRecorrente').checked = data.recorrente;
    document.getElementById('editParcelado').checked = data.parcelado;
    document.getElementById('editNumParcelas').value = data.totalParcelas || 1;
    toggleEditParcelasInput(); // Garante que o campo de parcelas está visível/oculto corretamente

    // Adicionar listeners para os checkboxes de edição
    document.getElementById('editRecorrente').onchange = toggleEditParcelasInput;
    document.getElementById('editParcelado').onchange = toggleEditParcelasInput;
}

/**
 * Fecha o modal de edição.
 */
function closeEditModal() {
    if (modalOverlay) {
        modalOverlay.classList.add('hidden');
    }
}

/**
 * Salva as edições de um lançamento na base de dados.
 * Lida com edição de lançamentos recorrentes/parcelados.
 * @param {string} docId - ID do documento original a ser editado.
 * @param {boolean} isRecurringOriginal - Se o lançamento original era recorrente.
 * @param {boolean} isParceladoOriginal - Se o lançamento original era parcelado.
 */
async function saveEditedLancamento(docId, isRecurringOriginal, isParceladoOriginal) {
    if (!db || !lancamentosCollection) {
        showMessageBox("Erro", "Base de dados não inicializada.");
        return;
    }

    const editDia = document.getElementById('editDia').value;
    const editMes = document.getElementById('editMes').value;
    const editAno = document.getElementById('editAno').value;
    const editDescricao = document.getElementById('editDescricao').value.trim();
    const editValor = parseFloat(document.getElementById('editValor').value);
    const editCategoria = document.getElementById('editCategoria').value;
    const editTipo = document.getElementById('editTipoEntrada').checked ? 'entrada' : 'saida';
    const editRecorrente = document.getElementById('editRecorrente').checked;
    const editParcelado = document.getElementById('editParcelado').checked;
    const editNumParcelas = editParcelado ? parseInt(document.getElementById('editNumParcelas').value) : 1;

    if (!editDia || !editMes || !editAno || !editDescricao || isNaN(editValor) || editValor <= 0 || !editTipo) {
        showMessageBox("Erro de Validação", "Por favor, preencha todos os campos e garanta que o valor é válido.");
        return;
    }
    if (editParcelado && (isNaN(editNumParcelas) || editNumParcelas <= 0)) {
        showMessageBox("Erro de Validação", "Por favor, insira um número válido de parcelas na edição.");
        return;
    }

    const dataCompletaEditada = `${editAno}-${editMes}-${editDia}`;

    // Lógica para lidar com edições de lançamentos recorrentes/parcelados
    if (isRecurringOriginal || isParceladoOriginal) {
        // Se era recorrente/parcelado, perguntar como aplicar a edição
        // No momento, apenas edita o lançamento selecionado.
        // A lógica de "Este e Futuros" ou "Apenas Este" pode ser implementada aqui.
        // Por simplificação, vamos tratar como "Apenas Este" por agora no Firestore.
        openEditRecurringChoiceModal(async (choice) => {
            closeEditRecurringChoiceModal(); // Fecha o modal de escolha

            try {
                if (choice === 'this') {
                    // Atualizar apenas o documento selecionado
                    const docRef = doc(db, lancamentosCollection.id, docId);
                    await setDoc(docRef, {
                        userId: userId,
                        householdId: currentHouseholdId,
                        data: dataCompletaEditada,
                        descricao: editDescricao,
                        valor: editValor,
                        categoria: editCategoria,
                        tipo: editTipo,
                        recorrente: editRecorrente,
                        parcelado: editParcelado,
                        totalParcelas: editParcelado ? editNumParcelas : null,
                        dataUltimaEdicao: new Date().toISOString()
                    }, { merge: true });
                    showMessageBox("Sucesso", "Lançamento editado com sucesso (apenas este)!");
                } else if (choice === 'future') {
                    // Lógica para aplicar a este e futuros (mais complexa para recorrência/parcelamento)
                    // Para parcelados: apagar futuras parcelas e recriar.
                    // Para recorrentes: editar este e garantir que novas futuras são criadas com a nova info.
                    // Por enquanto, vamos manter como "Apenas Este" para o exemplo.
                    showMessageBox("Funcionalidade em desenvolvimento", "A edição 'Este e Futuros' para lançamentos recorrentes/parcelados é uma funcionalidade avançada e está em desenvolvimento.");

                    const docRef = doc(db, lancamentosCollection.id, docId);
                    await setDoc(docRef, {
                        userId: userId,
                        householdId: currentHouseholdId,
                        data: dataCompletaEditada,
                        descricao: editDescricao,
                        valor: editValor,
                        categoria: editCategoria,
                        tipo: editTipo,
                        recorrente: editRecorrente,
                        parcelado: editParcelado,
                        totalParcelas: editParcelado ? editNumParcelas : null,
                        dataUltimaEdicao: new Date().toISOString()
                    }, { merge: true });
                    showMessageBox("Sucesso", "Lançamento editado com sucesso (apenas este, 'Este e Futuros' ainda em desenvolvimento)!");

                }
                closeEditModal();
            } catch (e) {
                console.error("Erro ao salvar edição: ", e);
                showMessageBox("Erro", `Não foi possível salvar a edição: ${e.message}`);
            }
        });
    } else {
        // Lançamento único: atualizar diretamente
        try {
            const docRef = doc(db, lancamentosCollection.id, docId);
            await setDoc(docRef, {
                userId: userId,
                householdId: currentHouseholdId,
                data: dataCompletaEditada,
                descricao: editDescricao,
                valor: editValor,
                categoria: editCategoria,
                tipo: editTipo,
                recorrente: editRecorrente,
                parcelado: editParcelado,
                totalParcelas: editParcelado ? editNumParcelas : null,
                dataUltimaEdicao: new Date().toISOString()
            }, { merge: true }); // Usar merge: true para não sobrescrever outros campos

            showMessageBox("Sucesso", "Lançamento editado com sucesso!");
            closeEditModal();
        } catch (e) {
            console.error("Erro ao salvar edição de documento único: ", e);
            showMessageBox("Erro", `Não foi possível salvar a edição: ${e.message}`);
        }
    }
}


/**
 * Abre o modal de escolha de edição para lançamentos recorrentes/parcelados.
 * @param {function} callback - Função a ser chamada com a escolha do utilizador ('this' ou 'future').
 */
function openEditRecurringChoiceModal(callback) {
    if (editRecurringChoiceModalOverlay && applyToThisBtn && applyToFutureBtn && cancelEditRecurringBtn) {
        editRecurringChoiceModalOverlay.classList.remove('hidden');

        // Limpa listeners antigos para evitar múltiplas execuções
        const oldApplyToThisBtn = applyToThisBtn;
        const newApplyToThisBtn = oldApplyToThisBtn.cloneNode(true);
        oldApplyToThisBtn.parentNode.replaceChild(newApplyToThisBtn, oldApplyToThisBtn);
        applyToThisBtn = newApplyToThisBtn;

        const oldApplyToFutureBtn = applyToFutureBtn;
        const newApplyToFutureBtn = oldApplyToFutureBtn.cloneNode(true);
        oldApplyToFutureBtn.parentNode.replaceChild(newApplyToFutureBtn, oldApplyToFutureBtn);
        applyToFutureBtn = newApplyToFutureBtn;

        const oldCancelEditRecurringBtn = cancelEditRecurringBtn;
        const newCancelEditRecurringBtn = oldCancelEditRecurringBtn.cloneNode(true);
        oldCancelEditRecurringBtn.parentNode.replaceChild(newCancelEditRecurringBtn, oldCancelEditRecurringBtn);
        cancelEditRecurringBtn = newCancelEditRecurringBtn;


        applyToThisBtn.onclick = () => callback('this');
        applyToFutureBtn.onclick = () => callback('future');
        cancelEditRecurringBtn.onclick = () => {
            closeEditRecurringChoiceModal();
            closeEditModal(); // Se cancelar a escolha, fecha também o modal de edição
        };
    } else {
        console.error("Elementos do modal de escolha de edição não encontrados.");
        closeEditModal(); // Fecha o modal de edição se o de escolha não puder ser aberto
    }
}

/**
 * Fecha o modal de escolha de edição.
 */
function closeEditRecurringChoiceModal() {
    if (editRecurringChoiceModalOverlay) {
        editRecurringChoiceModalOverlay.classList.add('hidden');
    }
}


/**
 * Abre o modal de confirmação para exclusão, com opção para parar recorrência.
 * @param {string} docId - ID do documento a ser excluído.
 * @param {boolean} isRecurring - Indica se o lançamento é recorrente.
 * @param {string} transactionDate - A data do lançamento a ser excluído (YYYY-MM-DD).
 */
async function confirmAndDeleteLancamento(docId, isRecurring, transactionDate) {
    if (isRecurring) {
        // Se for recorrente, abre o modal de "parar recorrência"
        if (stopRecurringModalOverlay && stopRecurringMessage) {
            stopRecurringMessage.textContent = `Este é um lançamento recorrente. Você deseja parar esta recorrência a partir de qual data?`;

            // Preenche os seletores de data no modal de parar recorrência
            populateStopRecurringDateFilters(transactionDate);

            stopRecurringModalOverlay.classList.remove('hidden');

            // Define os event listeners para os botões do modal de parar recorrência
            confirmStopRecurringBtn.onclick = async () => {
                const stopDay = stopRecurringSelectDay.value;
                const stopMonth = stopRecurringSelectMonth.value;
                const stopYear = stopRecurringSelectYear.value;
                const stopDate = `${stopYear}-${stopMonth}-${stopDay}`;

                // Confirma a ação com o utilizador
                const confirmed = await showMessageBox(
                    "Confirmar Paragem de Recorrência",
                    `Tem certeza que deseja parar o lançamento recorrente a partir de ${new Date(stopDate + 'T00:00:00').toLocaleDateString('pt-BR')}?`,
                    true
                );

                if (confirmed) {
                    await deleteRecurringLancamento(docId, stopDate);
                    closeStopRecurringModal();
                    showMessageBox("Sucesso", "Recorrência parada com sucesso!");
                }
            };
            cancelStopRecurringBtn.onclick = closeStopRecurringModal;
        } else {
            console.error("Elementos do modal de parar recorrência não encontrados.");
            // Fallback para exclusão direta se o modal não puder ser exibido
            confirmAndDeleteSingleLancamento(docId);
        }
    } else {
        // Se não for recorrente, apenas confirma a exclusão normal
        confirmAndDeleteSingleLancamento(docId);
    }
}


/**
 * Popula os seletores de dia, mês e ano no modal de parar recorrência.
 * @param {string} startDateString - Data inicial para preencher o dia (YYYY-MM-DD).
 */
function populateStopRecurringDateFilters(startDateString) {
    const today = startDateString ? new Date(startDateString + 'T00:00:00') : new Date(); // Usa a data da transação se fornecida
    const currentDay = today.getDate();
    const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
    const currentYear = today.getFullYear();

    // Preencher dias
    if (stopRecurringSelectDay) {
        stopRecurringSelectDay.innerHTML = '';
        for (let i = 1; i <= 31; i++) {
            const option = document.createElement('option');
            option.value = String(i).padStart(2, '0');
            option.textContent = String(i).padStart(2, '0');
            if (i === currentDay) {
                option.selected = true;
            }
            stopRecurringSelectDay.appendChild(option);
        }
    }

    // Preencher meses
    if (stopRecurringSelectMonth) {
        stopRecurringSelectMonth.innerHTML = '';
        for (const monthNum in meses) {
            const option = document.createElement('option');
            option.value = monthNum;
            option.textContent = meses[monthNum];
            if (monthNum === currentMonth) {
                option.selected = true;
            }
            stopRecurringSelectMonth.appendChild(option);
        }
    }

    // Preencher anos (atual e alguns para a frente/trás)
    if (stopRecurringSelectYear) {
        stopRecurringSelectYear.innerHTML = '';
        const startYear = currentYear - 2;
        const endYear = currentYear + 5;
        for (let year = startYear; year <= endYear; year++) {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            if (year === currentYear) {
                option.selected = true;
            }
            stopRecurringSelectYear.appendChild(option);
        }
    }
}


/**
 * Fecha o modal de parar recorrência.
 */
function closeStopRecurringModal() {
    if (stopRecurringModalOverlay) {
        stopRecurringModalOverlay.classList.add('hidden');
    }
}

/**
 * Confirma e exclui um único lançamento (ou o lançamento selecionado de uma recorrência).
 * @param {string} docId - ID do documento a ser excluído.
 */
async function confirmAndDeleteSingleLancamento(docId) {
    const confirmed = await showMessageBox("Confirmar Exclusão", "Tem certeza que deseja apagar este lançamento?", true);
    if (confirmed) {
        await deleteLancamento(docId);
        showMessageBox("Sucesso", "Lançamento apagado com sucesso!");
    }
}

/**
 * Exclui um lançamento do Firestore.
 * @param {string} docId - ID do documento a ser excluído.
 */
async function deleteLancamento(docId) {
    if (!db || !lancamentosCollection) {
        showMessageBox("Erro", "Base de dados não inicializada.");
        return;
    }
    try {
        await deleteDoc(doc(db, lancamentosCollection.id, docId));
        // A UI será atualizada automaticamente pelo onSnapshot
    } catch (e) {
        console.error("Erro ao apagar documento: ", e);
        showMessageBox("Erro", `Não foi possível apagar o lançamento: ${e.message}`);
    }
}

/**
 * Exclui um lançamento recorrente (ou seja, apaga o lançamento e impede futuras aparições).
 * Para lançamentos recorrentes, é preciso uma lógica mais complexa:
 * - Se for um lançamento recorrente "mestre", apaga o mestre.
 * - Se for uma instância de um lançamento recorrente, apaga a instância e marca o mestre para não gerar mais após a data.
 * Por enquanto, este exemplo irá apenas apagar a instância e não afetará a "recorrência mestre".
 * A lógica para parar a recorrência a partir de uma data específica envolveria:
 * 1. Marcar o lançamento original/mestre com uma 'dataFimRecorrencia'.
 * 2. Apagar todas as instâncias futuras deste lançamento a partir dessa data.
 * @param {string} docId - ID do documento recorrente a ser "parado".
 * @param {string} stopDate - Data a partir da qual a recorrência deve parar (YYYY-MM-DD).
 */
async function deleteRecurringLancamento(docId, stopDate) {
    if (!db || !lancamentosCollection) {
        showMessageBox("Erro", "Base de dados não inicializada.");
        return;
    }
    try {
        // Primeiro, apagar a instância específica que o utilizador clicou.
        await deleteDoc(doc(db, lancamentosCollection.id, docId));

        // Para parar a recorrência, seria necessário encontrar o "lançamento mestre" (se houver)
        // e atualizá-lo com uma data de fim de recorrência.
        // Como o modelo atual armazena cada "ocorrência" de um lançamento recorrente como um documento separado,
        // a "paragem" significa apagar todas as ocorrências futuras a partir de `stopDate`.

        const q = query(
            lancamentosCollection,
            where("householdId", "==", currentHouseholdId),
            where("recorrente", "==", true),
            // Adicionar mais filtros para identificar lançamentos do "mesmo grupo" se necessário
            // Por exemplo, uma `recurringGroupId` para agrupar todas as instâncias
            where("data", ">=", stopDate) // Apagar todos os futuros a partir da data de paragem
        );

        const querySnapshot = await getDocs(q);
        const batch = writeBatch(db); // Usar batch para exclusões múltiplas eficientes

        let countDeleted = 0;
        querySnapshot.forEach((docSnap) => {
            batch.delete(docSnap.ref);
            countDeleted++;
        });

        await batch.commit();
        showMessageBox("Sucesso", `Lançamento recorrente e ${countDeleted} instâncias futuras apagadas com sucesso!`);

    } catch (e) {
        console.error("Erro ao parar lançamento recorrente: ", e);
        showMessageBox("Erro", `Não foi possível parar o lançamento recorrente: ${e.message}`);
    }
}


/**
 * Alterna a visibilidade do campo de número de parcelas.
 */
function toggleParcelasInput() {
    const parceladoCheckbox = document.getElementById('parcelado');
    const numParcelasGroup = document.getElementById('numParcelasGroup');
    const recorrenteCheckbox = document.getElementById('recorrente');

    if (parceladoCheckbox && numParcelasGroup && recorrenteCheckbox) {
        if (parceladoCheckbox.checked) {
            numParcelasGroup.classList.remove('hidden');
            recorrenteCheckbox.checked = false; // Desseleciona recorrente se parcelado for selecionado
        } else {
            numParcelasGroup.classList.add('hidden');
        }
    }
}

/**
 * Alterna a visibilidade do campo de número de parcelas no modal de edição.
 */
function toggleEditParcelasInput() {
    const editParceladoCheckbox = document.getElementById('editParcelado');
    const editNumParcelasGroup = document.getElementById('editNumParcelasGroup');
    const editRecorrenteCheckbox = document.getElementById('editRecorrente');

    if (editParceladoCheckbox && editNumParcelasGroup && editRecorrenteCheckbox) {
        if (editParceladoCheckbox.checked) {
            editNumParcelasGroup.classList.remove('hidden');
            editRecorrenteCheckbox.checked = false; // Desseleciona recorrente se parcelado for selecionado
        } else {
            editNumParcelasGroup.classList.add('hidden');
        }
    }
}


/**
 * Adiciona listeners para os checkboxes de "recorrente" e "parcelado".
 * Garante que apenas um pode ser selecionado.
 */
function setupCheckboxListeners() {
    const recorrenteCheckbox = document.getElementById('recorrente');
    const parceladoCheckbox = document.getElementById('parcelado');
    const numParcelasGroup = document.getElementById('numParcelasGroup');

    if (recorrenteCheckbox) {
        recorrenteCheckbox.addEventListener('change', () => {
            if (recorrenteCheckbox.checked) {
                if (parceladoCheckbox) parceladoCheckbox.checked = false;
                if (numParcelasGroup) numParcelasGroup.classList.add('hidden');
            }
        });
    }

    if (parceladoCheckbox) {
        parceladoCheckbox.addEventListener('change', toggleParcelasInput); // Usa a função existente
    }

    // Configura listeners para os checkboxes de edição também
    const editRecorrenteCheckbox = document.getElementById('editRecorrente');
    const editParceladoCheckbox = document.getElementById('editParcelado');
    const editNumParcelasGroup = document.getElementById('editNumParcelasGroup');

    if (editRecorrenteCheckbox) {
        editRecorrenteCheckbox.addEventListener('change', () => {
            if (editRecorrenteCheckbox.checked) {
                if (editParceladoCheckbox) editParceladoCheckbox.checked = false;
                if (editNumParcelasGroup) editNumParcelasGroup.classList.add('hidden');
            }
        });
    }

    if (editParceladoCheckbox) {
        editParceladoCheckbox.addEventListener('change', toggleEditParcelasInput); // Usa a função existente
    }
}


/**
 * Configura o listener em tempo real do Firestore.
 * Filtra os lançamentos pelo ID do agregado familiar e pelo mês/ano selecionados.
 */
function setupFirestoreListener() {
    if (!db || !lancamentosCollection || !isAuthReady) {
        console.warn("Firestore não pronto ou utilizador não autenticado para configurar listener.");
        if (gastosTableBody) gastosTableBody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-gray-500">Aguardando autenticação ou configuração do Firebase...</td></tr>';
        if (totalEntradas) totalEntradas.textContent = 'R$ 0,00';
        if (totalSaidas) totalSaidas.textContent = 'R$ 0,00';
        if (saldoMes) saldoMes.textContent = 'R$ 0,00';
        return;
    }

    const selectedMonth = filterMonthSelect.value;
    const selectedYear = filterYearSelect.value;

    if (currentMonthDisplay && currentYearDisplay) {
        currentMonthDisplay.textContent = meses[selectedMonth];
        currentYearDisplay.textContent = selectedYear;
    }

    // Cria as datas de início e fim para o mês selecionado
    // Firestore queries with date ranges require the 'data' field to be indexed.
    // Ensure you have an index on 'data' in your Firestore console if you encounter errors.
    const startDate = `${selectedYear}-${selectedMonth}-01`;
    const endDate = `${selectedYear}-${selectedMonth}-${new Date(selectedYear, selectedMonth, 0).getDate()}`; // Último dia do mês

    // Cria a query para buscar os lançamentos
    // Filtra por householdId E por range de data para o mês selecionado
    const q = query(
        lancamentosCollection,
        where("householdId", "==", currentHouseholdId),
        where("data", ">=", startDate),
        where("data", "<=", endDate)
    );

    // Usa onSnapshot para escutar as mudanças em tempo real
    onSnapshot(q, (snapshot) => {
        const lancamentos = [];
        snapshot.forEach((doc) => {
            lancamentos.push({ id: doc.id, ...doc.data() });
        });
        // Ordena os lançamentos por data (do mais antigo para o mais recente)
        lancamentos.sort((a, b) => new Date(a.data) - new Date(b.data));
        renderLancamentos(lancamentos);
    }, (error) => {
        console.error("Erro ao buscar lançamentos: ", error);
        showMessageBox("Erro de Sincronização", `Não foi possível carregar os lançamentos: ${error.message}`);
    });
}

/**
 * Funções para gerenciamento do agregado familiar (Household ID).
 */

/**
 * Entra num agregado familiar existente usando um ID fornecido.
 */
function joinHousehold() {
    if (!joinHouseholdIdInput || !userId) {
        showMessageBox("Erro", "Elementos da UI ou ID de utilizador não disponíveis.");
        return;
    }
    const idToJoin = joinHouseholdIdInput.value.trim();
    if (idToJoin) {
        currentHouseholdId = idToJoin;
        localStorage.setItem('savedHouseholdId', currentHouseholdId);
        showMessageBox("Sucesso", `Entrou no agregado familiar: ${currentHouseholdId}`);
        closeAuthModal(); // Fecha o modal após entrar
        setupFirestoreListener(); // Atualiza os dados com o novo household ID
        if (userIdDisplay) userIdDisplay.textContent = `ID do Usuário: ${userId} | Agregado: ${currentHouseholdId}`;
    } else {
        showMessageBox("Erro", "Por favor, insira um ID de agregado familiar válido.");
    }
}

/**
 * Salva o ID do utilizador atual como o ID do agregado familiar.
 */
function saveHouseholdId() {
    if (!userId) {
        showMessageBox("Erro", "ID do utilizador não disponível.");
        return;
    }
    currentHouseholdId = userId;
    localStorage.setItem('savedHouseholdId', currentHouseholdId);
    showMessageBox("Sucesso", `Seu ID de utilizador (${userId}) foi definido como o ID do agregado familiar.`);
    closeAuthModal(); // Fecha o modal após salvar
    setupFirestoreListener(); // Atualiza os dados com o novo household ID
    if (userIdDisplay) userIdDisplay.textContent = `ID do Usuário: ${userId} | Agregado: ${currentHouseholdId}`;
    if (joinHouseholdIdInput) joinHouseholdIdInput.value = currentHouseholdId; // Preenche o input com o ID atual
}

/**
 * Sai do agregado familiar atual, voltando para o ID de utilizador padrão.
 */
function leaveHousehold() {
    if (!userId) {
        showMessageBox("Erro", "ID do utilizador não disponível.");
        return;
    }
    localStorage.removeItem('savedHouseholdId'); // Remove o ID guardado
    currentHouseholdId = userId; // Volta para o ID padrão do utilizador
    showMessageBox("Sucesso", "Saiu do agregado familiar. Agora a usar o seu ID pessoal.");
    closeAuthModal(); // Fecha o modal após sair
    setupFirestoreListener(); // Atualiza os dados com o ID pessoal
    if (userIdDisplay) userIdDisplay.textContent = `ID do Usuário: ${userId} | Agregado: ${currentHouseholdId}`;
    if (joinHouseholdIdInput) joinHouseholdIdInput.value = currentHouseholdId; // Preenche o input com o ID atual
}


// --- Lógica Principal de Inicialização ---
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Inicializa a UI primeiro para garantir que os elementos da caixa de mensagem estejam disponíveis
        initializeUI();

        // Inicializa o Firebase APENAS se a configuração não estiver vazia
        if (Object.keys(firebaseConfig).length > 0) {
            app = initializeApp(firebaseConfig);
            db = getFirestore(app);
            auth = getAuth(app);

            // Escuta as mudanças no estado de autenticação
            onAuthStateChanged(auth, async (user) => {
                if (user) {
                    userId = user.uid;
                    if (authStatusDisplay) authStatusDisplay.textContent = `Status: Autenticado (${user.email || 'Anónimo'})`;
                    if (openAuthModalBtn) openAuthModalBtn.textContent = 'Logout'; // Altera texto do botão
                    if (logoutBtn) logoutBtn.classList.remove('hidden'); // Mostra botão de logout
                } else {
                    // Se não houver utilizador autenticado, tenta usar o token inicial ou fazer login anónimo
                    if (initialAuthToken) {
                        try {
                            await signInWithCustomToken(auth, initialAuthToken);
                            userId = auth.currentUser.uid;
                            if (authStatusDisplay) authStatusDisplay.textContent = `Status: Autenticado (via Token)`;
                            if (openAuthModalBtn) openAuthModalBtn.textContent = 'Logout';
                            if (logoutBtn) logoutBtn.classList.remove('hidden');
                        } catch (error) {
                            console.error("Erro ao autenticar com token personalizado:", error);
                            // Fallback para anónimo se token falhar
                            await signInAnonymously(auth);
                            userId = auth.currentUser.uid; // ID anónimo
                            if (authStatusDisplay) authStatusDisplay.textContent = `Status: Anónimo (${userId})`;
                            if (openAuthModalBtn) openAuthModalBtn.textContent = 'Login / Registar';
                            if (logoutBtn) logoutBtn.classList.add('hidden'); // Esconde botão de logout
                            showMessageBox("Autenticação Necessária", `Não foi possível autenticar o utilizador com o token fornecido. Usando um ID temporário: ${userId}. Por favor, faça login.`);
                            openAuthModal(); // Abre a modal de autenticação para o utilizador fazer login
                        }
                    } else {
                        // Se não houver token inicial, faz login anónimo
                        await signInAnonymously(auth);
                        userId = auth.currentUser.uid; // ID anónimo
                        if (authStatusDisplay) authStatusDisplay.textContent = `Status: Anónimo (${userId})`;
                        if (openAuthModalBtn) openAuthModalBtn.textContent = 'Login / Registar';
                        if (logoutBtn) logoutBtn.classList.add('hidden');
                        showMessageBox("Autenticação Necessária", `Não foi possível autenticar o utilizador. Usando um ID temporário: ${userId}. Por favor, faça login.`);
                        openAuthModal(); // Abre a modal de autenticação para o utilizador fazer login
                    }
                }

                // Tenta carregar o ID do agregado familiar guardado
                const savedHouseholdId = localStorage.getItem('savedHouseholdId');
                if (savedHouseholdId) {
                    currentHouseholdId = savedHouseholdId;
                } else {
                    currentHouseholdId = userId; // Usa o UID do Firebase como ID padrão
                    localStorage.setItem('savedHouseholdId', currentHouseholdId);
                }

                // A UI já foi inicializada, agora apenas atualiza os textos dinâmicos
                if (userIdDisplay) userIdDisplay.textContent = `ID do Usuário: ${userId} | Agregado: ${currentHouseholdId}`;
                if (joinHouseholdIdInput) joinHouseholdIdInput.value = currentHouseholdId;

                // Define a coleção com base no appId injetado
                lancamentosCollection = collection(db, `artifacts/${appId}/public/data/lancamentos`);
                isAuthReady = true;

                setupFirestoreListener(); // Configura o listener do Firestore após autenticação
                setupCheckboxListeners(); // Configura listeners para os checkboxes de recorrência/parcelado

            });
        } else {
            // Se firebaseConfig estiver vazio (execução local fora do Canvas)
            console.warn("Firebase não inicializado: As configurações não foram encontradas. Funções de base de dados não funcionarão.");
            showMessageBox("Aviso", "As configurações do Firebase não foram encontradas. A aplicação está a ser executada em modo limitado. Para a funcionalidade completa da base de dados, execute no ambiente do Canvas.");
            
            // Define um userId e householdId temporários para que a UI carregue
            userId = 'temp-user-' + crypto.randomUUID();
            currentHouseholdId = userId; // Usa o ID temporário como householdId

            // A UI já foi inicializada, agora apenas atualiza os textos dinâmicos
            if (userIdDisplay) userIdDisplay.textContent = `ID do Usuário: ${userId} (Local)`;
            if (joinHouseholdIdInput) joinHouseholdIdInput.value = currentHouseholdId;
            if (authStatusDisplay) authStatusDisplay.textContent = `Status: Modo Local`;
            if (openAuthModalBtn) openAuthModalBtn.classList.add('hidden'); // Esconde o botão de login
            if (logoutBtn) logoutBtn.classList.add('hidden'); // Esconde o botão de logout
            
            // Renderiza a tabela vazia ou com uma mensagem indicando que não há dados
            if (gastosTableBody) gastosTableBody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-gray-500">Dados da base de dados não disponíveis em modo local.</td></tr>';
            if (totalEntradas) totalEntradas.textContent = 'R$ 0,00';
            if (totalSaidas) totalSaidas.textContent = 'R$ 0,00';
            if (saldoMes) saldoMes.textContent = 'R$ 0,00';
        }

    } catch (error) {
        console.error("Erro fatal ao inicializar aplicação:", error);
        const userIdDisplayFallback = document.getElementById('user-id-display');
        if (userIdDisplayFallback) userIdDisplayFallback.textContent = `Erro ao carregar ID do Usuário.`;
        // No caso de um erro fatal antes mesmo de initializeUI(), showMessageBox pode falhar.
        // Neste cenário, um console.error é mais robusto.
        console.error('Erro Crítico ao carregar a aplicação. Por favor, tente novamente mais tarde. Verifique o console do navegador para mais detalhes.');
    }
});
