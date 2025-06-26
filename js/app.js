// Este arquivo deve ser salvo em 'js/app.js'

// ... (todo o código existente até a linha que será alterada) ...

// Adicionar transação
transactionForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const currentUser = firebase.auth().currentUser; // Garante que currentUser está atualizado
    if (!currentUser) {
        alert('Você precisa estar logado para adicionar lançamentos.');
        return;
    }

    // A householdId agora não é mais usada para o caminho,
    // mas ainda podemos mantê-la como um campo no documento se desejar.
    // if (!currentHouseholdId) {
    //     alert('Por favor, defina uma Chave de Acesso (ID da Família/Grupo) para adicionar lançamentos.');
    //     return;
    // }

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
        // Se você quiser que a householdId informada seja um campo no documento, adicione aqui:
        householdId: currentHouseholdId, // Isso adicionará a householdId como um campo dentro do documento
    };

    try {
        console.log(`Tentando adicionar transação para o caminho fixo: public/data/lancamentos`);
        // ALTERAÇÃO CRUCIAL AQUI: Ajusta o caminho para sua estrutura atual
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

    // A householdId agora não é mais usada para o caminho,
    // mas os dados serão lidos do caminho fixo.
    // if (!currentHouseholdId) {
    //     console.warn('Nenhuma Chave de Acesso definida. Não é possível carregar lançamentos.');
    //     transactionsTableBody.innerHTML = '<tr><td colspan="9" class="py-4 text-center">Defina uma Chave de Acesso (ID da Família/Grupo) para ver os lançamentos.</td></tr>';
    //     clearMonthlySummary();
    //     return;
    // }

    console.log(`Tentando carregar lançamentos do caminho fixo: public/data/lancamentos`);

    // ALTERAÇÃO CRUCIAL AQUI: Ajusta o caminho para sua estrutura atual
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
        console.log(`Snapshot recebido para public/data/lancamentos. Número de documentos brutos: ${snapshot.size}`);

        if (snapshot.empty) {
            console.log(`Nenhum documento encontrado para o caminho ou as regras do Firebase estão bloqueando o acesso.`);
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

        console.log(`Número de transações após filtragem no cliente: ${filteredTransactions.length}`);

        displayTransactions(filteredTransactions);
        updateMonthlySummary(filteredTransactions);
    }, error => {
        console.error(`Erro ao carregar lançamentos para public/data/lancamentos:`, error);
        let errorMessage = 'Erro ao carregar lançamentos. Verifique sua conexão.';
        if (error.code === 'permission-denied') {
            errorMessage = 'Permissão negada! Verifique as regras de segurança do Firebase Firestore.';
        }
        transactionsTableBody.innerHTML = `<tr><td colspan="9" class="py-4 text-center text-red-500">${errorMessage}</td></tr>`;
        clearMonthlySummary();
    });
};

// ... (todo o restante do código permanece igual) ...

// Delete transaction function
const deleteTransaction = async (id) => {
    // A householdId agora não é mais usada para o caminho da exclusão,
    // pois a transação é deletada do caminho fixo.
    // if (!currentHouseholdId) {
    //     alert('Nenhuma Chave de Acesso definida. Não é possível excluir lançamentos.');
    //     return;
    // }
    if (!confirm('Tem certeza que deseja excluir este lançamento?')) {
        return;
    }
    try {
        console.log(`Tentando excluir transação ${id} do caminho fixo: public/data/lancamentos`);
        // ALTERAÇÃO CRUCIAL AQUI: Ajusta o caminho para sua estrutura atual
        await db.collection('public').doc('data').collection('lancamentos').doc(id).delete();
        alert('Lançamento excluído com sucesso!');
    } catch (error) {
        alert(`Erro ao excluir lançamento: ${error.message}`);
        console.error("Erro ao excluir lançamento:", error);
    }
};

// ... (o restante do código continua) ...
