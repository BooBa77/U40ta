<template>
  <Transition name="modal">
    <div v-if="isOpen" class="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50">
      <div class="bg-white rounded-lg w-[90vw] max-w-md max-h-[70vh] flex flex-col">
        <div class="p-4 border-b">
          <h3 class="text-lg font-medium">Переместить вместе?</h3>
          <p class="text-sm text-gray-500 mt-1">
            Объекты с тем же местоположением ({{ objects.length - 1 }} шт. без учёта текущего)
          </p>
        </div>
        <div class="flex-1 overflow-y-auto p-4">
          <div v-for="obj in otherObjects" :key="obj.id" class="flex items-center gap-3 py-2 border-b last:border-0">
            <input type="checkbox" v-model="selectedIds" :value="obj.id" class="w-5 h-5" />
            <div>
              <div class="text-sm font-medium">{{ obj.buhName || '—' }}</div>
              <div class="text-xs text-gray-500">{{ obj.invNumber || '—' }}</div>
            </div>
          </div>
        </div>
        <div class="flex gap-2 p-3 border-t">
          <button @click="$emit('skip')" class="flex-1 ...">Пропустить</button>
          <button @click="$emit('confirm', selectedIds)" class="flex-1 ...">Переместить выбранные</button>
        </div>
      </div>
    </div>
  </Transition>
</template>