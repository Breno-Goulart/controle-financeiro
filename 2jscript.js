// Importa as funções necessárias do Firebase SDK (versões modulares padrão)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot, addDoc, setDoc, doc, deleteDoc, query, where, getDocs, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { format, parseISO, startOfMonth, endOfMonth, isBefore, isSameMonth, isAfter, addMonths, addWeeks, addDays, subMonths } from 'https://cdn.skypack.dev/date-fns';
import { ptBR } from 'https://cdn.skypack.dev/date-fns/locale';

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

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
let auth;
let db;
let lancamentosCollection;

// Variáveis de estado global
let userId = null;
let currentHouseholdId = null;
let allTransactions = []; // Armazena todos os lançamentos brutos
let isAuthReady = false; // Sinaliza que a autenticação inicial foi concluída
let currentEditingTransaction = null; // Para armazenar o lançamento sendo editado

// Elementos do DOM - Variáveis para elementos que serão acessados frequentemente
let balanceDisplay, incomesDisplay, expensesDisplay, transactionsList;
let transactionForm, descriptionInput, amountInput, dateInput, typeInput, categoryInput, isRecurringCheckbox, recurringOptionsDiv, recurringTypeInput, installmentsInput, installmentNumberInput;
let monthFilter, yearFilter, typeFilter, categoryFilter;
let userIdDisplay, householdIdDisplay, createHouseholdBtn, newHouseholdIdInput, joinHouseholdBtn, joinHouseholdIdInput;
let logoutBtn;

// Modals e seus botões
let stopRecurringModalOverlay, confirmStopRecurringBtn, cancelStopRecurringBtn;
let stopRecurringMonthSelect, stopRecurringYearSelect;
let editRecurringChoiceModalOverlay, applyToThisBtn, applyToFutureBtn, cancelEditRecurringBtn;

// Elementos do login
let loginContainer, appContent, authForm, emailInput, passwordInput, loginBtn, registerBtn;

// Funções utilitárias
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function showMessageBox(title, message, type = 'info') {
    const existingMessageBox = document.getElementById('messageBoxOverlay');
    if (existingMessageBox) {
        existingMessageBox.remove();
    }

    const overlay = document.createElement('div');
    overlay.id = 'messageBoxOverlay';
    overlay.className = 'message-box-overlay';

    const content = document.createElement('div');
    content.className = 'message-box-content';

    const titleEl = document.createElement('h3');
    titleEl.textContent = title;
    content.appendChild(titleEl);

    const messageEl = document.createElement('p');
    messageEl.textContent = message;
    content.appendChild(messageEl);

    const closeButton = document.createElement('button');
    closeButton.textContent = 'OK';
    closeButton.onclick = () => overlay.remove();
    content.appendChild(closeButton);

    overlay.appendChild(content);
    document.body.appendChild(overlay);
}

// Funções para Modals
function showModal(modalOverlayId) {
    document.getElementById(modalOverlayId).classList.remove('hidden');
}

function hideModal(modalOverlayId) {
    document.getElementById(modalOverlayId).classList.add('hidden');
}

// Inicializa os elementos do DOM e configura os listeners
function initializeUI() {
    // Elements do Login
    loginContainer = document.getElementById('login-container');
    appContent = document.getElementById('app-content');
    authForm = document.getElementById('auth-form');
    emailInput = document.getElementById('email');
    passwordInput = document.getElementById('password');
    loginBtn = document.getElementById('login-btn');
    registerBtn = document.getElementById('register-btn');

    // Elementos principais do aplicativo
    balanceDisplay = document.getElementById('balance-display');
    incomesDisplay = document.getElementById('incomes-display');
    expensesDisplay = document.getElementById('expenses-display');
    transactionsList = document.getElementById('transactions-list');

    transactionForm = document.getElementById('transaction-form');
    descriptionInput = document.getElementById('description');
    amountInput = document.getElementById('amount');
    dateInput = document.getElementById('date');
    typeInput = document.getElementById('type');
    categoryInput = document.getElementById('category');
    isRecurringCheckbox = document.getElementById('is-recurring');
    recurringOptionsDiv = document.getElementById('recurring-options');
    recurringTypeInput = document.getElementById('recurring-type');
    installmentsInput = document.getElementById('installments');
    installmentNumberInput = document.getElementById('installment-number');

    monthFilter = document.getElementById('month-filter');
    yearFilter = document.getElementById('year-filter');
    typeFilter = document.getElementById('type-filter');
    categoryFilter = document.getElementById('category-filter');

    userIdDisplay = document.getElementById('user-id-display');
    householdIdDisplay = document.getElementById('household-id-display');
    createHouseholdBtn = document.getElementById('create-household-btn');
    newHouseholdIdInput = document.getElementById('new-household-id');
    joinHouseholdBtn = document.getElementById('join-household-btn');
    joinHouseholdIdInput = document.getElementById('join-household-id');
    logoutBtn = document.getElementById('logout-btn');

    // Modais e seus botões
    stopRecurringModalOverlay = document.getElementById('stopRecurringModalOverlay');
    confirmStopRecurringBtn = document.getElementById('confirmStopRecurringBtn');
    cancelStopRecurringBtn = document.getElementById('cancelStopRecurringBtn');
    stopRecurringMonthSelect = document.getElementById('stop-recurring-month');
    stopRecurringYearSelect = document.getElementById('stop-recurring-year');

    editRecurringChoiceModalOverlay = document.getElementById('editRecurringChoiceModalOverlay');
    applyToThisBtn = document.getElementById('applyToThisBtn');
    applyToFutureBtn = document.getElementById('applyToFutureBtn');
    cancelEditRecurringBtn = document.getElementById('cancelEditRecurringBtn');

    // Event Listeners
    transactionForm.addEventListener('submit', handleTransactionSubmit);
    isRecurringCheckbox.addEventListener('change', toggleRecurringOptions);
    monthFilter.addEventListener('change', filterTransactions);
    yearFilter.addEventListener('change', filterTransactions);
    typeFilter.addEventListener('change', filterTransactions);
    categoryFilter.addEventListener('change', filterTransactions);
    createHouseholdBtn.addEventListener('click', createNewHousehold);
    joinHouseholdBtn.addEventListener('click', joinExistingHousehold);
    logoutBtn.addEventListener('click', handleLogout);

    // Event Listeners para Modals
    cancelStopRecurringBtn.addEventListener('click', () => hideModal('stopRecurringModalOverlay'));
    cancelEditRecurringBtn.addEventListener('click', () => hideModal('editRecurringChoiceModalOverlay'));

    // Adiciona as categorias e filtros
    populateCategories();
    populateMonthFilter();
    populateYearFilter();
    populateStopRecurringDateFilters(); // Popula os selects do modal de parar recorrência
}

function toggleRecurringOptions() {
    if (isRecurringCheckbox.checked) {
        recurringOptionsDiv.classList.remove('hidden');
    } else {
        recurringOptionsDiv.classList.add('hidden');
        installmentsInput.value = 0; // Reseta parcelas ao desmarcar
    }
}

function populateCategories() {
    const categories = ['Alimentação', 'Transporte', 'Moradia', 'Educação', 'Saúde', 'Lazer', 'Salário', 'Investimentos', 'Outros'];
    categoryInput.innerHTML = categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    categoryFilter.innerHTML = '<option value="all">Todas as Categorias</option>' + categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
}

function populateMonthFilter() {
    const months = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];
    const currentMonth = new Date().getMonth();
    monthFilter.innerHTML = months.map((month, index) =>
        `<option value="${index}" ${index === currentMonth ? 'selected' : ''}>${month}</option>`
    ).join('');
}

function populateYearFilter() {
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 5; // 5 anos para trás
    const endYear = currentYear + 5;   // 5 anos para frente
    yearFilter.innerHTML = '';
    for (let year = startYear; year <= endYear; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        if (year === currentYear) {
            option.selected = true;
        }
        yearFilter.appendChild(option);
    }
}

function populateStopRecurringDateFilters() {
    const months = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];
    const currentMonth = new Date().getMonth();
    stopRecurringMonthSelect.innerHTML = months.map((month, index) =>
        `<option value="${index}" ${index === currentMonth ? 'selected' : ''}>${month}</option>`
    ).join('');

    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 5;
    const endYear = currentYear + 5;
    stopRecurringYearSelect.innerHTML = '';
    for (let year = startYear; year <= endYear; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        if (year === currentYear) {
            option.selected = true;
        }
        stopRecurringYearSelect.appendChild(option);
    }
}

async function handleTransactionSubmit(e) {
    e.preventDefault();

    const description = descriptionInput.value;
    const amount = parseFloat(amountInput.value);
    const date = dateInput.value;
    const type = typeInput.value;
    const category = categoryInput.value;
    const isRecurring = isRecurringCheckbox.checked;
    const recurringType = recurringTypeInput.value;
    const installments = parseInt(installmentsInput.value);

    if (isNaN(amount) || amount <= 0) {
        showMessageBox("Erro", "Por favor, insira um valor válido.");
        return;
    }

    if (currentEditingTransaction) {
        // Lógica de edição
        if (currentEditingTransaction.isRecurring || currentEditingTransaction.installments > 0) {
            // Se for recorrente/parcelado, mostra o modal de escolha
            showModal('editRecurringChoiceModalOverlay');
            applyToThisBtn.onclick = () => {
                hideModal('editRecurringChoiceModalOverlay');
                updateSingleTransaction(currentEditingTransaction.id, { description, amount, date, type, category, isRecurring, recurringType, installments });
            };
            applyToFutureBtn.onclick = () => {
                hideModal('editRecurringChoiceModalOverlay');
                showModal('stopRecurringModalOverlay'); // Reutiliza o modal para escolher o mês de parada
                confirmStopRecurringBtn.onclick = () => {
                    hideModal('stopRecurringModalOverlay');
                    updateRecurringTransactions(currentEditingTransaction, { description, amount, date, type, category, isRecurring, recurringType, installments });
                };
            };
        } else {
            // Se não for recorrente, edita diretamente
            await updateSingleTransaction(currentEditingTransaction.id, { description, amount, date, type, category, isRecurring, recurringType, installments });
        }
        currentEditingTransaction = null;
    } else {
        // Lógica de adição
        if (isRecurring && installments === 0) {
            // Recorrência infinita
            await addDoc(lancamentosCollection, {
                description,
                amount,
                date,
                type,
                category,
                isRecurring: true,
                recurringType,
                installments: 0,
                originalDate: date, // Para referência futura
                createdAt: new Date(),
                householdId: currentHouseholdId
            });
            showMessageBox("Sucesso", "Lançamento recorrente adicionado!");
        } else if (isRecurring && installments > 0) {
            // Lançamento parcelado
            const initialDate = parseISO(date);
            for (let i = 0; i < installments; i++) {
                let installmentDate = initialDate;
                if (recurringType === 'monthly') {
                    installmentDate = addMonths(initialDate, i);
                } else if (recurringType === 'weekly') {
                    installmentDate = addWeeks(initialDate, i);
                } else if (recurringType === 'daily') {
                    installmentDate = addDays(initialDate, i);
                }

                await addDoc(lancamentosCollection, {
                    description: `${description} (${i + 1}/${installments})`,
                    amount,
                    date: format(installmentDate, 'yyyy-MM-dd'),
                    type,
                    category,
                    isRecurring: true, // Ainda considerado recorrente para fins de agrupamento
                    recurringType,
                    installments,
                    installmentNumber: i + 1,
                    originalDate: date, // A data do primeiro lançamento para agrupar
                    recurringMasterId: null, // Será preenchido após o primeiro doc ser criado
                    createdAt: new Date(),
                    householdId: currentHouseholdId
                });
            }
            showMessageBox("Sucesso", `Lançamento parcelado em ${installments} vezes adicionado!`);
        } else {
            // Lançamento único
            await addDoc(lancamentosCollection, {
                description,
                amount,
                date,
                type,
                category,
                isRecurring: false,
                householdId: currentHouseholdId,
                createdAt: new Date()
            });
            showMessageBox("Sucesso", "Lançamento adicionado!");
        }
    }

    // Limpa o formulário
    transactionForm.reset();
    toggleRecurringOptions(); // Esconde opções de recorrência se estiverem visíveis
}

async function updateSingleTransaction(transactionId, newData) {
    const transactionRef = doc(db, `artifacts/${appId}/public/data/lancamentos`, transactionId);
    try {
        await updateDoc(transactionRef, newData);
        showMessageBox("Sucesso", "Lançamento atualizado com sucesso!");
    } catch (error) {
        console.error("Erro ao atualizar lançamento:", error);
        showMessageBox("Erro", "Não foi possível atualizar o lançamento.");
    }
}

async function updateRecurringTransactions(originalTransaction, newData) {
    showModal('stopRecurringModalOverlay'); // Exibe o modal de parada de recorrência
    
    confirmStopRecurringBtn.onclick = async () => {
        hideModal('stopRecurringModalOverlay');
        const stopMonth = parseInt(stopRecurringMonthSelect.value);
        const stopYear = parseInt(stopRecurringYearSelect.value);
        const stopDate = new Date(stopYear, stopMonth + 1, 0); // Último dia do mês de parada

        try {
            // Atualiza o lançamento original
            await updateDoc(doc(db, `artifacts/${appId}/public/data/lancamentos`, originalTransaction.id), {
                description: newData.description,
                amount: newData.amount,
                date: newData.date,
                type: newData.type,
                category: newData.category,
                // Mantém os dados de recorrência originais do item a ser editado se for parcelado
                // ou define como não recorrente se a edição for para parar a recorrência
                isRecurring: originalTransaction.isRecurring, // Mantém o status de recorrência do original
                recurringType: originalTransaction.recurringType,
                installments: originalTransaction.installments,
                installmentNumber: originalTransaction.installmentNumber || null,
            });

            // Encontrar todos os lançamentos futuros associados (baseado em originalDate ou masterId)
            let q;
            if (originalTransaction.recurringMasterId) {
                // Se for uma parcela, busca pelo masterId
                q = query(lancamentosCollection,
                    where("recurringMasterId", "==", originalTransaction.recurringMasterId),
                    where("householdId", "==", currentHouseholdId)
                );
            } else {
                // Se for o primeiro de uma série ou um recorrente infinito, busca pelo originalDate
                q = query(lancamentosCollection,
                    where("originalDate", "==", originalTransaction.originalDate),
                    where("householdId", "==", currentHouseholdId)
                );
            }
            
            const querySnapshot = await getDocs(q);
            const batch = db.batch(); // Usar batch para operações em massa

            querySnapshot.forEach(docSnapshot => {
                const transaction = { id: docSnapshot.id, ...docSnapshot.data() };
                const transactionDate = parseISO(transaction.date);

                if (isAfter(transactionDate, stopDate)) {
                    // Exclui lançamentos após a data de parada
                    batch.delete(doc(db, `artifacts/${appId}/public/data/lancamentos`, transaction.id));
                } else if (isSameMonth(transactionDate, parseISO(originalTransaction.date)) && transaction.id !== originalTransaction.id) {
                    // Atualiza futuros lançamentos dentro do mesmo mês do original (exceto o próprio original)
                    const updatedTransactionRef = doc(db, `artifacts/${appId}/public/data/lancamentos`, transaction.id);
                    batch.update(updatedTransactionRef, {
                        description: newData.description,
                        amount: newData.amount,
                        type: newData.type,
                        category: newData.category,
                        // Mantém a data original do futuro lançamento
                    });
                } else if (isAfter(transactionDate, parseISO(originalTransaction.date))) {
                    // Atualiza lançamentos futuros a partir do original (mantendo suas datas futuras)
                     const updatedTransactionRef = doc(db, `artifacts/${appId}/public/data/lancamentos`, transaction.id);
                    batch.update(updatedTransactionRef, {
                        description: newData.description,
                        amount: newData.amount,
                        type: newData.type,
                        category: newData.category,
                        // Mantém a data original do futuro lançamento
                    });
                }
            });

            await batch.commit();
            showMessageBox("Sucesso", "Lançamento recorrente e futuros atualizados com sucesso!");

        } catch (error) {
            console.error("Erro ao atualizar lançamentos recorrentes:", error);
            showMessageBox("Erro", "Não foi possível atualizar os lançamentos recorrentes.");
        } finally {
            currentEditingTransaction = null;
        }
    };
}


function displayTransactions(transactions) {
    transactionsList.innerHTML = '';
    if (transactions.length === 0) {
        transactionsList.innerHTML = '<p class="text-gray-500 text-center">Nenhum lançamento encontrado para o período selecionado.</p>';
        return;
    }

    let totalIncomes = 0;
    let totalExpenses = 0;

    transactions.forEach(transaction => {
        const amount = transaction.amount;
        const typeClass = transaction.type === 'income' ? 'text-income' : 'text-expense';
        const sign = transaction.type === 'income' ? '+' : '-';

        if (transaction.type === 'income') {
            totalIncomes += amount;
        } else {
            totalExpenses += amount;
        }

        const transactionDiv = document.createElement('div');
        transactionDiv.className = `p-4 bg-gray-50 rounded-lg shadow-sm flex justify-between items-center transition duration-200 ease-in-out transform hover:scale-[1.01] hover:shadow-md border-l-4 ${transaction.type === 'income' ? 'border-green-500' : 'border-red-500'}`;
        transactionDiv.innerHTML = `
            <div>
                <p class="text-lg font-semibold text-gray-800">${transaction.description}</p>
                <p class="text-sm text-gray-600">${format(parseISO(transaction.date), 'dd/MM/yyyy', { locale: ptBR })} - ${transaction.category}</p>
                ${transaction.isRecurring ? `<p class="text-xs text-gray-500">Recorrente: ${transaction.installments > 0 ? `Parcela ${transaction.installmentNumber}/${transaction.installments}` : 'Infinita'}</p>` : ''}
            </div>
            <div class="flex items-center space-x-3">
                <p class="text-xl font-bold ${typeClass}">${sign} ${formatCurrency(amount)}</p>
                <button data-id="${transaction.id}" class="edit-btn text-blue-500 hover:text-blue-700 p-1 rounded-full hover:bg-blue-100 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.38-2.828-2.828z" />
                    </svg>
                </button>
                <button data-id="${transaction.id}" class="delete-btn text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-100 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                    </svg>
                </button>
            </div>
        `;
        transactionsList.appendChild(transactionDiv);
    });

    balanceDisplay.textContent = formatCurrency(totalIncomes - totalExpenses);
    incomesDisplay.textContent = formatCurrency(totalIncomes);
    expensesDisplay.textContent = formatCurrency(totalExpenses);

    // Adicionar listeners para os botões de editar e excluir
    document.querySelectorAll('.edit-btn').forEach(button => {
        button.addEventListener('click', (e) => editTransaction(e.currentTarget.dataset.id));
    });
    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', (e) => deleteTransaction(e.currentTarget.dataset.id));
    });
}

function filterTransactions() {
    if (!isAuthReady || !allTransactions.length) return; // Garante que há dados e autenticação pronta

    const selectedMonth = parseInt(monthFilter.value);
    const selectedYear = parseInt(yearFilter.value);
    const selectedType = typeFilter.value;
    const selectedCategory = categoryFilter.value;

    const filtered = allTransactions.filter(transaction => {
        const transactionDate = parseISO(transaction.date);
        const transactionMonth = transactionDate.getMonth();
        const transactionYear = transactionDate.getFullYear();

        const matchesMonth = transactionMonth === selectedMonth;
        const matchesYear = transactionYear === selectedYear;
        const matchesType = selectedType === 'all' || transaction.type === selectedType;
        const matchesCategory = selectedCategory === 'all' || transaction.category === selectedCategory;

        return matchesMonth && matchesYear && matchesType && matchesCategory;
    });

    displayTransactions(filtered);
}

function setupFirestoreListener() {
    if (!currentHouseholdId) {
        console.warn("Nenhum householdId definido. Não é possível configurar o listener do Firestore.");
        transactionsList.innerHTML = '<p class="text-gray-500 text-center">Entre ou crie uma família/casa para ver os lançamentos.</p>';
        balanceDisplay.textContent = formatCurrency(0);
        incomesDisplay.textContent = formatCurrency(0);
        expensesDisplay.textContent = formatCurrency(0);
        return;
    }

    // Cria uma query para buscar lançamentos do householdId atual
    const q = query(lancamentosCollection, where("householdId", "==", currentHouseholdId));

    onSnapshot(q, (snapshot) => {
        allTransactions = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        filterTransactions(); // Chama o filtro para exibir os dados após o snapshot
    }, (error) => {
        console.error("Erro ao receber updates do Firestore:", error);
        showMessageBox("Erro no Firestore", "Não foi possível carregar os dados. Verifique sua conexão ou tente novamente.");
    });
}

async function editTransaction(id) {
    const transactionToEdit = allTransactions.find(t => t.id === id);
    if (transactionToEdit) {
        currentEditingTransaction = transactionToEdit;

        descriptionInput.value = transactionToEdit.description.replace(/\s\(\d+\/\d+\)$/, ''); // Remove parcelas do nome
        amountInput.value = transactionToEdit.amount;
        dateInput.value = transactionToEdit.date;
        typeInput.value = transactionToEdit.type;
        categoryInput.value = transactionToEdit.category;
        isRecurringCheckbox.checked = transactionToEdit.isRecurring || (transactionToEdit.installments > 0);
        toggleRecurringOptions();
        recurringTypeInput.value = transactionToEdit.recurringType || 'monthly';
        installmentsInput.value = transactionToEdit.installments || 0;
        installmentNumberInput.value = transactionToEdit.installmentNumber || 1;

        // Atualiza o botão de submit para indicar edição
        const submitButton = transactionForm.querySelector('button[type="submit"]');
        submitButton.textContent = 'Atualizar Lançamento';
        submitButton.classList.remove('bg-indigo-600', 'hover:bg-indigo-700');
        submitButton.classList.add('bg-orange-500', 'hover:bg-orange-600');
    }
}

async function deleteTransaction(id) {
    const transactionToDelete = allTransactions.find(t => t.id === id);

    if (!transactionToDelete) {
        showMessageBox("Erro", "Lançamento não encontrado.");
        return;
    }

    if (transactionToDelete.isRecurring || transactionToDelete.installments > 0) {
        const confirmDelete = await new Promise(resolve => {
            const overlay = document.createElement('div');
            overlay.className = 'message-box-overlay';
            overlay.innerHTML = `
                <div class="message-box-content">
                    <h3 class="text-xl font-bold mb-4 text-gray-800">Excluir Lançamento Recorrente?</h3>
                    <p class="text-gray-700 mb-6">Este é um lançamento recorrente/parcelado. O que você gostaria de excluir?</p>
                    <div class="flex justify-center space-x-4">
                        <button id="delete-this-one-btn" class="confirm-btn-primary">Apenas Este</button>
                        <button id="delete-all-future-btn" class="confirm-btn-primary">Este e Futuros</button>
                        <button id="cancel-delete-btn" class="cancel-btn">Cancelar</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            document.getElementById('delete-this-one-btn').onclick = () => {
                overlay.remove();
                resolve('this');
            };
            document.getElementById('delete-all-future-btn').onclick = () => {
                overlay.remove();
                resolve('future');
            };
            document.getElementById('cancel-delete-btn').onclick = () => {
                overlay.remove();
                resolve(null);
            };
        });

        if (confirmDelete === 'this') {
            await deleteSingleTransaction(id);
        } else if (confirmDelete === 'future') {
            showModal('stopRecurringModalOverlay');
            confirmStopRecurringBtn.onclick = async () => {
                hideModal('stopRecurringModalOverlay');
                const stopMonth = parseInt(stopRecurringMonthSelect.value);
                const stopYear = parseInt(stopRecurringYearSelect.value);
                const stopDate = new Date(stopYear, stopMonth + 1, 0); // Último dia do mês de parada

                await deleteRecurringTransactions(transactionToDelete, stopDate);
            };
        }
    } else {
        const confirmDelete = confirm("Tem certeza que deseja excluir este lançamento?");
        if (confirmDelete) {
            await deleteSingleTransaction(id);
        }
    }
}

async function deleteSingleTransaction(id) {
    try {
        await deleteDoc(doc(db, `artifacts/${appId}/public/data/lancamentos`, id));
        showMessageBox("Sucesso", "Lançamento excluído com sucesso!");
    } catch (error) {
        console.error("Erro ao excluir lançamento:", error);
        showMessageBox("Erro", "Não foi possível excluir o lançamento.");
    }
}

async function deleteRecurringTransactions(originalTransaction, stopDate) {
    try {
        // Exclui o lançamento original
        await deleteDoc(doc(db, `artifacts/${appId}/public/data/lancamentos`, originalTransaction.id));

        // Encontrar todos os lançamentos futuros associados (baseado em originalDate ou masterId)
        let q;
        if (originalTransaction.recurringMasterId) {
            // Se for uma parcela, busca pelo masterId
            q = query(lancamentosCollection,
                where("recurringMasterId", "==", originalTransaction.recurringMasterId),
                where("householdId", "==", currentHouseholdId)
            );
        } else {
            // Se for o primeiro de uma série ou um recorrente infinito, busca pelo originalDate
            q = query(lancamentosCollection,
                where("originalDate", "==", originalTransaction.originalDate),
                where("householdId", "==", currentHouseholdId)
            );
        }

        const querySnapshot = await getDocs(q);
        const batch = db.batch();

        querySnapshot.forEach(docSnapshot => {
            const transaction = { id: docSnapshot.id, ...docSnapshot.data() };
            const transactionDate = parseISO(transaction.date);

            // Exclui todos os lançamentos que são iguais ou posteriores à data do lançamento original
            // E também são anteriores ou no mês de parada
            if (isAfter(transactionDate, parseISO(originalTransaction.date)) && !isAfter(transactionDate, stopDate) ) {
                 batch.delete(doc(db, `artifacts/${appId}/public/data/lancamentos`, transaction.id));
            } else if (isSameMonth(transactionDate, parseISO(originalTransaction.date))) {
                 // Se for o mesmo mês do original, deleta se não for o original (já deletado acima)
                 if (transaction.id !== originalTransaction.id) {
                     batch.delete(doc(db, `artifacts/${appId}/public/data/lancamentos`, transaction.id));
                 }
            }
        });

        await batch.commit();
        showMessageBox("Sucesso", "Lançamentos recorrentes excluídos com sucesso!");

    } catch (error) {
        console.error("Erro ao excluir lançamentos recorrentes:", error);
        showMessageBox("Erro", "Não foi possível excluir os lançamentos recorrentes.");
    }
}


async function createNewHousehold() {
    const newId = newHouseholdIdInput.value.trim();
    if (!newId) {
        showMessageBox("Erro", "Por favor, insira um ID para a nova família/casa.");
        return;
    }
    if (newId === userId) {
        showMessageBox("Atenção", "O ID da família/casa não pode ser igual ao seu ID de usuário. Ele já é sua família padrão.");
        return;
    }

    try {
        // Verifica se já existe um household com esse ID
        const householdRef = doc(db, `artifacts/${appId}/public/households`, newId);
        const householdSnap = await getDocs(query(collection(db, `artifacts/${appId}/public/households`), where("__name__", "==", newId)));

        if (!householdSnap.empty) {
            showMessageBox("Erro", "Já existe uma família/casa com este ID. Por favor, escolha outro.");
            return;
        }

        // Cria o novo household (apenas um documento com o ID)
        await setDoc(householdRef, {
            createdAt: new Date(),
            ownerId: userId // Opcional: registrar quem criou
        });

        currentHouseholdId = newId;
        localStorage.setItem('savedHouseholdId', currentHouseholdId);
        householdIdDisplay.textContent = currentHouseholdId;
        setupFirestoreListener(); // Atualiza o listener para a nova household
        showMessageBox("Sucesso", `Nova família/casa "${newId}" criada e selecionada!`);
    } catch (error) {
        console.error("Erro ao criar nova família/casa:", error);
        showMessageBox("Erro", "Não foi possível criar a nova família/casa.");
    }
}

async function joinExistingHousehold() {
    const joinId = joinHouseholdIdInput.value.trim();
    if (!joinId) {
        showMessageBox("Erro", "Por favor, insira o ID da família/casa para entrar.");
        return;
    }

    try {
        // Verifica se o household existe
        const householdRef = doc(db, `artifacts/${appId}/public/households`, joinId);
        const householdSnap = await getDocs(query(collection(db, `artifacts/${appId}/public/households`), where("__name__", "==", joinId)));

        if (householdSnap.empty) {
            showMessageBox("Erro", "Família/Casa com este ID não encontrada.");
            return;
        }

        currentHouseholdId = joinId;
        localStorage.setItem('savedHouseholdId', currentHouseholdId);
        householdIdDisplay.textContent = currentHouseholdId;
        setupFirestoreListener(); // Atualiza o listener para a nova household
        showMessageBox("Sucesso", `Você entrou na família/casa "${joinId}"!`);
    } catch (error) {
        console.error("Erro ao entrar na família/casa:", error);
        showMessageBox("Erro", "Não foi possível entrar na família/casa.");
    }
}

// --- Funções de Autenticação ---
async function handleLogin(email, password) {
    try {
        await signInWithEmailAndPassword(auth, email, password);
        showMessageBox("Sucesso", "Login realizado com sucesso!");
    } catch (error) {
        console.error("Erro no login:", error);
        let errorMessage = "Erro ao fazer login.";
        if (error.code === 'auth/user-not-found') {
            errorMessage = "Usuário não encontrado. Verifique seu e-mail ou registre-se.";
        } else if (error.code === 'auth/wrong-password') {
            errorMessage = "Senha incorreta.";
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = "E-mail inválido.";
        }
        showMessageBox("Erro no Login", errorMessage);
    }
}

async function handleRegister(email, password) {
    try {
        await createUserWithEmailAndPassword(auth, email, password);
        showMessageBox("Sucesso", "Cadastro realizado com sucesso! Você foi logado automaticamente.");
    } catch (error) {
        console.error("Erro no registro:", error);
        let errorMessage = "Erro ao registrar.";
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = "Este e-mail já está em uso.";
        } else if (error.code === 'auth/weak-password') {
            errorMessage = "A senha é muito fraca (mínimo 6 caracteres).";
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = "E-mail inválido.";
        }
        showMessageBox("Erro no Registro", errorMessage);
    }
}

async function handleLogout() {
    try {
        await signOut(auth);
        showMessageBox("Sucesso", "Você foi desconectado.");
        // O onAuthStateChanged vai cuidar da exibição do formulário de login
        // Limpar dados locais relacionados ao usuário, se houver
        localStorage.removeItem('savedHouseholdId');
    } catch (error) {
        console.error("Erro ao fazer logout:", error);
        showMessageBox("Erro", "Não foi possível desconectar.");
    }
}


// --- Início da Aplicação ---
document.addEventListener('DOMContentLoaded', async () => {
    try {
        auth = getAuth(app);
        db = getFirestore(app);

        // Inicializa a UI (para que os elementos estejam disponíveis antes do onAuthStateChanged)
        initializeUI();

        // Listener do estado de autenticação do Firebase
        onAuthStateChanged(auth, (user) => {
            if (user) {
                // Usuário logado
                userId = user.uid;
                userIdDisplay.textContent = `ID do Usuário: ${userId}`;

                // Tenta carregar householdId do localStorage, senão usa userId como padrão
                let savedHouseholdId = localStorage.getItem('savedHouseholdId');
                if (savedHouseholdId) {
                    currentHouseholdId = savedHouseholdId;
                } else {
                    currentHouseholdId = userId; // Padrão: householdId = userId
                    localStorage.setItem('savedHouseholdId', currentHouseholdId);
                }

                householdIdDisplay.textContent = currentHouseholdId;
                joinHouseholdIdInput.value = currentHouseholdId; // Preenche o campo com o ID atual

                lancamentosCollection = collection(db, `artifacts/${appId}/public/data/lancamentos`);
                isAuthReady = true;

                // Mostra o conteúdo do aplicativo e esconde o login
                loginContainer.classList.add('hidden');
                appContent.classList.remove('hidden');

                // Configura o listener do Firestore para carregar os dados
                setupFirestoreListener();
            } else {
                // Usuário deslogado
                userId = null;
                currentHouseholdId = null;
                allTransactions = [];
                isAuthReady = false;

                // Esconde o conteúdo do aplicativo e mostra o login
                appContent.classList.add('hidden');
                loginContainer.classList.remove('hidden');

                // Limpa os displays
                userIdDisplay.textContent = `ID do Usuário: Não logado`;
                householdIdDisplay.textContent = `ID da Família/Casa: ---`;
                transactionsList.innerHTML = '<p class="text-gray-500 text-center">Faça login para ver seus lançamentos.</p>';
                balanceDisplay.textContent = formatCurrency(0);
                incomesDisplay.textContent = formatCurrency(0);
                expensesDisplay.textContent = formatCurrency(0);
            }
        });

        // Configura listeners para o formulário de login/registro
        authForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = emailInput.value;
            const password = passwordInput.value;
            if (e.submitter.id === 'login-btn') {
                await handleLogin(email, password);
            }
        });

        registerBtn.addEventListener('click', async () => {
            const email = emailInput.value;
            const password = passwordInput.value;
            await handleRegister(email, password);
        });

    } catch (error) {
        console.error("Erro fatal ao inicializar aplicação:", error);
        const userIdDisplayFallback = document.getElementById('user-id-display');
        const householdIdDisplayFallback = document.getElementById('household-id-display');
        if (userIdDisplayFallback) userIdDisplayFallback.textContent = `Erro ao carregar ID do Usuário.`;
        if (householdIdDisplayFallback) householdIdDisplayFallback.textContent = `Erro ao carregar ID da Família/Casa.`;
        showMessageBox("Erro Crítico", 'Erro ao carregar a aplicação. Por favor, tente novamente mais tarde. Verifique o console do navegador para mais detalhes.');
    }
});
