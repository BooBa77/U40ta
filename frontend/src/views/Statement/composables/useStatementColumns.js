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
    // 1. Колонка QR-кнопки
    {
      id: 'qr_action',
      header: 'QR',
      accessorKey: 'id', // используем id как ключ для сканирования
      size: 70,
      minSize: 60,
      maxSize: 80,
      cell: ({ row }) => h(QrScannerButton, {
        size: 'small',
        // Можно передать данные строки для предзаполнения
        initialData: {
          inv_number: row.original.inv_number || row.original.invNumber,
          party_number: row.original.party_number || row.original.partyNumber
        }
      })
    },
    
    // 2. Колонка чекбокса "Игнорировать"
    {
      id: 'is_ignore',
      header: 'Игнор',
      accessorKey: 'is_ignore',
      size: 70,
      minSize: 60,
      maxSize: 80,
      cell: ({ row }) => {
        const isChecked = row.original.is_ignore || row.original.isIgnore || false
        
        return h('input', {
          type: 'checkbox',
          checked: isChecked,
          onChange: (event) => {
            // TODO: Обновление на сервере через statementService.updateFlags()
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
      size: 150,
      minSize: 120,
      maxSize: 200,
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
      size: 120,
      minSize: 100,
      maxSize: 150,
      cell: ({ getValue }) => {
        const value = getValue()
        return value || '—'
      }
    },
    
    // 5. Колонка наименования (бухгалтерского)
    {
      id: 'buh_name',
      header: 'Наименование',
      accessorKey: 'buh_name',
      size: 300,
      minSize: 200,
      maxSize: 400,
      cell: ({ getValue }) => {
        const value = getValue()
        return value || '—'
      }
    },
    
    // 6. Колонка количества (пока заглушка - будет для группированных строк)
    {
      id: 'quantity',
      header: 'Кол-во',
      accessorKey: 'quantity',
      size: 80,
      minSize: 70,
      maxSize: 100,
      cell: () => '—' // Заглушка, будет вычисляться при группировке
    }
  ]

  return columns
}