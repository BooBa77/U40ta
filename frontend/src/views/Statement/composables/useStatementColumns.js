import { h } from 'vue'
import QrScannerButton from '../../../components/ui/QrScannerButton.vue'

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
          party_number: row.original.party_number || row.original.partyNumber
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
        return `${inv}\n${party}`
      },
      cell: ({ row }) => {
        const inv = row.original.inv_number || row.original.invNumber || '—'
        const party = row.original.party_number || row.original.partyNumber || '—'
        return h('div', { class: 'inv-party-cell' }, [
          h('div', { class: 'inv-number' }, inv),
          h('div', { class: 'party-number' }, party)
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
    },
    {
      id: 'quantity',
      header: '', // Пустой заголовок
      accessorKey: 'quantity',
      cell: ({ row }) => {
        const qty = row.original.quantity || row.original.qty || 1;
        return qty > 1 ? `(${qty})` : '';
      }
    }
  ]

  return columns
}