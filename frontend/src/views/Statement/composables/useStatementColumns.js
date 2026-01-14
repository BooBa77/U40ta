/**
 * Хук для определения колонок таблицы ведомостей
 * Используется с TanStack Table
 * @returns {Array} Массив определений колонок для TanStack Table
 */
import { h } from 'vue'
import QrScannerButton from '../../../components/ui/QrScannerButton.vue'

export function useStatementColumns() {
  /**
   * Определяем колонки таблицы
   * Формат колонок для TanStack Table v8
   */
  const columns = [
    // 1. Колонка QR-кнопки - без заголовка (будет скрыт в CSS)
    {
      id: 'qr_action',
      header: '', // Пустой заголовок - будет скрыт в CSS
      accessorKey: 'id',
      cell: ({ row }) => h(QrScannerButton, {
        size: 'small',
        initialData: {
          inv_number: row.original.inv_number || row.original.invNumber,
          party_number: row.original.party_number || row.original.partyNumber
        }
      })
    },
    
    // 2. Колонка чекбокса "Игнорировать"
    {
      id: 'is_ignore',
      header: 'Игнор', // На мобильных будет "X"
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
    
    // 3. Колонка инвентарного номера
    {
      id: 'inv_number',
      header: 'Инв. номер',
      accessorKey: 'inv_number',
      cell: ({ getValue }) => {
        const value = getValue()
        return value || '—'
      }
    },
    
    // 4. Колонка номера партии
    {
      id: 'party_number',
      header: 'Партия',
      accessorKey: 'party_number',
      cell: ({ getValue }) => {
        const value = getValue()
        return value || '—'
      }
    },
    
    // 5. Колонка наименования (бухгалтерского) - самая широкая
    {
      id: 'buh_name',
      header: 'Наименование',
      accessorKey: 'buh_name',
      cell: ({ getValue }) => {
        const value = getValue()
        return value || '—'
      }
    },
    
    // 6. Колонка количества
    {
      id: 'quantity',
      header: 'Кол-во',
      accessorKey: 'quantity',
      cell: () => '—'
    }
  ]

  return columns
}