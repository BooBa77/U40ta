import { ref } from 'vue'
import { useVueTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel } from '@tanstack/vue-table'

export function useDataTable(data, columns, sortBy = null) {
  const sorting = sortBy ? [{ id: sortBy, desc: false }] : []
  const columnFilters = ref([])

  const table = useVueTable({
    data: data.value,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters: columnFilters.value,
    },
    onSortingChange: () => {},
    onColumnFiltersChange: (updater) => {
      columnFilters.value = typeof updater === 'function' 
        ? updater(columnFilters.value) 
        : updater
    },
  })

  const clearFilters = () => {
    columnFilters.value = []
  }

  return {
    table,
    rows: table.getRowModel().rows,
    columnFilters,
    clearFilters
  }
}