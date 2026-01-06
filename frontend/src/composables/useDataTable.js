import { useVueTable, getCoreRowModel, getSortedRowModel } from '@tanstack/vue-table'

export function useDataTable(data, columns, sortBy = null) {
  const sorting = sortBy ? [{ id: sortBy, desc: false }] : []

  const table = useVueTable({
    data: data.value,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting },
    onSortingChange: () => {},
  })

  return {
    table,
    rows: table.getRowModel().rows
  }
}