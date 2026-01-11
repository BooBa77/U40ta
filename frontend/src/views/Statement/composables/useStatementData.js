import { computed } from 'vue';

export function useStatementData(rawStatements) {
  // 1. Группировка по inv_number + party_number
  const groupedData = computed(() => {
    const groups = {};
    
    rawStatements.forEach(statement => {
      const key = `${statement.inv_number}|${statement.party_number}`;
      
      if (!groups[key]) {
        groups[key] = {
          ...statement,
          count: 1,
          items: [statement]
        };
      } else {
        groups[key].count++;
        groups[key].items.push(statement);
      }
    });
    
    return Object.values(groups);
  });

  // 2. Сортировка по 4 группам
  const sortedData = computed(() => {
    const groups = {
      haveObjectFalse: [],   // Красные: have_object = false
      isExcessTrue: [],      // Жёлтые: is_excess = true
      haveObjectTrue: [],    // Зелёные: have_object = true
      isIgnoreTrue: []       // Серые: is_ignore = true
    };

    groupedData.value.forEach(group => {
      if (group.is_ignore) {
        groups.isIgnoreTrue.push(group);
      } else if (!group.have_object) {
        groups.haveObjectFalse.push(group);
      } else if (group.is_excess) {
        groups.isExcessTrue.push(group);
      } else {
        groups.haveObjectTrue.push(group);
      }
    });

    // Сортировка внутри групп по buh_name
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => 
        a.buh_name.localeCompare(b.buh_name, 'ru')
      );
    });

    // Объединяем в нужном порядке
    return [
      ...groups.haveObjectFalse,
      ...groups.isExcessTrue,
      ...groups.haveObjectTrue,
      ...groups.isIgnoreTrue
    ];
  });

  // 3. Цвета строк
  const getRowColor = (item) => {
    if (item.is_ignore) return 'gray';
    if (!item.have_object) return 'red';
    if (item.is_excess) return 'yellow';
    return 'green';
  };

  // 4. Фильтр "игнорировать" для всей группы
  const getIgnoreStatus = (inv_number) => {
    const groupItems = rawStatements.filter(s => s.inv_number === inv_number);
    return groupItems.every(item => item.is_ignore);
  };

  return {
    groupedData,
    sortedData,
    getRowColor,
    getIgnoreStatus
  };
}