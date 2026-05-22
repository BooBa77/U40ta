import { h } from 'vue'

export function useInventoryBookColumns() {
  /**
   * Класс строки для цветовой индикации
   */
  const getRowClass = (group) => {
    const map = {
      'green': 'row-status-green',
      'yellow': 'row-status-yellow',
      'white': 'row-status-white',
      'red': 'row-status-red',
      'red-gray': 'row-status-red-gray',
    }
    return map[group.status] || ''
  }

  const columns = [
    {
      id: 'counter',
      header: 'OK',
      accessorKey: 'counterText',
      cell: ({ row }) => {
        const group = row.original
        return h('div', { class: `counter-cell counter-${group.status}` }, group.counterText)
      },
    },
    {
      id: 'is_ignore',
      header: 'X',
      accessorKey: 'isIgnore',
      cell: ({ row }) => {
        return h('input', {
          type: 'checkbox',
          checked: row.original.isIgnore,
          onClick: (event) => event.stopPropagation(),
          onChange: (event) => {
            // Будет обработано через emit в таблице
          },
        })
      },
    },
    {
      id: 'inv_party_combined',
      header: 'Инв. номер',
      accessorKey: 'invNumber',
      cell: ({ row }) => {
        const group = row.original
        return h('div', { class: 'inv-party-cell' }, [
          h('div', { class: 'inv-number' }, group.invNumber),
          group.partyNumber
            ? h('div', { class: 'party-number' }, [
                group.partyNumber,
                group.totalCount > 1
                  ? h('span', { class: 'quantity' }, ` (${group.totalCount} шт.)`)
                  : null,
              ])
            : group.totalCount > 1
              ? h('div', { class: 'party-number' }, `(${group.totalCount} шт.)`)
              : null,
        ])
      },
    },
    {
      id: 'buh_name',
      header: 'Наименование',
      accessorKey: 'buhName',
      cell: ({ getValue }) => getValue() || '—',
    },
  ]

  return {
    columns,
    getRowClass,
  }
}