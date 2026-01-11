// src/views/Statement/composables/useStatementColumns.js
import { h } from 'vue';

export function useStatementColumns() {
  const columns = [
    {
      id: 'qr',
      header: 'QR',
      accessorKey: 'id',
      size: 80,
      cell: ({ row }) => h('button', {
        class: 'qr-button',
        onClick: () => console.log('Сканировать QR для', row.original.inv_number)
      }, 'QR')
    },
    {
      id: 'ignore',
      header: 'Игнорировать',
      accessorKey: 'is_ignore',
      size: 120,
      cell: ({ row }) => h('input', {
        type: 'checkbox',
        checked: row.original.is_ignore,
        onChange: (e) => {
          // Логика обновления всей группы
          console.log('Изменить is_ignore для группы', row.original.inv_number, e.target.checked);
        }
      })
    },
    {
      id: 'inv_number',
      header: 'Инвентарный номер',
      accessorKey: 'inv_number',
      size: 180,
      cell: ({ row }) => row.original.inv_number
    },
    {
      id: 'party_number',
      header: 'Партия',
      accessorKey: 'party_number',
      size: 120,
      cell: ({ row }) => row.original.party_number
    },
    {
      id: 'buh_name',
      header: 'Наименование',
      accessorKey: 'buh_name',
      size: 300,
      cell: ({ row }) => {
        const name = row.original.buh_name;
        const count = row.original.count > 1 ? ` (${row.original.count} шт.)` : '';
        return name + count;
      }
    }
  ];

  return { columns };
}