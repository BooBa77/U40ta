import { h } from 'vue'
import QrScannerButton from '../../../components/QrScanner/ui/QrScannerButton.vue'

export function useStatementColumns() {
  const columns = [
    {
      id: 'qr_action',
      header: '',
      accessorKey: 'id',
      cell: ({ row }) => h(QrScannerButton, {
        size: 'small',
        initialData: {
          inv_number: row.original.inv_number || row.original.invNumber,
          party_number: row.original.party_number || row.original.partyNumber,
          quantity: row.original.quantity || 1
        }
      })
    },
    {
      id: 'is_ignore',
      header: 'X',
      accessorKey: 'is_ignore',
      cell: ({ row }) => {
        const isChecked = row.original.is_ignore || row.original.isIgnore || false
        return h('input', {
          type: 'checkbox',
          checked: isChecked,
          onChange: (event) => {
            console.log('Изменили is_ignore для строки', row.original.id, 'на', event.target.checked)
          }
        })
      }
    },
    {
      id: 'inv_party_combined',
      header: 'Инв. номер',
      accessorFn: (row) => {
        const inv = row.inv_number || row.invNumber || ''
        const party = row.party_number || row.partyNumber || ''
        const quantity = row.quantity || 1
        
        if (party && quantity > 1) {
          return `${inv}\n${party} (${quantity} шт.)`
        }
        if (party) {
          return `${inv}\n${party}`
        }
        return inv
      },
      cell: ({ row }) => {
        const inv = row.original.inv_number || row.original.invNumber || '—'
        const party = row.original.party_number || row.original.partyNumber || ''
        const quantity = row.original.quantity || 1
        
        // Формируем содержимое для партии
        let partyContent = ''
        if (party) {
          if (quantity > 1) {
            partyContent = `${party} (${quantity} шт.)`
          } else {
            partyContent = party
          }
        }
        
        return h('div', { class: 'inv-party-cell' }, [
          h('div', { class: 'inv-number' }, inv),
          partyContent ? h('div', { class: 'party-number' }, [
            party,
            quantity > 1 ? h('span', { class: 'quantity' }, ` (${quantity} шт.)`) : null
          ]) : null
        ])
      }
    },
    {
      id: 'buh_name',
      header: 'Наименование',
      accessorKey: 'buh_name',
      cell: ({ getValue }) => {
        const value = getValue()
        return value || '—'
      }
    }
  ]

  return columns
}