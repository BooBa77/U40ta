/**
 * Сервис для отправки предлагаемых изменений от гостей.
 * Используется только в онлайн-режиме.
 * В офлайне изменения применяются напрямую к кэшу через objectService.
 */
export class ProposedChangesService {
  constructor() {
    this.baseUrl = '/api'
  }

  /**
   * Отправляет пакет предлагаемых изменений на сервер.
   * 
   * @param {number} objectId — ID объекта
   * @param {Array<{changeType: string, proposedData: Object}>} changes — массив изменений
   * @returns {Promise<Object>} ответ API
   */
  async proposeChanges(objectId, changes) {
    const token = localStorage.getItem('auth_token')
    if (!token) throw new Error('Токен авторизации не найден')

    const payload = {
      changes: changes.map(c => ({
        objectId,
        changeType: c.changeType,
        proposedData: c.proposedData
      }))
    }

    const response = await fetch(`${this.baseUrl}/proposed-changes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      throw new Error(`Ошибка отправки предлагаемых изменений: ${response.status}`)
    }

    return await response.json()
  }
}

export const proposedChangesService = new ProposedChangesService()