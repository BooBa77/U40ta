// filterUtils.js
export const filterFns = {
  // Стандартный текстовый фильтр
  includesString: (row, columnId, filterValue) => {
    const value = row.getValue(columnId);
    if (!filterValue || filterValue === '') return true;
    return String(value).toLowerCase().includes(String(filterValue).toLowerCase());
  },
  
  // Фильтр для множественного выбора (чекбоксы)
  multiSelect: (row, columnId, selectedValues) => {
    const value = row.getValue(columnId);
    if (!selectedValues || selectedValues.length === 0) return true;
    return selectedValues.includes(value);
  }
};

export const tableConfig = {
  filterFns: filterFns,
  
  getColumns: () => [
    {
      accessorKey: 'country',
      header: 'Страна',
      filterFn: 'includesString',
      filterType: 'text'
    },
    {
      accessorKey: 'capital',
      header: 'Столица',
      filterFn: 'includesString',
      filterType: 'text'
    },
    {
      accessorKey: 'continent',
      header: 'Континент',
      filterFn: 'multiSelect',
      filterType: 'multiselect'
    }
  ],
  
  // Получение уникальных значений для колонки
  getColumnUniqueValues: (data, columnId) => {
    const values = data.map(item => item[columnId]);
    return [...new Set(values)].sort();
  }
};

// Добавим экспорт getUniqueValues
export const getUniqueValues = (data, field) => {
  const values = data.map(item => item[field]);
  return [...new Set(values)].sort();
};