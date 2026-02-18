import { ref } from 'vue'

export function useObjectPlaces() {
  const territory = ref('')
  const room = ref('')
  const cabinet = ref('')
  const user = ref('')

  const initFromObject = (object) => {
    territory.value = object.place_ter || ''
    room.value = object.place_pos || ''
    cabinet.value = object.place_cab || ''
    user.value = object.place_user || ''
  }

  const reset = () => {
    territory.value = ''
    room.value = ''
    cabinet.value = ''
    user.value = ''
  }

  return {
    territory,
    room,
    cabinet,
    user,
    initFromObject,
    reset
  }
}