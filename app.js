// js/app.js

// Importações (assumindo que firebase-config.js já exportou auth, db e googleProvider globalmente)
// Se você estiver usando módulos ES6 em um ambiente de construção, importaria assim:
// import { auth, db, googleProvider } from './firebase-config.js';

// --- Elementos HTML ---
const authModal = document.getElementById('auth-modal');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const showRegisterLink = document.getElementById('show-register');
const showLoginLink = document.getElementById('show-login');
const forgotPasswordLink = document.getElementById('forgot-password-link');
const googleLoginBtn = document.getElementById('google-login-btn');
const logoutButton = document.getElementById('logout-button');
const loggedUserName = document.getElementById('logged-user-name');
const dashboard = document.getElementById('dashboard');

const transactionForm = document.getElementById('transaction-form');
const transactionKeyInput = document.getElementById('transaction-key');
const transactionDateInput = document.getElementById('transaction-date');
const transactionDescriptionInput = document.getElementById('transaction-description');
const transactionValueInput = document.getElementById('transaction-value');
const transactionCategorySelect = document.getElementById('transaction-category');
const transactionTypeSelect = document.getElementById('transaction-type');
const transactionCurrentParcelInput = document.getElementById('transaction-current-parcel');
const transactionTotalParcelsInput = document.getElementById('transaction-total-parcels');
const transactionRecurringCheckbox = document.getElementById('transaction-recurring');
const transactionsTableBody = document.getElementById('transactions-table-body');

const filterYearSelect = document.getElementById('filter-year');
const monthsCheckboxesContainer = document.querySelector('.months-checkboxes');
const filterDescriptionInput = document.getElementById('filter-description');

const totalEntradasSpan = document.getElementById('total-entradas');
const totalSaidasSpan = document.getElementById('total-saidas');
const mediaGastoDiarioSpan = document.getElementById('media-gasto-diario');
const saldoMesSpan = document.getElementById('saldo-mes');

let currentUser = null; // Variável global para armazenar o usuário logado
let currentSelectedMonths = []; // Meses selecionados no filtro

// --- Funções de Utilitários ---
const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
};

const getMonthName = (monthIndex) => {
    const months = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];
    return months[monthIndex];
};

const showModal = (modalElement) => {
    modalElement.classList.add('flex');
    modalElement.classList.remove('hidden');
};

const hideModal = (modalElement) => {
    modalElement.classList.add('hidden');
    modalElement.classList.remove('flex');
};

const validateForm = (form) => {
    const inputs = form.querySelectorAll('[required]');
    let isValid = true;
    inputs.forEach(input => {
        if (!input.value.trim()) {
            input.reportValidity();
            isValid = false;
        }
    });
    // Validação adicional para valor numérico
    if (parseFloat(transactionValueInput.value) <= 0) {
        alert('O valor do lançamento deve ser maior que zero.');
        transactionValueInput.focus();
        isValid = false;
    }
    return isValid;
};

// --- Autenticação (Firebase Auth) ---

// Listener para o estado de autenticação
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        loggedUserName.textContent = `Olá, ${user.displayName || user.email}`;
        logoutButton.classList.remove('hidden');
        dashboard.classList.remove('hidden');
        hideModal(authModal);
        initializeDashboard(user.uid); // Inicializa o dashboard com o UID do usuário
    } else {
        currentUser = null;
        loggedUserName.textContent = '';
        logoutButton.classList.add('hidden');
        dashboard.classList.add('hidden');
        showModal(authModal);
        // Reseta os formulários de autenticação
        loginForm.reset();
        registerForm.reset();
        loginForm.style.display = 'flex'; // Tailwind controla hidden/flex
        registerForm.style.display = 'none';
    }
});

// Login com E-mail e Senha
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = loginForm['login-email'].value;
    const password = loginForm['login-password'].value;

    try {
        await auth.signInWithEmailAndPassword(email, password);
        // alert('Login realizado com sucesso!'); // Feedback via onAuthStateChanged
    } catch (error) {
        console.error("Erro no login:", error);
        alert(`Erro ao fazer login: ${error.message}`);
    }
});

// Cadastro de novos usuários
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = registerForm['register-name'].value;
    const email = registerForm['register-email'].value;
    const password = registerForm['register-password'].value;

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        await userCredential.user.updateProfile({ displayName: name });
        // alert('Cadastro realizado com sucesso! Você já está logado.'); // Feedback via onAuthStateChanged
    } catch (error) {
        console.error("Erro no cadastro:", error);
        alert(`Erro ao cadastrar: ${error.message}`);
    }
});

// Recuperação de senha
forgotPasswordLink.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = loginForm['login-email'].value;
    if (email) {
        try {
            await auth.sendPasswordResetEmail(email);
            alert('Um e-mail de redefinição de senha foi enviado para seu endereço.');
        } catch (error) {
            console.error("Erro ao enviar e-mail de redefinição:", error);
            alert(`Erro ao redefinir senha: ${error.message}`);
        }
    } else {
        alert('Por favor, digite seu e-mail no campo de login para redefinir a senha.');
    }
});

// Login com Google
googleLoginBtn.addEventListener('click', async () => {
    try {
        await auth.signInWithPopup(googleProvider);
        // alert('Login com Google realizado com sucesso!'); // Feedback via onAuthStateChanged
    } catch (error) {
        console.error("Erro no login com Google:", error);
        alert(`Erro ao fazer login com Google: ${error.message}`);
    }
});

// Logout
logoutButton.addEventListener('click', async () => {
    try {
        await auth.signOut();
        // alert('Deslogado com sucesso!'); // Feedback via onAuthStateChanged
    } catch (error) {
        console.error("Erro ao fazer logout:", error);
        alert(`Erro ao fazer logout: ${error.message}`);
    }
});

// Alternar entre login e cadastro
showRegisterLink.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.style.display = 'none';
    registerForm.style.display = 'flex';
});

showLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    registerForm.style.display = 'none';
    loginForm.style.display = 'flex';
});

// --- Lançamentos (Firestore) ---

// Adicionar novo lançamento
transactionForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const editingId = submitBtn.dataset.editingId;

    if (!validateForm(transactionForm)) {
        return;
    }

    if (!currentUser) {
        alert('Você precisa estar logado para adicionar lançamentos.');
        return;
    }

    const originalDateObj = new Date(transactionDateInput.value + 'T00:00:00'); // Garante fuso horário
    const transactionBase = {
        keyId: transactionKeyInput.value.trim(),
        originalDate: transactionDateInput.value, // YYYY-MM-DD
        originalYear: originalDateObj.getFullYear(), // Novo campo
        originalMonth: originalDateObj.getMonth(),   // Novo campo (0-11)
        description: transactionDescriptionInput.value.trim(),
        value: parseFloat(transactionValueInput.value),
        category: transactionCategorySelect.value,
        type: transactionTypeSelect.value, // 'entrada' ou 'saida'
        currentParcel: parseInt(transactionCurrentParcelInput.value),
        totalParcels: parseInt(transactionTotalParcelsInput.value),
        isRecurring: transactionRecurringCheckbox.checked,
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email,
    };

    try {
        if (editingId) { // Modo de edição
            const originalDocSnapshot = await db.collection('transactions').doc(editingId).get();
            const originalDocData = originalDocSnapshot.data();

            // Atualiza o lançamento original
            await db.collection('transactions').doc(editingId).update({
                ...transactionBase,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            alert('Lançamento original atualizado com sucesso!');

            // Se era recorrente e mudou para não recorrente, ou vice-versa
            if (originalDocData.isRecurring && !transactionBase.isRecurring) {
                // Remove todas as instâncias futuras se parou de ser recorrente
                const batch = db.batch();
                const recurringInstancesSnapshot = await db.collection('transactions')
                    .where('originalDocId', '==', editingId)
                    .where('isRecurringInstance', '==', true)
                    .get();
                recurringInstancesSnapshot.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
                console.log('Instâncias recorrentes futuras removidas.');
            } else if (!originalDocData.isRecurring && transactionBase.isRecurring) {
                // Se era não recorrente e se tornou recorrente, cria novas instâncias
                await createRecurringInstances(editingId, transactionBase);
                console.log('Novas instâncias recorrentes criadas.');
            } else if (originalDocData.isRecurring && transactionBase.isRecurring) {
                // Se continua recorrente, atualiza ou recria as instâncias futuras
                await updateRecurringInstances(editingId, transactionBase);
                console.log('Instâncias recorrentes futuras atualizadas.');
            }

            delete submitBtn.dataset.editingId;
            submitBtn.textContent = 'Adicionar Lançamento';

        } else { // Modo de adição
            const newDocRef = await db.collection('transactions').add({
                ...transactionBase,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                displayDate: transactionBase.originalDate, // Data de exibição inicial é a original
                displayYear: transactionBase.originalYear, // Ano de exibição inicial
                displayMonth: transactionBase.originalMonth, // Mês de exibição inicial
            });
            alert('Lançamento adicionado com sucesso!');

            if (transactionBase.isRecurring) {
                await createRecurringInstances(newDocRef.id, transactionBase);
                alert('Lançamento recorrente e suas instâncias futuras adicionados!');
            }
        }

        transactionForm.reset();
        fetchTransactions(); // Atualiza a tabela e o resumo
    } catch (error) {
        console.error("Erro ao adicionar/atualizar lançamento:", error);
        alert(`Erro: ${error.message}`);
    }
});


// Função para criar instâncias recorrentes
const createRecurringInstances = async (originalDocId, originalTransaction) => {
    const batch = db.batch();
    const originalDateObj = new Date(originalTransaction.originalDate + 'T00:00:00'); // Garante fuso horário

    for (let i = 1; i <= 12; i++) { // Replicar para os próximos 12 meses (ajustável)
        const futureDate = new Date(originalDateObj);
        futureDate.setMonth(originalDateObj.getMonth() + i);

        const recurringTransaction = {
            ...originalTransaction,
            originalDocId: originalDocId, // Referência ao documento original
            displayDate: futureDate.toISOString().split('T')[0], // Data para exibição (futura)
            displayYear: futureDate.getFullYear(), // Novo campo
            displayMonth: futureDate.getMonth(),   // Novo campo (0-11)
            isRecurringInstance: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp() // Timestamp de criação da instância
        };
        // Remove campos que não devem ser replicados para instâncias (se houver, ex: currentParcel/totalParcels se só valerem para o original)
        // delete recurringTransaction.currentParcel;
        // delete recurringTransaction.totalParcels;

        const newDocRef = db.collection('transactions').doc(); // Cria um novo doc ID
        batch.set(newDocRef, recurringTransaction);
    }
    await batch.commit();
};

// Função para atualizar instâncias recorrentes existentes
const updateRecurringInstances = async (originalDocId, updatedOriginalTransaction) => {
    const batch = db.batch();
    const recurringInstancesSnapshot = await db.collection('transactions')
        .where('originalDocId', '==', originalDocId)
        .where('isRecurringInstance', '==', true)
        .get();

    if (recurringInstancesSnapshot.empty) {
        // Se não houver instâncias, mas o original é recorrente, cria novas.
        // Isso pode acontecer se todas foram deletadas manualmente ou se o original foi editado antes da criação.
        await createRecurringInstances(originalDocId, updatedOriginalTransaction);
        return;
    }

    const originalDateObj = new Date(updatedOriginalTransaction.originalDate + 'T00:00:00');

    // Mapeia as instâncias existentes por sua data de exibição para facilitar a comparação
    const existingInstancesMap = new Map();
    recurringInstancesSnapshot.forEach(doc => {
        existingInstancesMap.set(doc.data().displayDate, { id: doc.id, data: doc.data() });
    });

    // Gera as "novas" instâncias recorrentes com base no original atualizado
    const futureInstancesToGenerate = [];
    for (let i = 1; i <= 12; i++) { // Replicar para os próximos 12 meses
        const futureDate = new Date(originalDateObj);
        futureDate.setMonth(originalDateObj.getMonth() + i);
        futureInstancesToGenerate.push({
            displayDate: futureDate.toISOString().split('T')[0],
            displayYear: futureDate.getFullYear(),
            displayMonth: futureDate.getMonth(),
            // ... outros campos que podem ser atualizados das instâncias
            description: updatedOriginalTransaction.description,
            value: updatedOriginalTransaction.value,
            category: updatedOriginalTransaction.category,
            type: updatedOriginalTransaction.type,
            keyId: updatedOriginalTransaction.keyId,
        });
    }

    // Processa atualizações e exclusões
    existingInstancesMap.forEach((instance, displayDateString) => {
        const found = futureInstancesToGenerate.find(f => f.displayDate === displayDateString);
        if (found) {
            // Se a instância ainda deve existir, atualiza
            batch.update(db.collection('transactions').doc(instance.id), {
                ...found, // Campos atualizados da recorrência
                originalDate: updatedOriginalTransaction.originalDate, // Garante que a data original permaneça a mesma
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            // Remove do array de futuros para saber quais precisam ser adicionados
            futureInstancesToGenerate.splice(futureInstancesToGenerate.indexOf(found), 1);
        } else {
            // Se a instância existente não está mais na lista de futuros (ex: período de recorrência alterado ou parou)
            batch.delete(db.collection('transactions').doc(instance.id));
        }
    });

    // Adiciona quaisquer novas instâncias que não existiam (se o período de recorrência se estendeu)
    futureInstancesToGenerate.forEach(newInstData => {
        const newDocRef = db.collection('transactions').doc();
        batch.set(newDocRef, {
            ...updatedOriginalTransaction, // Copia dados base do original
            originalDocId: originalDocId,
            displayDate: newInstData.displayDate,
            displayYear: newInstData.displayYear,
            displayMonth: newInstData.displayMonth,
            isRecurringInstance: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            // Sobrescreve campos que devem ser atualizados pelas novasInstData
            description: newInstData.description,
            value: newInstData.value,
            category: newInstData.category,
            type: newInstData.type,
            keyId: newInstData.keyId,
        });
    });

    await batch.commit();
};


// Fetch e Exibição de Lançamentos
const fetchTransactions = async () => {
    if (!currentUser) return;

    transactionsTableBody.innerHTML = '<tr><td colspan="9" class="text-center py-4">Carregando lançamentos...</td></tr>';

    let transactionsRef = db.collection('transactions').where('userId', '==', currentUser.uid);

    // Filtrar por ano e mês usando os novos campos do Firestore
    const selectedYear = parseInt(filterYearSelect.value);
    
    // As consultas de Firestore com operadores de comparação (<, <=, >, >=)
    // só podem usar uma range query em um único campo.
    // Para filtrar por ano E mês eficientemente, o ideal é usar queries separadas
    // ou combinar os campos em um formato que permita uma única range query (e.g., 'YYYYMM').
    // Por simplicidade e eficiência com múltiplos meses, faremos:
    // 1. Filtrar pelo ano no Firestore.
    // 2. Filtrar pelos meses no cliente (se houver múltiplos meses selecionados).
    // Para filtro de um único mês, seria possível adicionar um .where('displayMonth', '==', monthIndex).

    if (selectedYear) {
        // Busca todos os lançamentos do ano selecionado.
        transactionsRef = transactionsRef.where('displayYear', '==', selectedYear);
    }
    // Sempre ordenar pela displayDate para garantir a ordem cronológica
    transactionsRef = transactionsRef.orderBy('displayDate', 'asc');

    try {
        const snapshot = await transactionsRef.get();
        let transactions = [];
        snapshot.forEach(doc => {
            transactions.push({ id: doc.id, ...doc.data() });
        });

        // Filtrar por meses e descrição no cliente, após a busca por ano
        const filteredTransactions = transactions.filter(t => {
            const displayDateMonth = t.displayMonth; // Já é 0-11 do Firestore

            const matchesMonth = currentSelectedMonths.length === 0 ||
                                 currentSelectedMonths.includes(displayDateMonth);

            const matchesDescription = filterDescriptionInput.value.trim() === '' ||
                                       t.description.toLowerCase().includes(filterDescriptionInput.value.trim().toLowerCase());

            return matchesMonth && matchesDescription;
        });

        displayTransactions(filteredTransactions);
        updateSummary(filteredTransactions, selectedYear, currentSelectedMonths);

    } catch (error) {
        console.error("Erro ao buscar lançamentos:", error);
        transactionsTableBody.innerHTML = '<tr><td colspan="9" class="text-center py-4 text-red-500">Erro ao carregar lançamentos.</td></tr>';
    }
};


const displayTransactions = (transactions) => {
    transactionsTableBody.innerHTML = ''; // Limpa a tabela

    if (transactions.length === 0) {
        transactionsTableBody.innerHTML = '<tr><td colspan="9" class="text-center py-4">Nenhum lançamento encontrado.</td></tr>';
        return;
    }

    transactions.forEach(transaction => {
        const row = transactionsTableBody.insertRow();
        row.dataset.id = transaction.id; // Salva o ID do documento na linha para futuras ações
        row.classList.add('border-b', 'border-gray-700', 'hover:bg-gray-800', 'transition-colors', 'duration-200');

        const originalDate = new Date(transaction.originalDate + 'T00:00:00');
        const displayDate = new Date((transaction.displayDate || transaction.originalDate) + 'T00:00:00');

        const typeClass = transaction.type === 'entrada' ? 'text-income' : 'text-expense';

        // Usando data-label para responsividade da tabela
        row.innerHTML = `
            <td data-label="Data Original" class="py-3 px-4 text-sm">${originalDate.toLocaleDateString('pt-BR')}</td>
            <td data-label="Data Exibição" class="py-3 px-4 text-sm">${displayDate.toLocaleDateString('pt-BR')}</td>
            <td data-label="Descrição" class="py-3 px-4 text-sm">${transaction.description}</td>
            <td data-label="Valor" class="py-3 px-4 text-sm font-semibold ${typeClass}">${formatCurrency(transaction.value)}</td>
            <td data-label="Categoria" class="py-3 px-4 text-sm">${transaction.category}</td>
            <td data-label="Tipo" class="py-3 px-4 text-sm ${typeClass}">${transaction.type === 'entrada' ? 'Entrada' : 'Saída'}</td>
            <td data-label="Recorrência" class="py-3 px-4 text-sm">${transaction.isRecurring || transaction.isRecurringInstance ? 'Sim' : 'Não'}</td>
            <td data-label="Usuário" class="py-3 px-4 text-sm">${transaction.userName}</td>
            <td data-label="Ações" class="py-3 px-4 text-sm action-buttons">
                <button class="delete-btn text-red-500 hover:text-red-700 mr-2" data-id="${transaction.id}" title="Excluir">🗑️</button>
                ${transaction.isRecurringInstance ? `<button class="stop-recurring-btn text-yellow-500 hover:text-yellow-700" data-original-id="${transaction.originalDocId}" data-id="${transaction.id}" title="Parar Recorrência">🛑</button>` : ''}
            </td>
        `;
    });
};

// --- Ações na Tabela (Excluir, Editar, Parar Recorrência) ---
transactionsTableBody.addEventListener('click', async (e) => {
    if (e.target.classList.contains('delete-btn')) {
        const id = e.target.dataset.id;
        if (confirm('Tem certeza que deseja excluir este lançamento? Isso também removerá suas instâncias recorrentes futuras se for o lançamento original.')) {
            try {
                const docToDelete = await db.collection('transactions').doc(id).get();
                if (docToDelete.exists) {
                    const data = docToDelete.data();
                    if (data.isRecurring && !data.isRecurringInstance) { // É o lançamento original e recorrente
                        const batch = db.batch();
                        batch.delete(db.collection('transactions').doc(id)); // Deleta o original
                        // Deleta todas as instâncias recorrentes futuras vinculadas a este original
                        const recurringInstancesSnapshot = await db.collection('transactions')
                            .where('originalDocId', '==', id)
                            .where('isRecurringInstance', '==', true)
                            .get();
                        recurringInstancesSnapshot.forEach(doc => batch.delete(doc.ref));
                        await batch.commit();
                        alert('Lançamento recorrente e suas instâncias futuras excluídos com sucesso!');
                    } else { // Não é recorrente original ou é uma instância
                        await db.collection('transactions').doc(id).delete();
                        alert('Lançamento excluído com sucesso!');
                    }
                }
                fetchTransactions(); // Atualiza a tabela
            } catch (error) {
                console.error("Erro ao excluir lançamento:", error);
                alert(`Erro ao excluir lançamento: ${error.message}`);
            }
        }
    }

    if (e.target.classList.contains('stop-recurring-btn')) {
        const originalDocId = e.target.dataset.originalId;
        const currentInstanceId = e.target.dataset.id;
        stopRecurringPrompt(originalDocId, currentInstanceId);
    }
});

// Editar Lançamento (ao duplo clique)
transactionsTableBody.addEventListener('dblclick', async (e) => {
    const row = e.target.closest('tr');
    if (!row) return;

    const id = row.dataset.id;
    try {
        const doc = await db.collection('transactions').doc(id).get();
        if (!doc.exists) {
            alert('Lançamento não encontrado para edição.');
            return;
        }
        const data = doc.data();

        // Preenche o formulário com os dados do lançamento para edição
        transactionKeyInput.value = data.keyId;
        transactionDateInput.value = data.originalDate;
        transactionDescriptionInput.value = data.description;
        transactionValueInput.value = data.value;
        transactionCategorySelect.value = data.category;
        transactionTypeSelect.value = data.type;
        transactionCurrentParcelInput.value = data.currentParcel || 1;
        transactionTotalParcelsInput.value = data.totalParcels || 1;
        transactionRecurringCheckbox.checked = data.isRecurring || false;

        // Mudar o botão para "Atualizar Lançamento"
        const submitBtn = transactionForm.querySelector('button[type="submit"]');
        submitBtn.textContent = 'Atualizar Lançamento';
        submitBtn.dataset.editingId = id; // Guarda o ID para a atualização

    } catch (error) {
        console.error("Erro ao buscar lançamento para edição:", error);
        alert(`Erro ao carregar lançamento para edição: ${error.message}`);
    }
});


const stopRecurringPrompt = async (originalDocId, currentInstanceId) => {
    const originalTransactionSnapshot = await db.collection('transactions').doc(originalDocId).get();
    if (!originalTransactionSnapshot.exists) {
        alert("Lançamento original não encontrado.");
        return;
    }

    const recurringInstancesSnapshot = await db.collection('transactions')
        .where('originalDocId', '==', originalDocId)
        .where('isRecurringInstance', '==', true)
        .orderBy('displayDate', 'asc')
        .get();

    const recurringInstances = [];
    recurringInstancesSnapshot.forEach(doc => {
        recurringInstances.push({ id: doc.id, data: doc.data() });
    });

    if (recurringInstances.length === 0) {
        alert("Nenhuma instância recorrente futura encontrada para este lançamento.");
        return;
    }

    const currentIndex = recurringInstances.findIndex(inst => inst.id === currentInstanceId);
    if (currentIndex === -1) {
        alert("Instância atual não encontrada na lista de recorrências.");
        return;
    }

    let promptMessage = "Deseja parar a recorrência a partir de qual mês?\n\n";
    promptMessage += "1. Parar do mês atual (" + getMonthName(recurringInstances[currentIndex].data.displayMonth) + "/" + recurringInstances[currentIndex].data.displayYear + ") para frente\n";
    
    // Opções de meses específicos a partir do próximo mês em diante
    recurringInstances.slice(currentIndex + 1).forEach((inst, index) => {
        promptMessage += `${index + 2}. A partir de ${getMonthName(inst.data.displayMonth)}/${inst.data.displayYear}\n`;
    });

    const choice = prompt(promptMessage + "\nDigite o número da sua escolha ou 0 para cancelar.");

    if (choice === null || choice === '0') {
        return; // Usuário cancelou
    }

    const choiceNum = parseInt(choice);
    let instancesToDelete = [];

    if (choiceNum === 1) {
        // "Parar do mês atual para frente"
        instancesToDelete = recurringInstances.slice(currentIndex);
    } else if (choiceNum > 1 && choiceNum <= recurringInstances.length - currentIndex) {
        // Selecionar meses específicos a partir do próximo mês em diante
        instancesToDelete = recurringInstances.slice(currentIndex + (choiceNum - 1));
    } else {
        alert("Opção inválida. Por favor, tente novamente.");
        return;
    }

    if (confirm(`Confirma a exclusão de ${instancesToDelete.length} lançamentos recorrentes?`)) {
        const batch = db.batch();
        instancesToDelete.forEach(inst => {
            batch.delete(db.collection('transactions').doc(inst.id));
        });

        // Verifica se a instância original que gerou a recorrência (se for o caso) foi marcada como não recorrente
        // Isso é feito apenas se o 'originalDocId' for nulo (ou seja, é o lançamento pai)
        // ou se todas as recorrências forem excluídas e este for o original.
        // Se a instância que foi clicada é a última recorrência, o lançamento original *não* se torna não recorrente
        // pois ele representa a primeira ocorrência.
        
        try {
            await batch.commit();
            alert("Recorrências futuras excluídas com sucesso!");
            fetchTransactions();
        } catch (error) {
            console.error("Erro ao parar recorrência:", error);
            alert(`Erro ao parar recorrência: ${error.message}`);
        }
    }
};


// --- Resumo Mensal e Filtros ---

// Gerar filtros de anos dinamicamente
const populateYearFilter = async () => {
    if (!currentUser) return;

    try {
        const snapshot = await db.collection('transactions')
                                  .where('userId', '==', currentUser.uid)
                                  .orderBy('displayYear', 'desc')
                                  .get();
        const years = new Set();
        const currentYear = new Date().getFullYear();

        snapshot.forEach(doc => {
            const data = doc.data();
            years.add(data.displayYear); // Considera o ano de exibição
        });

        // Adiciona o ano atual e alguns anos futuros/passados padrão se não houver dados
        years.add(currentYear);
        for (let i = 1; i <= 2; i++) {
            years.add(currentYear + i);
            years.add(currentYear - i);
        }

        const sortedYears = Array.from(years).sort((a, b) => b - a); // Ordem decrescente

        filterYearSelect.innerHTML = '';
        sortedYears.forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            filterYearSelect.appendChild(option);
        });

        // Seleciona o ano atual por padrão, ou o mais recente se não houver do ano atual
        filterYearSelect.value = currentYear;
        if (!sortedYears.includes(currentYear)) {
            filterYearSelect.value = sortedYears[0] || currentYear;
        }

    } catch (error) {
        console.error("Erro ao popular anos:", error);
    }
};

// Gerar checkboxes de meses
const populateMonthCheckboxes = () => {
    monthsCheckboxesContainer.innerHTML = '';
    const months = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    const currentYear = new Date().getFullYear();
    const selectedFilterYear = parseInt(filterYearSelect.value);
    const currentMonth = new Date().getMonth();

    months.forEach((month, index) => {
        const div = document.createElement('div');
        div.classList.add('flex', 'items-center', 'space-x-2');

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = `month-checkbox-${index}`;
        input.value = index; // Mês como 0-11
        input.classList.add('month-filter-checkbox', 'form-checkbox', 'h-4', 'w-4', 'text-primary', 'rounded', 'border-gray-700', 'bg-dark-bg', 'focus:ring-primary');

        // Lógica para marcar o mês atual por padrão, mas somente se o ano selecionado for o ano atual
        if (selectedFilterYear === currentYear && currentSelectedMonths.length === 0 && index === currentMonth) {
            input.checked = true;
            currentSelectedMonths.push(index);
        } else if (currentSelectedMonths.includes(index)) {
            input.checked = true;
        }

        const label = document.createElement('label');
        label.htmlFor = `month-checkbox-${index}`;
        label.textContent = month;
        label.classList.add('text-sm');

        div.appendChild(input);
        div.appendChild(label);
        monthsCheckboxesContainer.appendChild(div);
    });
};

// Listener para filtros
filterYearSelect.addEventListener('change', () => {
    // Ao mudar o ano, limpa os meses selecionados e repopula os checkboxes
    currentSelectedMonths = [];
    populateMonthCheckboxes();
    fetchTransactions();
});

monthsCheckboxesContainer.addEventListener('change', (e) => {
    if (e.target.classList.contains('month-filter-checkbox')) {
        const monthValue = parseInt(e.target.value);
        if (e.target.checked) {
            if (!currentSelectedMonths.includes(monthValue)) {
                currentSelectedMonths.push(monthValue);
            }
        } else {
            currentSelectedMonths = currentSelectedMonths.filter(m => m !== monthValue);
        }
        fetchTransactions();
    }
});

filterDescriptionInput.addEventListener('input', () => {
    fetchTransactions();
});


// Atualizar o painel de resumo
const updateSummary = (transactions, year, selectedMonths) => {
    let totalEntradas = 0;
    let totalSaidas = 0;
    let daysInPeriod = 0;

    // Calcular dias no período para a média diária
    if (selectedMonths.length > 0) {
        // Se meses específicos foram selecionados, soma os dias desses meses no ano
        selectedMonths.forEach(monthIndex => {
            daysInPeriod += new Date(year, monthIndex + 1, 0).getDate();
        });
    } else {
        // Se nenhum mês foi selecionado (ano inteiro), calcula dias no ano
        daysInPeriod = (year % 400 === 0 || (year % 100 !== 0 && year % 4 === 0)) ? 366 : 365;
    }

    transactions.forEach(transaction => {
        if (transaction.type === 'entrada') {
            totalEntradas += transaction.value;
        } else {
            totalSaidas += transaction.value;
        }
    });

    const saldoMes = totalEntradas - totalSaidas;
    const mediaGastoDiario = daysInPeriod > 0 ? totalSaidas / daysInPeriod : 0;

    totalEntradasSpan.textContent = formatCurrency(totalEntradas);
    totalSaidasSpan.textContent = formatCurrency(totalSaidas);
    mediaGastoDiarioSpan.textContent = formatCurrency(mediaGastoDiario);
    saldoMesSpan.textContent = formatCurrency(saldoMes);

    saldoMesSpan.classList.remove('positive', 'negative');
    if (saldoMes >= 0) {
        saldoMesSpan.classList.add('positive');
    } else {
        saldoMesSpan.classList.add('negative');
    }
};


// --- Inicialização do Dashboard ---
const initializeDashboard = async (uid) => {
    await populateYearFilter(); // Popula o select de anos
    populateMonthCheckboxes(); // Popula os checkboxes de meses
    fetchTransactions(); // Busca e exibe os lançamentos iniciais
};