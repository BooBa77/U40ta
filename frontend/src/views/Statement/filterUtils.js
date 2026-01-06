// filterUtils.js
export const filterFns = {
  includesString: (row, columnId, filterValue) => {
    const value = row.getValue(columnId);
    if (!filterValue || filterValue === '') return true;
    return String(value).toLowerCase().includes(String(filterValue).toLowerCase());
  }
};

export const tableConfig = {
  filterFns: filterFns,
  
  getColumns: () => [
    {
      accessorKey: 'country',
      header: 'Страна',
      filterFn: 'includesString',
    },
    {
      accessorKey: 'capital',
      header: 'Столица',
      filterFn: 'includesString',
    },
  ]
};